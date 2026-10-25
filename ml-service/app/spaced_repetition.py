"""
Spaced Repetition Scheduler for LearnQuest.

Implements an SM-2-inspired algorithm adapted for skill-level scheduling:
- Tracks ease factor per skill
- Schedules next review based on forgetting curve
- Returns priority scores for skill ordering in practice sessions

Reference: SuperMemo SM-2 algorithm (Wozniak, 1987)
"""
from dataclasses import dataclass, field
import math
from datetime import datetime


@dataclass
class SkillSchedule:
    """Schedule state for one skill for one student."""
    skill: str
    p_known: float          # Current BKT mastery
    last_practiced_iso: str | None = None  # ISO date string or None
    ease_factor: float = 2.5   # SM-2 ease factor (starts at 2.5)
    interval_days: float = 1.0  # Current review interval in days
    repetitions: int = 0        # Number of successful reviews


def days_since(iso_date: str | None) -> float:
    """Compute days elapsed since an ISO date string."""
    if iso_date is None:
        return float('inf')  # Never practiced → treat as very overdue
    try:
        practiced = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
        now = datetime.now(practiced.tzinfo)
        delta = (now - practiced).total_seconds() / 86400.0
        return max(0.0, delta)
    except Exception:
        return float('inf')


def compute_priority(schedule: SkillSchedule) -> float:
    """
    Compute a priority score for practicing this skill now.

    Higher score = more urgently needs practice.

    Factors:
    1. How overdue (days past scheduled review)
    2. How weak (low p_known)
    3. Ease factor (harder to learn → higher priority)

    Returns:
        Priority score ≥ 0 (higher = more urgent)
    """
    elapsed = days_since(schedule.last_practiced_iso)
    overdue = max(0.0, elapsed - schedule.interval_days)
    overdue_factor = 1.0 + math.log1p(overdue)  # log to avoid extreme values

    weakness_factor = 1.0 + (1.0 - schedule.p_known) * 2.0  # Weak skills get boost

    # Ease factor: lower ease = harder to learn = higher priority
    ease_factor = 3.5 - schedule.ease_factor  # Invert (ease 1.3→2.2, ease 2.5→1.0)

    priority = overdue_factor * weakness_factor * max(0.1, ease_factor)
    return round(priority, 4)


def update_schedule(
    schedule: SkillSchedule,
    p_known_before: float,
    p_known_after: float,
    correct: bool,
) -> SkillSchedule:
    """
    Update skill schedule after a practice session.

    SM-2 uses a quality score 0-5:
    - We map from (correct, improvement) to quality
    - Update ease factor and interval accordingly

    Args:
        schedule: Current schedule state
        p_known_before: Mastery before this practice
        p_known_after: Mastery after this practice
        correct: Whether last answer was correct

    Returns:
        Updated SkillSchedule
    """
    # Map to SM-2 quality score (0-5)
    improvement = p_known_after - p_known_before
    if correct and improvement >= 0.05:
        quality = 5  # Perfect + improvement
    elif correct:
        quality = 4  # Correct but no big improvement
    elif improvement > 0:
        quality = 3  # Wrong but trending right
    elif improvement == 0:
        quality = 2  # Wrong, no change
    else:
        quality = 1  # Wrong + got worse

    # SM-2 update rules
    if quality >= 3:
        # Successful review: increase interval
        if schedule.repetitions == 0:
            new_interval = 1.0
        elif schedule.repetitions == 1:
            new_interval = 6.0
        else:
            new_interval = schedule.interval_days * schedule.ease_factor
        new_repetitions = schedule.repetitions + 1
    else:
        # Failed review: reset
        new_interval = 1.0
        new_repetitions = 0

    # Update ease factor (SM-2 formula, minimum 1.3)
    new_ease = schedule.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    new_ease = max(1.3, new_ease)

    return SkillSchedule(
        skill=schedule.skill,
        p_known=p_known_after,
        last_practiced_iso=datetime.utcnow().isoformat() + 'Z',
        ease_factor=round(new_ease, 3),
        interval_days=round(new_interval, 2),
        repetitions=new_repetitions,
    )


def rank_skills(schedules: list[SkillSchedule]) -> list[dict]:
    """
    Rank skills by practice priority for a student.

    Returns list sorted by priority descending.
    """
    ranked = []
    for s in schedules:
        priority = compute_priority(s)
        elapsed = days_since(s.last_practiced_iso)
        overdue = max(0.0, elapsed - s.interval_days)
        ranked.append({
            "skill": s.skill,
            "priority": priority,
            "p_known": s.p_known,
            "days_overdue": round(overdue, 1),
            "next_review_days": round(s.interval_days, 1),
            "repetitions": s.repetitions,
        })
    ranked.sort(key=lambda x: x["priority"], reverse=True)
    return ranked
