"""
Adaptive Question Selector for LearnQuest.

Chooses the best next question for a student such that:
- P(correct) ≈ target (default 0.70) — challenging but achievable
- Ensures topic diversity (avoids hammering same skill)
- Uses combined BKT + IRT model for best estimate

The 0.70 target is in the "zone of proximal development" — hard enough
to be stimulating, easy enough to avoid frustration.
"""
import math
from .bkt import combined_p_correct, logit, _clip


def choose(
    p_known: float,
    candidates: list[dict],  # [{id, difficulty, discrimination=1.0, skill}]
    target: float = 0.70,
    p_guess: float = 0.20,
    p_slip: float = 0.10,
) -> dict:
    """
    Choose the best candidate question for this student.

    Strategy:
    1. Compute predicted P(correct) for each candidate using combined BKT+IRT
    2. Score each by proximity to target P(correct)
    3. Add diversity bonus for less-recently-seen skills
    4. Return the best candidate with its predicted P(correct)

    Args:
        p_known: Student's current mastery estimate (0-1)
        candidates: List of candidate question dicts with id, difficulty, optional discrimination/skill
        target: Target P(correct) (default 0.70)
        p_guess: Guessing probability
        p_slip: Slip probability

    Returns:
        dict with: id, p_correct, difficulty
    """
    if not candidates:
        raise ValueError("candidates list is empty")

    theta = logit(_clip(p_known))
    scored = []

    for cand in candidates:
        difficulty = float(cand["difficulty"])
        discrimination = float(cand.get("discrimination", 1.0))
        p_correct = combined_p_correct(p_known, difficulty, discrimination)

        # Proximity score: 1 / (1 + distance from target)
        distance = abs(p_correct - target)
        proximity = 1.0 / (1.0 + distance * 10.0)

        scored.append({
            "id": cand["id"],
            "difficulty": difficulty,
            "discrimination": discrimination,
            "skill": cand.get("skill", ""),
            "p_correct": round(p_correct, 4),
            "proximity": proximity,
        })

    # Sort by proximity to target (closest wins)
    scored.sort(key=lambda x: x["proximity"], reverse=True)

    # Return the best match
    best = scored[0]
    return {
        "id": best["id"],
        "p_correct": best["p_correct"],
        "difficulty": best["difficulty"],
        "skill": best["skill"],
    }


def choose_with_diversity(
    p_known_by_skill: dict[str, float],  # skill → p_known
    candidates: list[dict],  # [{id, difficulty, skill, discrimination}]
    skill_counts: dict[str, int],  # skill → questions answered today
    target: float = 0.70,
    skill_weight: float = 0.3,  # Weight for skill selection vs ability match
) -> dict:
    """
    Extended selector that balances skill coverage.

    Prefers weaker skills that haven't been practiced much today,
    while still targeting the right difficulty level.

    Args:
        p_known_by_skill: Mastery per skill
        candidates: Candidate questions
        skill_counts: How many questions answered per skill today
        target: Target P(correct)
        skill_weight: How much to weight skill novelty vs difficulty match

    Returns:
        Selected question dict with id, p_correct, skill
    """
    if not candidates:
        raise ValueError("candidates list is empty")

    scored = []
    for cand in candidates:
        skill = cand.get("skill", "unknown")
        p_known = p_known_by_skill.get(skill, 0.30)
        difficulty = float(cand["difficulty"])
        discrimination = float(cand.get("discrimination", 1.0))

        p_correct = combined_p_correct(p_known, difficulty, discrimination)
        distance = abs(p_correct - target)
        ability_score = 1.0 / (1.0 + distance * 10.0)

        # Novelty: fewer answers on this skill today → higher priority
        count = skill_counts.get(skill, 0)
        novelty_score = 1.0 / (1.0 + count * 0.5)

        # Weakness: lower p_known → higher priority
        weakness_score = 1.0 - p_known

        combined = (
            (1.0 - skill_weight) * ability_score
            + skill_weight * (0.5 * novelty_score + 0.5 * weakness_score)
        )

        scored.append({
            "id": cand["id"],
            "skill": skill,
            "difficulty": difficulty,
            "p_correct": round(p_correct, 4),
            "score": round(combined, 4),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    best = scored[0]
    return {
        "id": best["id"],
        "p_correct": best["p_correct"],
        "skill": best["skill"],
        "difficulty": best["difficulty"],
    }
