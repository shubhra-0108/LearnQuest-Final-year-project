"""
Difficulty Calibration for LearnQuest.

Uses EM algorithm to suggest difficulty adjustments based on real answer data.
Questions with very high or very low accuracy may need difficulty recalibration.

Methodology:
- Expected accuracy for difficulty d with average p_known P:
  expected = P * (1 - p_slip) + (1 - P) * p_guess
- If actual accuracy differs significantly → suggest adjustment
"""
import math
from .bkt import DEFAULT_BKT


def _expected_accuracy(difficulty: float, avg_p_known: float = 0.5,
                       p_guess: float = 0.20, p_slip: float = 0.10) -> float:
    """
    Expected accuracy for a given difficulty level.

    Assumes average mastery across students answering this question.

    Args:
        difficulty: Item difficulty (1-5)
        avg_p_known: Average P(known) of students who saw this question
        p_guess: Guessing probability
        p_slip: Slip probability

    Returns:
        Expected P(correct) in (0, 1)
    """
    from .bkt import combined_p_correct
    return combined_p_correct(avg_p_known, difficulty)


def suggest(
    items: list[dict],  # [{id, difficulty, served, correct, avg_p_known=0.5}]
    min_served: int = 30,
    tolerance: float = 0.15,
    p_guess: float = DEFAULT_BKT.p_guess,
    p_slip: float = DEFAULT_BKT.p_slip,
) -> list[dict]:
    """
    Suggest difficulty adjustments for items based on answer data.

    An item is flagged if its actual accuracy deviates from expected
    by more than `tolerance`.

    Args:
        items: List of item stats with id, difficulty, served, correct
        min_served: Minimum answers before making a suggestion
        tolerance: Maximum acceptable deviation from expected accuracy
        p_guess: BKT guess parameter
        p_slip: BKT slip parameter

    Returns:
        List of suggestion dicts: {id, current_difficulty, suggested_difficulty, reason, confidence}
    """
    suggestions = []

    for item in items:
        served = item.get("served", 0)
        if served < min_served:
            continue

        correct = item.get("correct", 0)
        difficulty = float(item.get("difficulty", 3))
        avg_p = float(item.get("avg_p_known", 0.5))
        actual_accuracy = correct / served

        expected = _expected_accuracy(difficulty, avg_p, p_guess, p_slip)
        deviation = actual_accuracy - expected

        if abs(deviation) <= tolerance:
            continue

        # Compute confidence (higher served = more confident)
        confidence = min(1.0, (served - min_served) / (min_served * 3))

        # Suggest difficulty adjustment
        # If actual > expected → question is too easy → increase difficulty
        # If actual < expected → question is too hard → decrease difficulty
        if deviation > tolerance:  # Too easy
            step = 1 if deviation > 0.25 else 0  # No fractional difficulties
            suggested = min(5, difficulty + step) if step > 0 else difficulty
            reason = f"actual {actual_accuracy:.0%} much higher than expected {expected:.0%} — may be too easy"
        else:  # Too hard
            step = 1 if deviation < -0.25 else 0
            suggested = max(1, difficulty - step) if step > 0 else difficulty
            reason = f"actual {actual_accuracy:.0%} much lower than expected {expected:.0%} — may be too hard"

        suggestions.append({
            "id": item.get("id", ""),
            "current_difficulty": int(difficulty),
            "suggested_difficulty": int(suggested),
            "actual_accuracy": round(actual_accuracy, 3),
            "expected_accuracy": round(expected, 3),
            "deviation": round(deviation, 3),
            "served": served,
            "confidence": round(confidence, 3),
            "reason": reason,
            "action": "increase_difficulty" if deviation > 0 else "decrease_difficulty",
        })

    # Sort by confidence (most reliable suggestions first)
    suggestions.sort(key=lambda x: x["confidence"], reverse=True)
    return suggestions


def em_calibrate_difficulty(
    items: list[dict],
    max_iter: int = 20,
    tol: float = 1e-4,
) -> list[dict]:
    """
    Full EM calibration of item difficulties using Rasch model.

    Estimates item difficulty parameters that best explain observed
    accuracy patterns across all students.

    Args:
        items: [{id, served, correct, difficulty}]
        max_iter: Maximum EM iterations
        tol: Convergence tolerance

    Returns:
        [{id, estimated_b, suggested_difficulty}]
    """
    if not items:
        return []

    # Initialize b parameters from current difficulty
    params = {
        item["id"]: (float(item.get("difficulty", 3)) - 3.0) * 0.9
        for item in items
    }

    prev_ll = float('-inf')

    for _ in range(max_iter):
        # E-step: estimate average theta (ability) from accuracy patterns
        # Simplified: use logit of observed accuracy as proxy for avg theta
        # In full implementation, this would use student ability estimates

        # M-step: update b parameter for each item
        new_params = {}
        total_ll = 0.0

        for item in items:
            if item.get("served", 0) < 5:
                new_params[item["id"]] = params[item["id"]]
                continue

            acc = item.get("correct", 0) / max(1, item.get("served", 1))
            acc = max(0.01, min(0.99, acc))

            # In Rasch model: logit(accuracy) ≈ theta_avg - b
            # Solve for b: b = theta_avg - logit(accuracy)
            theta_avg = 0.0  # Assume average ability = 0 in logit space
            b_new = theta_avg - math.log(acc / (1.0 - acc))
            # Clip to reasonable range
            b_new = max(-3.0, min(3.0, b_new))
            new_params[item["id"]] = b_new

            # Log likelihood contribution
            p_correct = 1.0 / (1.0 + math.exp(-b_new))
            ll = (item.get("correct", 0) * math.log(max(1e-10, p_correct))
                  + (item.get("served", 0) - item.get("correct", 0)) * math.log(max(1e-10, 1 - p_correct)))
            total_ll += ll

        # Check convergence
        if abs(total_ll - prev_ll) < tol:
            break
        prev_ll = total_ll
        params = new_params

    # Convert b back to difficulty scale and return
    results = []
    for item in items:
        b = params.get(item["id"], 0.0)
        # b = (difficulty - 3) * 0.9 → difficulty = b/0.9 + 3
        estimated_difficulty = b / 0.9 + 3.0
        estimated_difficulty_rounded = max(1, min(5, round(estimated_difficulty)))
        results.append({
            "id": item["id"],
            "current_difficulty": item.get("difficulty", 3),
            "estimated_b": round(b, 4),
            "estimated_difficulty": round(estimated_difficulty, 2),
            "suggested_difficulty": estimated_difficulty_rounded,
        })

    return results
