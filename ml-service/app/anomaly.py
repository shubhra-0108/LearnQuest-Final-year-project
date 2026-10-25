"""
Anomaly Detection for Anti-Cheat in LearnQuest.

Detects suspicious response patterns using:
1. Z-score on response times per child (rolling baseline)
2. Accuracy spike detection (sudden all-correct streaks)
3. Velocity analysis (too many correct in too little time)

Risk score output: 0.0 (clean) to 1.0 (high risk)
"""
from dataclasses import dataclass
import math
import statistics


@dataclass
class AttemptRecord:
    """Single answer attempt for anomaly analysis."""
    ms: int           # Response time in milliseconds
    correct: bool     # Whether answer was correct
    difficulty: int   # Question difficulty (1-5)


def _rolling_stats(times: list[float]) -> tuple[float, float]:
    """Compute mean and std of a list, with safety for small samples."""
    if len(times) < 2:
        return 5000.0, 2000.0  # Default baseline: 5s mean, 2s std
    mean = statistics.mean(times)
    std = statistics.stdev(times)
    return mean, max(std, 200.0)  # Minimum std of 200ms


def z_score_time(ms: float, mean: float, std: float) -> float:
    """Compute Z-score of response time."""
    return (ms - mean) / std


def score_attempt(
    ms: int,
    correct: bool,
    difficulty: int,
    history_ms: list[int],  # Last N response times for this child (NOT including current)
    min_ms: int = 1500,
) -> dict:
    """
    Score a single attempt for anomaly risk.

    Args:
        ms: Response time in milliseconds
        correct: Whether the answer was correct
        difficulty: Question difficulty (1-5)
        history_ms: Previous response times (used as baseline)
        min_ms: Minimum valid response time

    Returns:
        dict with: risk_score, flags, z_score
    """
    flags = []
    risk = 0.0

    # Flag 1: Too fast (absolute threshold)
    if ms < min_ms:
        flags.append("too_fast")
        risk += 0.3

    # Flag 2: Z-score on response time
    if history_ms:
        mean, std = _rolling_stats(history_ms)
        z = z_score_time(ms, mean, std)
        if z < -2.5:  # Much faster than usual
            flags.append("unusually_fast")
            risk += min(0.4, abs(z) * 0.05)
    else:
        z = 0.0

    # Flag 3: Very easy question answered very fast and correctly
    if correct and difficulty <= 2 and ms < 2000:
        risk += 0.05  # Minor risk increase

    # Flag 4: Very hard question answered very fast and correctly
    if correct and difficulty >= 4 and ms < min_ms * 1.5:
        flags.append("hard_question_fast_correct")
        risk += 0.2

    return {
        "risk_score": round(min(1.0, risk), 3),
        "flags": flags,
        "z_score": round(z, 3) if history_ms else None,
        "ms": ms,
    }


def score_session_batch(
    attempts: list[AttemptRecord],
    min_ms: int = 1500,
    window: int = 20,
) -> dict:
    """
    Score a batch of attempts (a session) for aggregate anomaly risk.

    Detects:
    - High proportion of too-fast answers
    - Suspiciously high accuracy on hard questions
    - Response time variance anomalies (too consistent = bot-like)

    Args:
        attempts: List of AttemptRecord
        min_ms: Minimum valid response time
        window: Rolling window size for baseline

    Returns:
        dict with: session_risk, attempt_risks, flags
    """
    if not attempts:
        return {"session_risk": 0.0, "attempt_risks": [], "flags": []}

    flags = []
    attempt_risks = []
    times = [a.ms for a in attempts]

    for i, att in enumerate(attempts):
        history = times[max(0, i - window):i]
        result = score_attempt(att.ms, att.correct, att.difficulty, history, min_ms)
        attempt_risks.append(result)

    # Aggregate flags
    too_fast_count = sum(1 for r in attempt_risks if "too_fast" in r["flags"])
    fast_ratio = too_fast_count / len(attempts)
    if fast_ratio > 0.5:
        flags.append("majority_too_fast")

    # Accuracy on hard questions
    hard_attempts = [a for a in attempts if a.difficulty >= 4]
    if len(hard_attempts) >= 3:
        hard_accuracy = sum(1 for a in hard_attempts if a.correct) / len(hard_attempts)
        if hard_accuracy > 0.9:
            flags.append("suspiciously_high_hard_accuracy")

    # Response time variance (too consistent = bot)
    if len(times) >= 5:
        try:
            cv = statistics.stdev(times) / (statistics.mean(times) + 1)
            if cv < 0.05:  # Coefficient of variation < 5% = bot-like consistency
                flags.append("response_time_too_consistent")
        except Exception:
            pass

    # All correct streak detection
    streak = 0
    max_streak = 0
    for a in attempts:
        if a.correct:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0
    if max_streak >= 10 and len(attempts) >= 10:
        flags.append("long_correct_streak")

    # Compute session risk as weighted average of attempt risks + session-level flags
    avg_attempt_risk = sum(r["risk_score"] for r in attempt_risks) / len(attempt_risks)
    session_flag_risk = len(flags) * 0.15
    session_risk = round(min(1.0, avg_attempt_risk + session_flag_risk), 3)

    return {
        "session_risk": session_risk,
        "attempt_risks": attempt_risks,
        "flags": flags,
        "stats": {
            "total": len(attempts),
            "too_fast": too_fast_count,
            "fast_ratio": round(fast_ratio, 3),
            "max_correct_streak": max_streak,
        },
    }


def compute_child_risk_delta(
    current_risk: float,
    ms: int,
    min_ms: int = 1500,
    decay: float = 0.1,
) -> float:
    """
    Compute incremental risk delta to add to child.risk field.

    Positive delta for fast/suspicious answers, negative (decay) for normal.

    Args:
        current_risk: Child's current risk score
        ms: Current response time
        min_ms: Minimum valid time
        decay: How much to reduce risk per normal answer

    Returns:
        New risk score (clamped to [0, 10])
    """
    if ms < min_ms:
        delta = +1.0
    else:
        delta = -decay
    return round(max(0.0, min(10.0, current_risk + delta)), 2)
