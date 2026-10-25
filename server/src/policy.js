// Platform policy constants — the single source of truth for game rules.
// Both server routes and the ML service fallback use these values.

export const policy = {
  // Reward points
  baseCorrect: 2,            // Base points for a correct answer
  effortCap: 10,             // Max effort (wrong-answer) points per day
  streakBonus: 10,           // Bonus for completing streakCount questions
  streakCount: 5,            // Questions needed to trigger streak bonus
  streakMinCorrect: 3,       // Min correct within streak to earn bonus
  improveBonus: 15,          // Bonus for improving a skill today
  improveDelta: 0.05,        // Minimum P(known) increase to count as improvement
  dailyCap: 100,             // Max points earnable per day

  // Anti-cheat
  minMs: 1500,               // Answers under this are flagged as too fast

  // Payouts
  pointsPerRupee: 10,        // 10 points = ₹1
  minPayoutRs: 50,           // Minimum payout in rupees
  maxPayoutRs: 500,          // Maximum single payout

  // Data retention
  retentionDays: 180,        // Attempt records auto-delete after this many days

  // PIN security
  maxPinFails: 5,            // Lock account after this many wrong PINs
  pinLockMinutes: 10,        // Lock duration in minutes

  // XP / Leveling (separate from points — cosmetic progression)
  xpPerPoint: 2,             // XP gained per point earned
  xpLevels: [
    0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250,
    3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450, 11500,
    12600, 13750, 14950, 16200, 17500, 18850, 20250, 21700, 23200, 24750,
    26350, 28000, 29700, 31450, 33250, 35100, 37000, 38950, 40950, 43000,
    45100, 47250, 49450, 51700, 54000, 56350, 58750, 61200, 63700,
  ], // XP required to REACH each level (index = level number)
};

// BKT parameters — must match Python ml-service/app/bkt.py DEFAULT params
export const bkt = {
  pInit: 0.30,
  pTransit: 0.15,
  pSlip: 0.10,
  pGuess: 0.20,
};

// Subject definitions with bilingual names
export const SUBJECTS = {
  math: { en: 'Mathematics', hi: 'गणित', emoji: '🔢' },
  science: { en: 'Science', hi: 'विज्ञान', emoji: '🔬' },
};

// Skill prerequisite graph (mirrors Python recommendations.py)
export const SKILL_PREREQUISITES = {
  'math.muldiv': ['math.addsub'],
  'math.fractions': ['math.muldiv'],
  'math.decimals': ['math.fractions'],
  'math.percentages': ['math.decimals'],
  'math.algebra': ['math.fractions', 'math.decimals'],
  'math.geometry': ['math.addsub'],
  'math.mensuration': ['math.geometry', 'math.fractions'],
  'math.statistics': ['math.muldiv', 'math.fractions'],
  'sci.matter': ['sci.life'],
  'sci.energy': ['sci.matter'],
  'sci.environment': ['sci.life'],
  'sci.chemistry': ['sci.matter', 'sci.energy'],
  'sci.physics': ['sci.energy'],
};

// Achievement definitions (populated in DB by seed, referenced here for reference)
export const ACHIEVEMENT_CODES = {
  FIRST_CORRECT: 'first_correct',
  TEN_CORRECT: 'ten_correct',
  FIFTY_CORRECT: 'fifty_correct',
  HUNDRED_CORRECT: 'hundred_correct',
  FIVE_HUNDRED_CORRECT: 'five_hundred_correct',
  STREAK_3: 'streak_3_days',
  STREAK_7: 'streak_7_days',
  STREAK_30: 'streak_30_days',
  SKILL_MASTERY_50: 'skill_mastery_50',
  SKILL_MASTERY_80: 'skill_mastery_80',
  SKILL_MASTERY_100: 'skill_mastery_100',
  FIRST_PAYOUT: 'first_payout',
  LEVEL_10: 'level_10',
  BILINGUAL: 'bilingual',
  EARLY_BIRD: 'early_bird',
};

// Get XP level for a given total XP amount
export function xpToLevel(totalXp) {
  const levels = policy.xpLevels;
  let level = 0;
  for (let i = 1; i < levels.length; i++) {
    if (totalXp >= levels[i]) level = i;
    else break;
  }
  return level;
}

// Get XP progress within current level
export function xpProgress(totalXp) {
  const level = xpToLevel(totalXp);
  const levels = policy.xpLevels;
  const currentLevelXp = levels[level] || 0;
  const nextLevelXp = levels[level + 1] || levels[levels.length - 1];
  const xpInLevel = totalXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  return { level, xpInLevel, xpNeeded, percent: Math.round((xpInLevel / xpNeeded) * 100) };
}
