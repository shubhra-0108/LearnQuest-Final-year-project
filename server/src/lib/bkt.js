/**
 * BKT and IRT formulas mirroring the Python ML service.
 * Used as fallback when the ML service is unavailable.
 *
 * MUST stay in sync with ml-service/app/bkt.py
 * Test suite verifies both sides produce matching outputs.
 */

export const DEFAULT_BKT = {
  pInit: 0.30,
  pTransit: 0.15,
  pSlip: 0.10,
  pGuess: 0.20,
};

function clip(x, lo = 0.001, hi = 0.999) {
  return Math.max(lo, Math.min(hi, x));
}

export function logit(p) {
  p = clip(p);
  return Math.log(p / (1 - p));
}

export function sigmoid(x) {
  return 1.0 / (1.0 + Math.exp(-x));
}

/**
 * Update P(skill known) after one answer.
 * @param {number} pKnown - Prior mastery probability
 * @param {boolean} correct - Whether the answer was correct
 * @param {object} prm - BKT parameters
 * @returns {number} Updated P(skill known)
 */
export function update(pKnown, correct, prm = DEFAULT_BKT) {
  let numerator, denominator;
  if (correct) {
    numerator = pKnown * (1 - prm.pSlip);
    denominator = numerator + (1 - pKnown) * prm.pGuess;
  } else {
    numerator = pKnown * prm.pSlip;
    denominator = numerator + (1 - pKnown) * (1 - prm.pGuess);
  }
  const posterior = denominator > 1e-10 ? numerator / denominator : pKnown;
  return clip(posterior + (1 - posterior) * prm.pTransit);
}

/**
 * Convert 1–5 difficulty to IRT b-parameter.
 */
export function difficultyToB(difficulty) {
  return (difficulty - 3.0) * 0.9;
}

/**
 * Predict P(correct) using combined BKT + IRT model.
 * @param {number} pKnown - Current mastery
 * @param {number} difficulty - Item difficulty (1-5)
 * @param {number} discrimination - IRT 'a' parameter
 * @param {object} prm - BKT parameters
 */
export function predictCorrect(pKnown, difficulty, discrimination = 1.0, prm = DEFAULT_BKT) {
  const theta = logit(clip(pKnown));
  const b = difficultyToB(difficulty);
  const z = 1.7 * discrimination * (theta - b);
  return prm.pGuess + (1 - prm.pGuess - prm.pSlip) * sigmoid(z);
}

/**
 * Apply Ebbinghaus forgetting decay.
 * @param {number} pKnown - Current mastery
 * @param {number} daysSince - Days since last practice
 * @param {number} lambda - Decay rate
 */
export function applyForgetting(pKnown, daysSince, lambda = 0.05) {
  if (daysSince <= 0) return pKnown;
  const retention = Math.exp(-lambda * daysSince);
  const pFloor = DEFAULT_BKT.pInit;
  return clip(pFloor + (pKnown - pFloor) * retention);
}

/**
 * Choose best candidate question targeting target P(correct).
 * Local fallback for adaptive selection.
 */
export function chooseLocal(pKnown, candidates, target = 0.70) {
  if (!candidates.length) return null;
  let best = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const pCorrect = predictCorrect(pKnown, cand.difficulty);
    const dist = Math.abs(pCorrect - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = { ...cand, pCorrect: Math.round(pCorrect * 1000) / 1000 };
    }
  }
  return best;
}
