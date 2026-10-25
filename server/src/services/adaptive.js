import { config } from '../config.js';
import * as localBkt from '../lib/bkt.js';
import { logger } from '../lib/logger.js';

const mlBase = config.mlUrl.replace(/\/$/, '');

async function postMl(path, body) {
  const url = `${mlBase}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.mlApiKey) {
    headers['X-API-Key'] = config.mlApiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2000), // 2s timeout
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`ML service error ${res.status}: ${errorText}`);
  }
  return res.json();
}

/**
 * Trace (update) mastery using ML service, with automatic local BKT fallback.
 */
export async function trace(pKnown, correct, daysSincePractice = 0) {
  try {
    const data = await postMl('/v1/trace', {
      p_known: pKnown,
      correct: Boolean(correct),
      days_since_practice: daysSincePractice,
    });
    return data.p_known_next;
  } catch (err) {
    logger.warn(`ML service trace failed, falling back to local BKT: ${err.message}`);
    const decayed = localBkt.applyForgetting(pKnown, daysSincePractice);
    return localBkt.update(decayed, correct);
  }
}

/**
 * Choose next adaptive question targeting ~70% P(correct).
 */
export async function chooseNext({ pKnown, candidates, target = 0.70 }) {
  try {
    const data = await postMl('/v1/next', {
      p_known: pKnown,
      candidates: candidates.map(c => ({
        id: String(c.id),
        difficulty: Number(c.difficulty),
        discrimination: Number(c.discrimination || 1.0),
        skill: c.skill || '',
      })),
      target,
    });
    return data;
  } catch (err) {
    logger.warn(`ML service chooseNext failed, falling back to local selector: ${err.message}`);
    return localBkt.chooseLocal(pKnown, candidates, target);
  }
}

/**
 * Score attempt for anomaly / anti-cheat.
 */
export async function scoreAnomaly({ ms, correct, difficulty, historyMs = [], currentRisk = 0 }) {
  try {
    return await postMl('/v1/anomaly/score', {
      ms,
      correct,
      difficulty,
      history_ms: historyMs,
      current_risk: currentRisk,
    });
  } catch (err) {
    // Basic local rule: if under minMs, flag too_fast and bump risk
    const tooFast = ms < 1500;
    return {
      risk_score: tooFast ? 0.3 : 0.0,
      flags: tooFast ? ['too_fast'] : [],
      new_child_risk: Math.max(0, currentRisk + (tooFast ? 1.0 : -0.1)),
    };
  }
}

/**
 * Calibrate question difficulties from performance data.
 */
export async function calibrate(items) {
  try {
    return await postMl('/v1/calibrate', { items });
  } catch (err) {
    logger.warn(`ML service calibrate failed: ${err.message}`);
    return { suggestions: [], note: 'ML service offline' };
  }
}

/**
 * Next-skill recommendation based on prerequisite DAG.
 */
export async function recommendSkill({ mastery, availableSkills, language = 'en' }) {
  try {
    const res = await postMl('/v1/recommend', {
      mastery,
      available_skills: availableSkills,
      language,
    });
    return res.recommendation;
  } catch (err) {
    logger.warn(`ML service recommend failed: ${err.message}`);
    return null;
  }
}

/**
 * Learning velocity and analytics.
 */
export async function getLearningVelocity(masterySnapshots, daysWindow = 7) {
  try {
    return await postMl('/v1/analytics/velocity', {
      mastery_snapshots: masterySnapshots,
      days_window: daysWindow,
    });
  } catch (err) {
    return { velocity: 0, trend: 'steady', error: err.message };
  }
}
