"""
Bayesian Knowledge Tracing (BKT) + Rasch/2PL Item Response Theory

These are the core ML algorithms for LearnQuest's adaptive learning engine.
BKT estimates P(skill known) from answer history.
IRT provides item-level calibration (difficulty + discrimination).
Forgetting curve applies Ebbinghaus-style decay for unused skills.

Reference:
  Corbett & Anderson (1994) — Knowledge Tracing
  Rasch (1960) — Item Response Theory
"""
from dataclasses import dataclass
import math


@dataclass(frozen=True)
class BKTParams:
    """Standard BKT parameters."""
    p_init: float = 0.30      # Prior probability skill is known at start
    p_transit: float = 0.15   # P(learn after each attempt)
    p_slip: float = 0.10      # P(wrong answer | skill known)
    p_guess: float = 0.20     # P(correct answer | skill not known)


@dataclass(frozen=True)
class IRTParams:
    """2-Parameter Logistic IRT parameters."""
    discrimination: float = 1.0   # 'a' parameter — how well item differentiates
    difficulty: float = 0.0       # 'b' parameter — logit-scale difficulty


DEFAULT_BKT = BKTParams()
FORGET_LAMBDA = 0.05  # Forgetting rate per day (Ebbinghaus)


def _clip(x: float, lo: float = 0.001, hi: float = 0.999) -> float:
    return max(lo, min(hi, x))


def logit(p: float) -> float:
    """Convert probability to log-odds."""
    p = _clip(p)
    return math.log(p / (1.0 - p))


def sigmoid(x: float) -> float:
    """Logistic function."""
    return 1.0 / (1.0 + math.exp(-x))


# ─── Bayesian Knowledge Tracing ───────────────────────────────────────────────

def bkt_update(p_known: float, correct: bool, prm: BKTParams = DEFAULT_BKT) -> float:
    """
    Update P(skill known) after observing one answer.

    Uses Bayes' theorem to compute posterior, then adds the probability
    of learning from the current attempt.

    Args:
        p_known: Prior P(skill known) in [0, 1]
        correct: Whether the student answered correctly
        prm: BKT parameter set

    Returns:
        Updated P(skill known) in (0.001, 0.999)
    """
    if correct:
        # P(correct | known) = 1 - p_slip
        # P(correct | not known) = p_guess
        numerator = p_known * (1.0 - prm.p_slip)
        denominator = numerator + (1.0 - p_known) * prm.p_guess
    else:
        # P(wrong | known) = p_slip
        # P(wrong | not known) = 1 - p_guess
        numerator = p_known * prm.p_slip
        denominator = numerator + (1.0 - p_known) * (1.0 - prm.p_guess)

    if denominator < 1e-10:
        posterior = p_known  # Numerical safety
    else:
        posterior = numerator / denominator

    # Add learning probability (P of transitioning from not-known to known)
    p_next = posterior + (1.0 - posterior) * prm.p_transit
    return _clip(p_next)


def bkt_predict(p_known: float, prm: BKTParams = DEFAULT_BKT) -> float:
    """
    Predict P(next answer is correct) given current mastery estimate.

    Args:
        p_known: Current P(skill known)
        prm: BKT parameter set

    Returns:
        P(correct) in (0, 1)
    """
    return p_known * (1.0 - prm.p_slip) + (1.0 - p_known) * prm.p_guess


# ─── Item Response Theory (2PL) ───────────────────────────────────────────────

def difficulty_to_b(difficulty: float) -> float:
    """
    Convert 1–5 difficulty scale to IRT b-parameter (logit scale).
    difficulty=1 → b≈-1.8, difficulty=3 → b≈0, difficulty=5 → b≈+1.8
    """
    return (difficulty - 3.0) * 0.9


def irt_predict(theta: float, difficulty: float, discrimination: float = 1.0,
                p_guess: float = 0.20, p_slip: float = 0.10) -> float:
    """
    2PL IRT: predict P(correct) given ability (theta) and item parameters.

    P(correct) = c + (1 - c - s) * σ(1.7 * a * (θ - b))
    where c=p_guess, s=p_slip, a=discrimination, b=difficulty_b

    Args:
        theta: Student ability in logit space (from logit(p_known))
        difficulty: Item difficulty on 1–5 scale
        discrimination: Item discrimination 'a' parameter
        p_guess: Lower asymptote (guessing probability)
        p_slip: Upper asymptote reduction (slip probability)

    Returns:
        P(correct) in (0, 1)
    """
    b = difficulty_to_b(difficulty)
    z = 1.7 * discrimination * (theta - b)
    return p_guess + (1.0 - p_guess - p_slip) * sigmoid(z)


def combined_p_correct(p_known: float, difficulty: float,
                       discrimination: float = 1.0,
                       prm: BKTParams = DEFAULT_BKT) -> float:
    """
    Combine BKT mastery with IRT to get best P(correct) estimate.

    Uses p_known to derive theta, then applies full IRT model.

    Args:
        p_known: BKT mastery estimate
        difficulty: Question difficulty (1–5)
        discrimination: Item discrimination
        prm: BKT parameters

    Returns:
        P(correct) in (0, 1)
    """
    theta = logit(_clip(p_known))
    return irt_predict(theta, difficulty, discrimination, prm.p_guess, prm.p_slip)


# ─── Forgetting Curve (Ebbinghaus) ────────────────────────────────────────────

def apply_forgetting(p_known: float, days_since_practice: float,
                     decay_lambda: float = FORGET_LAMBDA) -> float:
    """
    Apply Ebbinghaus exponential forgetting decay.

    R = e^(-λ * t)  — retention after time t

    The mastery estimate decays toward the BKT prior (p_init) rather than
    to 0, since prior knowledge doesn't completely vanish.

    Args:
        p_known: Current mastery estimate
        days_since_practice: Days since last practice session
        decay_lambda: Decay rate (higher = faster forgetting)

    Returns:
        Adjusted p_known after forgetting
    """
    if days_since_practice <= 0:
        return p_known
    retention = math.exp(-decay_lambda * days_since_practice)
    # Decay toward p_init, not toward 0
    p_floor = DEFAULT_BKT.p_init
    p_adjusted = p_floor + (p_known - p_floor) * retention
    return _clip(p_adjusted)


# ─── EM Parameter Estimation ──────────────────────────────────────────────────

def em_fit_bkt(
    responses: list[tuple[bool, ...]],   # List of response sequences per student
    prm_init: BKTParams = DEFAULT_BKT,
    max_iter: int = 50,
    tol: float = 1e-4,
) -> BKTParams:
    """
    EM algorithm to fit BKT parameters from response data.

    Each element of `responses` is a tuple of bool (correct/wrong) for one student.
    Implements the Baum-Welch / Forward-Backward algorithm for HMM-based BKT.

    Args:
        responses: List of response sequences
        prm_init: Starting parameter estimates
        max_iter: Maximum EM iterations
        tol: Convergence tolerance on log-likelihood

    Returns:
        Fitted BKTParams
    """
    prm = prm_init
    prev_ll = float('-inf')

    for iteration in range(max_iter):
        # E-step: compute expected counts using forward algorithm
        sum_init_known = 0.0
        sum_init_total = 0.0
        sum_transit = 0.0
        sum_no_transit = 0.0
        sum_slip = 0.0
        sum_guess = 0.0
        sum_correct_known = 0.0
        sum_correct_unknown = 0.0
        total_ll = 0.0

        for seq in responses:
            if not seq:
                continue

            # Forward pass: alpha[t][state] = P(obs_1..t, state_t)
            T = len(seq)
            alpha = [[0.0, 0.0] for _ in range(T)]  # [not_known, known]
            scale = [0.0] * T

            # Initial
            for k in (0, 1):
                p_k = prm.p_init if k == 1 else (1.0 - prm.p_init)
                obs_prob = _obs_prob(seq[0], k, prm)
                alpha[0][k] = p_k * obs_prob
            scale[0] = sum(alpha[0]) or 1e-10
            alpha[0] = [a / scale[0] for a in alpha[0]]
            total_ll += math.log(scale[0])

            # Forward recursion
            for t in range(1, T):
                for k in (0, 1):
                    trans_from_0 = alpha[t-1][0] * (prm.p_transit if k == 1 else (1 - prm.p_transit))
                    trans_from_1 = alpha[t-1][1] * (1.0 if k == 1 else 0.0)
                    alpha[t][k] = (trans_from_0 + trans_from_1) * _obs_prob(seq[t], k, prm)
                scale[t] = sum(alpha[t]) or 1e-10
                alpha[t] = [a / scale[t] for a in alpha[t]]
                total_ll += math.log(scale[t])

            # Backward pass
            beta = [[1.0, 1.0] for _ in range(T)]
            for t in range(T-2, -1, -1):
                for k in (0, 1):
                    beta[t][k] = sum(
                        (prm.p_transit if kk == 1 and k == 0 else
                         (1 - prm.p_transit) if kk == 0 and k == 0 else
                         1.0 if kk == 1 and k == 1 else 0.0)
                        * _obs_prob(seq[t+1], kk, prm) * beta[t+1][kk]
                        for kk in (0, 1)
                    )
                    norm = sum(beta[t]) or 1e-10
                beta[t] = [b / norm for b in beta[t]]

            # Accumulate sufficient statistics
            gamma = [[alpha[t][k] * beta[t][k] for k in (0,1)] for t in range(T)]
            for t in range(T):
                g_sum = sum(gamma[t]) or 1e-10
                gamma[t] = [g / g_sum for g in gamma[t]]

            sum_init_known += gamma[0][1]
            sum_init_total += 1.0

            for t in range(T):
                if seq[t]:  # correct
                    sum_correct_known += gamma[t][1]
                    sum_guess += gamma[t][0]
                else:  # wrong
                    sum_slip += gamma[t][1]
                    sum_correct_unknown += gamma[t][0]

            for t in range(T-1):
                sum_transit += gamma[t][0]  # expected transitions from not-known

        # M-step: update parameters
        eps = 1e-6
        new_p_init = _clip(sum_init_known / (sum_init_total + eps))
        total_correct_known = sum_correct_known + eps
        total_slip_known = sum_slip + eps
        new_p_slip = _clip(total_slip_known / (total_correct_known + total_slip_known))
        total_correct_unknown = sum_guess + eps
        total_wrong_unknown = sum_correct_unknown + eps
        new_p_guess = _clip(total_correct_unknown / (total_correct_unknown + total_wrong_unknown))
        new_p_transit = _clip(sum_transit / (sum_transit + sum_no_transit + eps))

        prm = BKTParams(
            p_init=round(new_p_init, 4),
            p_transit=round(new_p_transit, 4),
            p_slip=round(new_p_slip, 4),
            p_guess=round(new_p_guess, 4),
        )

        # Check convergence
        if abs(total_ll - prev_ll) < tol:
            break
        prev_ll = total_ll

    return prm


def _obs_prob(correct: bool, state: int, prm: BKTParams) -> float:
    """P(observation | state) for BKT."""
    if state == 1:  # known
        return (1.0 - prm.p_slip) if correct else prm.p_slip
    else:  # not known
        return prm.p_guess if correct else (1.0 - prm.p_guess)
