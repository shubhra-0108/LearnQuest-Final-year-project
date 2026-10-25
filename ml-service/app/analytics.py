"""
Learning Analytics for LearnQuest.

Computes:
1. Learning velocity — how fast a student is gaining mastery
2. Mastery heatmap — skill × day matrix of mastery values
3. Session quality score — how productive a session was
4. Predicted mastery — where will the student be in N days?
"""
import math
from typing import Optional


def compute_learning_velocity(
    mastery_snapshots: list[dict],  # [{date: str, skill: str, p_known: float}]
    days_window: int = 7,
) -> dict:
    """
    Compute learning velocity over recent days.

    Velocity = total mastery gain across all skills / days window

    Args:
        mastery_snapshots: List of {date, skill, p_known} records, oldest first
        days_window: Number of days to look back

    Returns:
        dict with: velocity, skills_improved, avg_gain_per_day, trend
    """
    if not mastery_snapshots:
        return {
            "velocity": 0.0,
            "skills_improved": 0,
            "avg_gain_per_day": 0.0,
            "trend": "inactive",
            "momentum": 0.0,
        }

    # Group by skill, find first and last p_known
    by_skill: dict[str, list] = {}
    for snap in mastery_snapshots:
        by_skill.setdefault(snap["skill"], []).append(snap)

    total_gain = 0.0
    skills_improved = 0
    skill_velocities = []

    for skill, snaps in by_skill.items():
        snaps.sort(key=lambda x: x.get("date", ""))
        if len(snaps) < 2:
            continue
        gain = snaps[-1]["p_known"] - snaps[0]["p_known"]
        total_gain += max(0, gain)
        if gain > 0.02:  # Meaningful improvement
            skills_improved += 1
        skill_velocities.append(gain)

    avg_gain_per_day = total_gain / max(1, days_window)
    velocity = round(total_gain / max(1, len(by_skill)), 4)

    # Trend: compare first half vs second half of snapshots
    mid = len(mastery_snapshots) // 2
    first_half = mastery_snapshots[:mid]
    second_half = mastery_snapshots[mid:]
    first_avg = _avg_p(first_half)
    second_avg = _avg_p(second_half)
    diff = second_avg - first_avg
    if diff > 0.02:
        trend = "accelerating"
    elif diff > 0:
        trend = "improving"
    elif diff < -0.02:
        trend = "declining"
    else:
        trend = "steady"

    # Momentum: weighted recent gain (last 2 days vs earlier)
    recent = [s for s in mastery_snapshots if _is_recent(s.get("date", ""), 2)]
    momentum = _avg_p(recent) - _avg_p(mastery_snapshots) if recent else 0.0

    return {
        "velocity": velocity,
        "skills_improved": skills_improved,
        "avg_gain_per_day": round(avg_gain_per_day, 4),
        "trend": trend,
        "momentum": round(momentum, 4),
        "total_mastery_gain": round(total_gain, 4),
    }


def _avg_p(snaps: list[dict]) -> float:
    if not snaps:
        return 0.0
    return sum(s.get("p_known", 0) for s in snaps) / len(snaps)


def _is_recent(date_str: str, days: int) -> bool:
    """Check if a date string represents a recent date within N days."""
    if not date_str:
        return False
    try:
        from datetime import datetime, timedelta, timezone
        d = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        return d >= cutoff
    except Exception:
        return False


def compute_mastery_heatmap(
    mastery_by_skill_and_day: list[dict],  # [{date, skill, p_known}]
    skills: Optional[list[str]] = None,
    days: int = 30,
) -> dict:
    """
    Generate a skill × day mastery heatmap matrix.

    Args:
        mastery_by_skill_and_day: Mastery snapshots
        skills: Skills to include (None = all)
        days: Number of days to include in heatmap

    Returns:
        dict with: skills, dates, matrix (skill → date → p_known)
    """
    from datetime import datetime, timedelta, timezone

    # Get date range
    end = datetime.now(timezone.utc)
    date_labels = [
        (end - timedelta(days=i)).strftime("%Y-%m-%d")
        for i in range(days - 1, -1, -1)
    ]

    # Collect all skills
    if skills is None:
        skills = sorted(set(s["skill"] for s in mastery_by_skill_and_day))

    # Build lookup: (skill, date) → p_known
    lookup: dict[tuple, float] = {}
    for snap in mastery_by_skill_and_day:
        try:
            d = datetime.fromisoformat(snap["date"].replace('Z', '+00:00'))
            key = (snap["skill"], d.strftime("%Y-%m-%d"))
            # Keep max p_known for the day (end-of-day snapshot)
            lookup[key] = max(lookup.get(key, 0), snap["p_known"])
        except Exception:
            continue

    # Fill forward: if no data for a day, use previous day's value
    matrix = {}
    for skill in skills:
        row = {}
        last_known = 0.0
        for date in date_labels:
            val = lookup.get((skill, date), None)
            if val is not None:
                last_known = val
            row[date] = round(last_known, 3)
        matrix[skill] = row

    return {
        "skills": skills,
        "dates": date_labels,
        "matrix": matrix,
        "summary": {
            skill: round(sum(matrix[skill].values()) / max(1, len(matrix[skill])), 3)
            for skill in skills
        },
    }


def compute_session_quality(
    questions_answered: int,
    points_earned: int,
    mastery_gain: float,  # Total p_known gain across all skills
    duration_seconds: int,
    correct_count: int,
) -> dict:
    """
    Score the quality of a learning session.

    Quality = weighted combination of:
    - Completion rate (relative to daily cap)
    - Accuracy
    - Mastery gain
    - Time investment

    Returns:
        dict with: quality_score (0-100), grade (A/B/C/D/F), breakdown
    """
    if questions_answered == 0:
        return {"quality_score": 0, "grade": "F", "breakdown": {}}

    accuracy = correct_count / questions_answered
    points_rate = min(1.0, points_earned / 100)  # 100 = daily cap
    mastery_score = min(1.0, mastery_gain / 0.5)  # 0.5 total gain = max
    time_score = min(1.0, duration_seconds / 900)  # 15 min = ideal session

    # Weighted average
    quality = (
        accuracy * 35
        + points_rate * 25
        + mastery_score * 25
        + time_score * 15
    )
    quality = round(quality, 1)

    grade = "A" if quality >= 85 else "B" if quality >= 70 else "C" if quality >= 55 else "D" if quality >= 40 else "F"

    return {
        "quality_score": quality,
        "grade": grade,
        "breakdown": {
            "accuracy": round(accuracy, 3),
            "points_rate": round(points_rate, 3),
            "mastery_score": round(mastery_score, 3),
            "time_score": round(time_score, 3),
        },
    }


def predict_mastery(
    current_p: float,
    velocity: float,
    days_ahead: int = 30,
    decay_lambda: float = 0.03,
) -> list[dict]:
    """
    Predict mastery trajectory over the next N days.

    Assumes student continues at current velocity with natural ceiling approach.

    Args:
        current_p: Current mastery probability
        velocity: Daily gain rate
        days_ahead: Days to predict
        decay_lambda: How velocity decays as mastery increases (harder to improve near ceiling)

    Returns:
        List of {day, predicted_p_known} for each day 1..days_ahead
    """
    predictions = []
    p = current_p
    for day in range(1, days_ahead + 1):
        # Velocity slows as we approach mastery ceiling
        effective_velocity = velocity * (1.0 - p) * math.exp(-decay_lambda * day)
        p = min(0.999, p + effective_velocity)
        predictions.append({
            "day": day,
            "predicted_p_known": round(p, 4),
            "predicted_mastery_pct": round(p * 100, 1),
        })
    return predictions
