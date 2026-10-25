import { policy, xpToLevel } from '../policy.js';

/**
 * Pure scoring function: determines point award, effort points, streaks, and XP.
 */
export function scoreAttempt({
  correct,
  difficulty,
  ms,
  skill,
  day,
  dayStartP,
  pAfter,
  currentXp = 0,
}) {
  const parts = { base: 0, effort: 0, streak: 0, improve: 0 };
  const flags = [];
  const fast = ms < policy.minMs;
  if (fast) flags.push('too_fast');

  // Base correct points: 2 + question difficulty (1-5)
  if (!fast && correct) {
    parts.base = policy.baseCorrect + difficulty;
  } else if (!fast && !correct && (day.effort || 0) < policy.effortCap) {
    // 1 effort point for considered wrong answers
    parts.effort = 1;
  }

  const answered = (day.answered || 0) + 1;
  const correctCount = (day.correct || 0) + (correct ? 1 : 0);

  // Daily streak milestone bonus (+10 points once after 5 questions with >=3 correct)
  if (!fast && !day.streakPaid && answered >= policy.streakCount && correctCount >= policy.streakMinCorrect) {
    parts.streak = policy.streakBonus;
  }

  // Mastery improvement bonus (+15 points once per skill per day if delta >= 0.05)
  const improved = day.improvedSkills || [];
  if (!fast && correct && !improved.includes(skill) && pAfter - dayStartP >= policy.improveDelta) {
    parts.improve = policy.improveBonus;
  }

  const total = parts.base + parts.effort + parts.streak + parts.improve;
  const currentPoints = day.points || 0;
  const room = Math.max(0, policy.dailyCap - currentPoints);
  const grant = Math.min(total, room);

  if (total > room) flags.push('daily_cap');

  // Game XP progression (XP is permanent and not capped by daily money limit)
  const xpGained = fast ? 0 : correct ? (10 + difficulty * 5) : 5;
  const newTotalXp = currentXp + xpGained;
  const oldLevel = xpToLevel(currentXp);
  const newLevel = xpToLevel(newTotalXp);
  const levelUp = newLevel > oldLevel;

  return {
    grant,
    parts,
    flags,
    xpGained,
    newTotalXp,
    levelUp,
    newLevel,
    dayAfter: {
      points: currentPoints + grant,
      answered,
      correct: correctCount,
      effort: (day.effort || 0) + (parts.effort ? 1 : 0),
      streakPaid: day.streakPaid || parts.streak > 0,
      improvedSkills: parts.improve ? [...improved, skill] : improved,
    },
  };
}

export const pointsToRupees = (pts) => Math.floor(pts / policy.pointsPerRupee);

export function payoutQuote(points) {
  const rs = Math.min(pointsToRupees(points), policy.maxPayoutRs);
  return {
    rs,
    points: rs * policy.pointsPerRupee,
    ok: rs >= policy.minPayoutRs,
  };
}
