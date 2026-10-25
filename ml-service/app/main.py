import hmac
import os
import logging
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from .bkt import bkt_update, bkt_predict, combined_p_correct, apply_forgetting, em_fit_bkt, BKTParams, DEFAULT_BKT
from .selector import choose, choose_with_diversity
from .calibrate import suggest, em_calibrate_difficulty
from .anomaly import score_attempt, score_session_batch, AttemptRecord, compute_child_risk_delta
from .spaced_repetition import SkillSchedule, rank_skills, update_schedule
from .recommendations import recommend_next_skill, get_learning_path
from .analytics import (
    compute_learning_velocity, compute_mastery_heatmap,
    compute_session_quality, predict_mastery
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("learnquest-ml")

# ─── Auth ─────────────────────────────────────────────────────────────────────

def require_key(x_api_key: str | None = Header(default=None)):
    key = os.environ.get("ML_API_KEY", "")
    if key and not hmac.compare_digest(key, x_api_key or ""):
        raise HTTPException(status_code=401, detail="invalid api key")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LearnQuest ML Service",
    description="Adaptive learning ML microservice: BKT, IRT, Anomaly Detection, Spaced Repetition, Recommendations",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ────────────────────────────────────────────────

class TraceBody(BaseModel):
    p_known: float = Field(ge=0, le=1, description="Prior P(skill known)")
    correct: bool = Field(description="Whether the answer was correct")
    days_since_practice: Optional[float] = Field(default=0, ge=0, description="Days since last practice (for forgetting curve)")

class Candidate(BaseModel):
    id: str = Field(max_length=64)
    difficulty: float = Field(ge=1, le=5)
    discrimination: Optional[float] = Field(default=1.0, ge=0.1, le=3.0)
    skill: Optional[str] = Field(default="")

class NextBody(BaseModel):
    p_known: float = Field(ge=0, le=1)
    candidates: list[Candidate] = Field(min_length=1, max_length=500)
    target: float = Field(default=0.70, ge=0.5, le=0.9)

class NextDiverseBody(BaseModel):
    p_known_by_skill: dict[str, float] = Field(description="skill → p_known mapping")
    candidates: list[Candidate] = Field(min_length=1, max_length=500)
    skill_counts: Optional[dict[str, int]] = Field(default_factory=dict)
    target: float = Field(default=0.70)

class ItemStats(BaseModel):
    id: str
    served: int = Field(ge=0)
    correct: int = Field(ge=0)
    difficulty: float = Field(ge=1, le=5)
    avg_p_known: Optional[float] = Field(default=0.5, ge=0, le=1)

class CalibrateBody(BaseModel):
    items: list[ItemStats] = Field(max_length=2000)

class AnomalyBody(BaseModel):
    ms: int = Field(ge=0, description="Response time in ms")
    correct: bool
    difficulty: int = Field(ge=1, le=5)
    history_ms: Optional[list[int]] = Field(default_factory=list, max_length=100)
    current_risk: Optional[float] = Field(default=0.0, ge=0)
    min_ms: Optional[int] = Field(default=1500)

class AnomalyAttempt(BaseModel):
    ms: int = Field(ge=0)
    correct: bool
    difficulty: int = Field(ge=1, le=5)

class AnomalyBatchBody(BaseModel):
    attempts: list[AnomalyAttempt] = Field(max_length=200)
    min_ms: Optional[int] = Field(default=1500)

class SpacedBody(BaseModel):
    skills: list[dict] = Field(description="List of {skill, p_known, last_practiced_iso, ease_factor, interval_days, repetitions}")

class SpacedUpdateBody(BaseModel):
    skill: str
    p_known_before: float = Field(ge=0, le=1)
    p_known_after: float = Field(ge=0, le=1)
    correct: bool
    ease_factor: Optional[float] = Field(default=2.5, ge=1.3, le=3.0)
    interval_days: Optional[float] = Field(default=1.0, ge=0)
    repetitions: Optional[int] = Field(default=0, ge=0)
    last_practiced_iso: Optional[str] = None

class RecommendBody(BaseModel):
    mastery: dict[str, float] = Field(description="skill → p_known")
    available_skills: list[str] = Field(description="Skills with questions available in DB")
    language: Optional[str] = Field(default="en")

class LearningPathBody(BaseModel):
    mastery: dict[str, float]
    available_skills: list[str]
    language: Optional[str] = Field(default="en")
    top_n: Optional[int] = Field(default=5, ge=1, le=20)

class VelocityBody(BaseModel):
    mastery_snapshots: list[dict] = Field(description="[{date, skill, p_known}] oldest first")
    days_window: Optional[int] = Field(default=7, ge=1, le=90)

class HeatmapBody(BaseModel):
    mastery_snapshots: list[dict] = Field(description="[{date, skill, p_known}]")
    skills: Optional[list[str]] = None
    days: Optional[int] = Field(default=30, ge=7, le=90)

class SessionQualityBody(BaseModel):
    questions_answered: int = Field(ge=0)
    points_earned: int = Field(ge=0)
    mastery_gain: float = Field(ge=0)
    duration_seconds: int = Field(ge=0)
    correct_count: int = Field(ge=0)

class PredictMasteryBody(BaseModel):
    current_p: float = Field(ge=0, le=1)
    velocity: float = Field(ge=0)
    days_ahead: Optional[int] = Field(default=30, ge=1, le=365)

class EMFitBody(BaseModel):
    responses: list[list[bool]] = Field(description="Response sequences per student")
    max_iter: Optional[int] = Field(default=50, ge=5, le=200)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health", summary="Health check")
def health():
    return {"ok": True, "service": "learnquest-ml", "version": "2.0.0"}


@app.post("/v1/trace", dependencies=[Depends(require_key)], summary="BKT: update mastery after one answer")
def trace(b: TraceBody):
    """
    Update P(skill known) using Bayesian Knowledge Tracing.
    Optionally applies forgetting curve if days_since_practice > 0.
    """
    p = b.p_known
    if b.days_since_practice and b.days_since_practice > 0:
        p = apply_forgetting(p, b.days_since_practice)
    p_next = bkt_update(p, b.correct)
    return {
        "p_known_next": round(p_next, 4),
        "p_known_before_forgetting": round(b.p_known, 4),
        "p_known_after_forgetting": round(p, 4),
    }


@app.post("/v1/next", dependencies=[Depends(require_key)], summary="Select next adaptive question")
def next_item(b: NextBody):
    """
    Choose the best next question targeting ~target P(correct).
    Uses combined BKT + IRT model.
    """
    candidates = [c.model_dump() for c in b.candidates]
    pick = choose(b.p_known, candidates, b.target)
    return {
        "id": pick["id"],
        "p_correct": pick["p_correct"],
        "difficulty": pick["difficulty"],
        "skill": pick.get("skill", ""),
    }


@app.post("/v1/next-diverse", dependencies=[Depends(require_key)], summary="Select next question with skill diversity")
def next_item_diverse(b: NextDiverseBody):
    """
    Choose next question balancing skill coverage and difficulty matching.
    Prefers weak/underexplored skills.
    """
    candidates = [c.model_dump() for c in b.candidates]
    pick = choose_with_diversity(
        b.p_known_by_skill,
        candidates,
        b.skill_counts or {},
        b.target,
    )
    return pick


@app.post("/v1/predict", dependencies=[Depends(require_key)], summary="Predict P(correct) for given mastery and difficulty")
def predict(p_known: float, difficulty: float, discrimination: float = 1.0):
    """Predict probability of correct answer using combined BKT+IRT."""
    p = combined_p_correct(p_known, difficulty, discrimination)
    return {"p_correct": round(p, 4)}


@app.post("/v1/calibrate", dependencies=[Depends(require_key)], summary="Suggest difficulty calibration adjustments")
def calibrate(b: CalibrateBody):
    """
    Suggest difficulty adjustments based on real answer data.
    Returns items where actual accuracy deviates from expected.
    """
    items = [i.model_dump() for i in b.items]
    suggestions = suggest(items)
    em_results = em_calibrate_difficulty(items)
    return {
        "suggestions": suggestions,
        "em_calibration": em_results,
        "total_flagged": len(suggestions),
    }


@app.post("/v1/anomaly/score", dependencies=[Depends(require_key)], summary="Score one attempt for anomaly risk")
def anomaly_score(b: AnomalyBody):
    """
    Compute risk score for a single answer attempt.
    Returns flags for too-fast answers and Z-score anomalies.
    """
    result = score_attempt(
        b.ms, b.correct, b.difficulty,
        b.history_ms or [], b.min_ms or 1500
    )
    new_risk = compute_child_risk_delta(
        b.current_risk or 0.0, b.ms, b.min_ms or 1500
    )
    return {**result, "new_child_risk": new_risk}


@app.post("/v1/anomaly/batch", dependencies=[Depends(require_key)], summary="Score a session batch for anomaly risk")
def anomaly_batch(b: AnomalyBatchBody):
    """
    Score a batch of attempts from one session.
    Detects aggregate patterns like majority too-fast, impossible streaks.
    """
    attempts = [
        AttemptRecord(ms=a.ms, correct=a.correct, difficulty=a.difficulty)
        for a in b.attempts
    ]
    return score_session_batch(attempts, b.min_ms or 1500)


@app.post("/v1/spaced/rank", dependencies=[Depends(require_key)], summary="Rank skills by spaced repetition priority")
def spaced_rank(b: SpacedBody):
    """
    Rank skills by how urgently they need practice.
    Based on SM-2-inspired algorithm with forgetting curve.
    """
    schedules = []
    for s in b.skills:
        schedules.append(SkillSchedule(
            skill=s.get("skill", ""),
            p_known=float(s.get("p_known", 0.3)),
            last_practiced_iso=s.get("last_practiced_iso"),
            ease_factor=float(s.get("ease_factor", 2.5)),
            interval_days=float(s.get("interval_days", 1.0)),
            repetitions=int(s.get("repetitions", 0)),
        ))
    return {"ranked_skills": rank_skills(schedules)}


@app.post("/v1/spaced/update", dependencies=[Depends(require_key)], summary="Update spaced repetition schedule after practice")
def spaced_update(b: SpacedUpdateBody):
    """Update SM-2 schedule state after a practice session on a skill."""
    schedule = SkillSchedule(
        skill=b.skill,
        p_known=b.p_known_before,
        last_practiced_iso=b.last_practiced_iso,
        ease_factor=b.ease_factor or 2.5,
        interval_days=b.interval_days or 1.0,
        repetitions=b.repetitions or 0,
    )
    updated = update_schedule(schedule, b.p_known_before, b.p_known_after, b.correct)
    return {
        "skill": updated.skill,
        "ease_factor": updated.ease_factor,
        "interval_days": updated.interval_days,
        "repetitions": updated.repetitions,
        "next_review_days": updated.interval_days,
    }


@app.post("/v1/recommend", dependencies=[Depends(require_key)], summary="Recommend next skill to study")
def recommend(b: RecommendBody):
    """
    Recommend the most important skill to practice next.
    Considers mastery gaps, prerequisites, and learning path.
    """
    rec = recommend_next_skill(b.mastery, b.available_skills, b.language or "en")
    return {"recommendation": rec}


@app.post("/v1/learning-path", dependencies=[Depends(require_key)], summary="Get full learning path recommendations")
def learning_path(b: LearningPathBody):
    """Get top N skill recommendations ordered by learning priority."""
    path = get_learning_path(b.mastery, b.available_skills, b.language or "en", b.top_n or 5)
    return {"learning_path": path}


@app.post("/v1/analytics/velocity", dependencies=[Depends(require_key)], summary="Compute learning velocity")
def analytics_velocity(b: VelocityBody):
    """Compute how fast a student is gaining mastery over recent days."""
    return compute_learning_velocity(b.mastery_snapshots, b.days_window or 7)


@app.post("/v1/analytics/heatmap", dependencies=[Depends(require_key)], summary="Generate mastery heatmap data")
def analytics_heatmap(b: HeatmapBody):
    """Generate skill × day mastery heatmap for visualization."""
    return compute_mastery_heatmap(b.mastery_snapshots, b.skills, b.days or 30)


@app.post("/v1/analytics/session-quality", dependencies=[Depends(require_key)], summary="Score session quality")
def session_quality(b: SessionQualityBody):
    """Score the quality of a learning session."""
    return compute_session_quality(
        b.questions_answered, b.points_earned,
        b.mastery_gain, b.duration_seconds, b.correct_count
    )


@app.post("/v1/analytics/predict-mastery", dependencies=[Depends(require_key)], summary="Predict future mastery trajectory")
def analytics_predict(b: PredictMasteryBody):
    """Predict mastery trajectory for the next N days."""
    predictions = predict_mastery(b.current_p, b.velocity, b.days_ahead or 30)
    return {"predictions": predictions}


@app.post("/v1/em/fit", dependencies=[Depends(require_key)], summary="EM parameter fitting for BKT")
def em_fit(b: EMFitBody):
    """
    Fit BKT parameters from student response sequences using EM algorithm.
    Useful for adapting model to real classroom data.
    """
    if not b.responses:
        return {"params": DEFAULT_BKT.__dict__}
    try:
        fitted = em_fit_bkt(
            responses=[tuple(r) for r in b.responses],
            max_iter=b.max_iter or 50,
        )
        return {
            "params": {
                "p_init": fitted.p_init,
                "p_transit": fitted.p_transit,
                "p_slip": fitted.p_slip,
                "p_guess": fitted.p_guess,
            },
            "n_sequences": len(b.responses),
        }
    except Exception as e:
        logger.error(f"EM fit failed: {e}")
        return {"params": DEFAULT_BKT.__dict__, "error": str(e)}
