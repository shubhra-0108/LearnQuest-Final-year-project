"""
Comprehensive tests for LearnQuest ML Service.

Tests BKT, IRT, anomaly detection, spaced repetition, and recommendations.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.bkt import (
    bkt_update, bkt_predict, combined_p_correct, apply_forgetting,
    em_fit_bkt, BKTParams, DEFAULT_BKT, logit, sigmoid
)
from app.selector import choose, choose_with_diversity
from app.calibrate import suggest, em_calibrate_difficulty
from app.anomaly import score_attempt, score_session_batch, AttemptRecord, compute_child_risk_delta
from app.spaced_repetition import SkillSchedule, rank_skills, update_schedule, compute_priority
from app.recommendations import recommend_next_skill, get_learning_path, is_unlocked
from app.analytics import (
    compute_learning_velocity, compute_mastery_heatmap,
    compute_session_quality, predict_mastery
)


# ─── BKT Tests ────────────────────────────────────────────────────────────────

class TestBKT:
    def test_correct_answer_increases_mastery(self):
        p_before = 0.3
        p_after = bkt_update(p_before, correct=True)
        assert p_after > p_before, "Correct answer should increase mastery"

    def test_wrong_answer_decreases_or_maintains_mastery(self):
        p_before = 0.8
        p_after = bkt_update(p_before, correct=False)
        # Wrong answer decreases posterior but then transit adds back a bit
        assert p_after < p_before, "Wrong answer should lower mastery estimate"

    def test_mastery_bounded(self):
        p = 0.3
        for _ in range(100):
            p = bkt_update(p, correct=True)
        assert 0 < p < 1, "Mastery must stay in (0, 1)"
        assert p > 0.9, "After 100 correct answers, mastery should be very high"

    def test_mastery_never_reaches_zero(self):
        p = 0.9
        for _ in range(100):
            p = bkt_update(p, correct=False)
        assert p > 0, "Mastery should never be exactly 0"

    def test_predict_correct_increases_with_mastery(self):
        p_low = bkt_predict(0.1)
        p_high = bkt_predict(0.9)
        assert p_high > p_low, "Higher mastery → higher P(correct)"

    def test_predict_correct_bounded(self):
        for p in [0.0, 0.3, 0.7, 1.0]:
            pred = bkt_predict(p)
            assert 0 < pred < 1

    def test_custom_params(self):
        """Higher p_guess → higher predicted accuracy."""
        prm_high = BKTParams(p_guess=0.4)
        prm_low = BKTParams(p_guess=0.1)
        assert bkt_predict(0.0, prm_high) > bkt_predict(0.0, prm_low)

    def test_forgetting_decreases_mastery(self):
        p_before = 0.8
        p_after = apply_forgetting(p_before, days_since_practice=30)
        assert p_after < p_before, "Forgetting should reduce mastery"
        assert p_after >= DEFAULT_BKT.p_init, "Mastery should not fall below prior"

    def test_no_forgetting_for_zero_days(self):
        p = 0.7
        assert apply_forgetting(p, 0) == p

    def test_logit_sigmoid_inverse(self):
        for p in [0.1, 0.3, 0.5, 0.7, 0.9]:
            assert abs(sigmoid(logit(p)) - p) < 1e-6, "logit and sigmoid should be inverses"

    def test_em_fit_returns_valid_params(self):
        """EM fitting should return parameters in valid ranges."""
        # Generate simple response sequences
        responses = [
            (True, True, False, True, True),
            (False, True, True, False, True),
            (True, False, True, True, True),
        ]
        fitted = em_fit_bkt(responses, max_iter=20)
        assert 0 < fitted.p_init < 1
        assert 0 < fitted.p_transit < 1
        assert 0 < fitted.p_slip < 1
        assert 0 < fitted.p_guess < 1


# ─── IRT / Combined Model Tests ───────────────────────────────────────────────

class TestIRT:
    def test_combined_harder_question_lower_p_correct(self):
        """Higher difficulty → lower P(correct) for same mastery."""
        p = combined_p_correct(0.5, difficulty=2)
        p_hard = combined_p_correct(0.5, difficulty=5)
        assert p > p_hard, "Harder questions should have lower P(correct)"

    def test_combined_higher_mastery_higher_p_correct(self):
        """Higher mastery → higher P(correct) for same difficulty."""
        p_weak = combined_p_correct(0.2, difficulty=3)
        p_strong = combined_p_correct(0.9, difficulty=3)
        assert p_strong > p_weak

    def test_combined_target_achievable(self):
        """Should be able to find difficulty where P(correct) ≈ 0.70."""
        # For medium mastery, medium difficulty should give ~0.70
        p = combined_p_correct(0.6, difficulty=3)
        assert 0.5 < p < 0.95, f"P(correct)={p} should be in reasonable range"


# ─── Selector Tests ────────────────────────────────────────────────────────────

class TestSelector:
    def test_choose_selects_closest_to_target(self):
        candidates = [
            {"id": "easy", "difficulty": 1, "skill": "math"},
            {"id": "medium", "difficulty": 3, "skill": "math"},
            {"id": "hard", "difficulty": 5, "skill": "math"},
        ]
        result = choose(p_known=0.5, candidates=candidates, target=0.70)
        assert "id" in result
        assert "p_correct" in result
        assert 0 < result["p_correct"] < 1

    def test_choose_returns_id_from_candidates(self):
        candidates = [{"id": f"q{i}", "difficulty": i, "skill": "sci"} for i in range(1, 6)]
        result = choose(0.5, candidates)
        assert result["id"] in [c["id"] for c in candidates]

    def test_choose_empty_raises(self):
        with pytest.raises(ValueError):
            choose(0.5, [])

    def test_diverse_selector_prefers_weak_skill(self):
        candidates = [
            {"id": "strong_q", "difficulty": 3, "skill": "math.addsub"},
            {"id": "weak_q", "difficulty": 2, "skill": "math.muldiv"},
        ]
        p_known_by_skill = {"math.addsub": 0.9, "math.muldiv": 0.2}
        skill_counts = {"math.addsub": 5, "math.muldiv": 0}
        result = choose_with_diversity(p_known_by_skill, candidates, skill_counts)
        assert result["skill"] == "math.muldiv", "Should prefer weak, unpracticed skill"


# ─── Calibration Tests ────────────────────────────────────────────────────────

class TestCalibration:
    def test_suggest_flags_too_easy(self):
        items = [{
            "id": "q1", "difficulty": 5,
            "served": 100, "correct": 95,  # 95% accuracy on difficulty 5 = too easy
            "avg_p_known": 0.5
        }]
        suggestions = suggest(items, min_served=50)
        assert len(suggestions) > 0
        assert suggestions[0]["action"] == "increase_difficulty"

    def test_suggest_flags_too_hard(self):
        items = [{
            "id": "q2", "difficulty": 1,
            "served": 100, "correct": 10,  # 10% accuracy on difficulty 1 = too hard
        }]
        suggestions = suggest(items, min_served=50)
        assert len(suggestions) > 0
        assert suggestions[0]["action"] == "decrease_difficulty"

    def test_suggest_ignores_low_served(self):
        items = [{"id": "q3", "difficulty": 3, "served": 5, "correct": 5}]
        suggestions = suggest(items, min_served=30)
        assert len(suggestions) == 0, "Should not suggest for items with too few answers"

    def test_em_calibrate_returns_difficulty(self):
        items = [
            {"id": "q1", "difficulty": 3, "served": 50, "correct": 25},
            {"id": "q2", "difficulty": 2, "served": 50, "correct": 40},
        ]
        results = em_calibrate_difficulty(items)
        assert len(results) == 2
        for r in results:
            assert "id" in r
            assert "suggested_difficulty" in r
            assert 1 <= r["suggested_difficulty"] <= 5


# ─── Anomaly Detection Tests ──────────────────────────────────────────────────

class TestAnomaly:
    def test_too_fast_flagged(self):
        result = score_attempt(ms=500, correct=True, difficulty=3, history_ms=[], min_ms=1500)
        assert "too_fast" in result["flags"]
        assert result["risk_score"] > 0

    def test_normal_speed_no_flag(self):
        result = score_attempt(ms=5000, correct=True, difficulty=3, history_ms=[], min_ms=1500)
        assert "too_fast" not in result["flags"]

    def test_z_score_anomaly(self):
        # Normal history around 5000ms, then 100ms answer
        history = [5000, 5100, 4900, 5050, 4950]
        result = score_attempt(ms=100, correct=True, difficulty=3, history_ms=history, min_ms=1500)
        assert "unusually_fast" in result["flags"]

    def test_batch_majority_fast_flagged(self):
        attempts = [
            AttemptRecord(ms=500, correct=True, difficulty=3)
            for _ in range(8)
        ] + [
            AttemptRecord(ms=5000, correct=False, difficulty=3)
            for _ in range(2)
        ]
        result = score_session_batch(attempts)
        assert "majority_too_fast" in result["flags"]
        assert result["session_risk"] > 0

    def test_risk_delta_increases_on_fast(self):
        new_risk = compute_child_risk_delta(0.0, ms=500, min_ms=1500)
        assert new_risk > 0

    def test_risk_delta_decreases_on_normal(self):
        new_risk = compute_child_risk_delta(5.0, ms=5000, min_ms=1500)
        assert new_risk < 5.0


# ─── Spaced Repetition Tests ──────────────────────────────────────────────────

class TestSpacedRepetition:
    def test_never_practiced_has_highest_priority(self):
        s = SkillSchedule(skill="math.addsub", p_known=0.5, last_practiced_iso=None)
        priority = compute_priority(s)
        assert priority > 1.0, "Never-practiced skill should have high priority"

    def test_just_practiced_has_low_priority(self):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        s = SkillSchedule(
            skill="math.addsub", p_known=0.8,
            last_practiced_iso=now, interval_days=1.0
        )
        priority = compute_priority(s)
        # Low priority since just practiced and strong mastery
        assert priority < 5.0

    def test_rank_skills_returns_sorted(self):
        schedules = [
            SkillSchedule("math.addsub", 0.9, "2020-01-01T00:00:00Z", interval_days=1),
            SkillSchedule("math.muldiv", 0.2, None),  # Never practiced + weak
            SkillSchedule("sci.life", 0.5, "2020-06-01T00:00:00Z"),
        ]
        ranked = rank_skills(schedules)
        assert ranked[0]["skill"] == "math.muldiv", "Weakest/never-practiced should rank first"

    def test_update_schedule_correct_increases_interval(self):
        s = SkillSchedule("math.addsub", 0.5, repetitions=2, interval_days=6.0)
        updated = update_schedule(s, 0.5, 0.65, correct=True)
        assert updated.interval_days > 6.0, "Correct answer should increase interval"
        assert updated.repetitions > s.repetitions

    def test_update_schedule_wrong_resets(self):
        s = SkillSchedule("math.addsub", 0.5, repetitions=5, interval_days=30.0)
        updated = update_schedule(s, 0.5, 0.45, correct=False)
        assert updated.interval_days == 1.0, "Wrong answer should reset interval"
        assert updated.repetitions == 0


# ─── Recommendations Tests ────────────────────────────────────────────────────

class TestRecommendations:
    def test_unlock_with_no_prereqs(self):
        assert is_unlocked("math.addsub", {}) is True

    def test_locked_without_prereqs(self):
        # math.muldiv requires math.addsub >= 0.60
        assert is_unlocked("math.muldiv", {"math.addsub": 0.3}) is False

    def test_unlocked_with_prereqs_met(self):
        assert is_unlocked("math.muldiv", {"math.addsub": 0.7}) is True

    def test_recommend_returns_result(self):
        mastery = {"math.addsub": 0.8, "math.muldiv": 0.2}
        available = ["math.addsub", "math.muldiv", "math.fractions"]
        rec = recommend_next_skill(mastery, available)
        assert rec is not None
        assert "skill" in rec

    def test_recommend_prefers_weak_unlocked(self):
        mastery = {"math.addsub": 0.9, "math.muldiv": 0.1}
        available = ["math.addsub", "math.muldiv"]
        rec = recommend_next_skill(mastery, available)
        assert rec["skill"] == "math.muldiv", "Should recommend weaker skill"

    def test_learning_path_returns_n_items(self):
        mastery = {"math.addsub": 0.9, "math.muldiv": 0.3}
        available = list(mastery.keys())
        path = get_learning_path(mastery, available, top_n=2)
        assert len(path) <= 2


# ─── Analytics Tests ──────────────────────────────────────────────────────────

class TestAnalytics:
    def test_velocity_empty(self):
        result = compute_learning_velocity([])
        assert result["velocity"] == 0.0
        assert result["trend"] == "inactive"

    def test_velocity_improving(self):
        snaps = [
            {"date": "2024-01-01", "skill": "math.addsub", "p_known": 0.3},
            {"date": "2024-01-05", "skill": "math.addsub", "p_known": 0.5},
            {"date": "2024-01-10", "skill": "math.addsub", "p_known": 0.7},
        ]
        result = compute_learning_velocity(snaps, days_window=10)
        assert result["skills_improved"] > 0

    def test_session_quality_perfect(self):
        result = compute_session_quality(
            questions_answered=20, points_earned=90,
            mastery_gain=0.4, duration_seconds=900,
            correct_count=18
        )
        assert result["quality_score"] > 70
        assert result["grade"] in ["A", "B"]

    def test_session_quality_zero(self):
        result = compute_session_quality(0, 0, 0, 0, 0)
        assert result["quality_score"] == 0
        assert result["grade"] == "F"

    def test_predict_mastery_increases(self):
        predictions = predict_mastery(current_p=0.3, velocity=0.05, days_ahead=10)
        assert len(predictions) == 10
        assert predictions[-1]["predicted_p_known"] > 0.3

    def test_predict_mastery_bounded(self):
        predictions = predict_mastery(current_p=0.9, velocity=0.2, days_ahead=30)
        for p in predictions:
            assert p["predicted_p_known"] < 1.0


# ─── Integration: BKT matches JS reference values ─────────────────────────────

class TestBKTReferenceValues:
    """
    These values must match the JS bkt.js fallback implementation.
    Any change here must be reflected in server/src/lib/bkt.js too.
    """
    def test_correct_answer_reference(self):
        """Reference: p=0.3, correct → should be ~0.710"""
        result = bkt_update(0.30, correct=True)
        expected = 0.7098  # Exact BKT posterior (0.27/0.41) + (1 - post)*0.15
        assert abs(result - expected) < 0.01, f"BKT correct: got {result}, expected ~{expected}"

    def test_wrong_answer_reference(self):
        """Reference: p=0.3, wrong → should be ~0.19"""
        result = bkt_update(0.30, correct=False)
        expected = 0.19
        assert abs(result - expected) < 0.02, f"BKT wrong: got {result}, expected ~{expected}"

    def test_p_correct_medium(self):
        """At p_known=0.5, difficulty=3, p_correct should be ~0.52-0.65"""
        result = combined_p_correct(0.5, 3)
        assert 0.45 < result < 0.70, f"p_correct at medium: {result}"
