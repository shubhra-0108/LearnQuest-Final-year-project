import { Achievement, ChildAchievement, Notification, Attempt, Mastery, Child } from '../models/index.js';
import { ACHIEVEMENT_CODES } from '../policy.js';

export async function checkAndAwardAchievements(childId, context = {}) {
  const newlyAwarded = [];

  const existing = await ChildAchievement.find({ child: childId }).select('achievement').populate('achievement', 'code').lean();
  const alreadyEarnedCodes = new Set(existing.map(e => e.achievement?.code).filter(Boolean));

  const allAchievements = await Achievement.find().lean();
  const achByCode = Object.fromEntries(allAchievements.map(a => [a.code, a]));

  const child = await Child.findById(childId).lean();
  if (!child) return [];

  async function award(code) {
    if (alreadyEarnedCodes.has(code)) return;
    const ach = achByCode[code];
    if (!ach) return;

    try {
      await ChildAchievement.create({
        child: childId,
        achievement: ach._id,
      });
      alreadyEarnedCodes.add(code);
      newlyAwarded.push(ach);

      // Create in-app celebration notification
      await Notification.create({
        recipient: childId,
        recipientType: 'child',
        type: 'achievement',
        title: `Achievement Unlocked: ${ach.name.en}! 🏆`,
        message: ach.description.en,
        data: { achievement: ach },
      });

      // Grant XP reward
      if (ach.xpReward) {
        await Child.updateOne({ _id: childId }, { $inc: { xp: ach.xpReward } });
      }
    } catch (e) {
      // Ignore duplicate key race conditions
    }
  }

  // 1. First Correct
  if (context.correct) {
    await award(ACHIEVEMENT_CODES.FIRST_CORRECT);
  }

  // 2. Total correct attempts
  const totalCorrect = await Attempt.countDocuments({ child: childId, correct: true });
  if (totalCorrect >= 10) await award(ACHIEVEMENT_CODES.TEN_CORRECT);
  if (totalCorrect >= 50) await award(ACHIEVEMENT_CODES.FIFTY_CORRECT);
  if (totalCorrect >= 100) await award(ACHIEVEMENT_CODES.HUNDRED_CORRECT);
  if (totalCorrect >= 500) await award(ACHIEVEMENT_CODES.FIVE_HUNDRED_CORRECT);

  // 3. Streak badges
  const streak = child.streakDays || 0;
  if (streak >= 3) await award(ACHIEVEMENT_CODES.STREAK_3);
  if (streak >= 7) await award(ACHIEVEMENT_CODES.STREAK_7);
  if (streak >= 30) await award(ACHIEVEMENT_CODES.STREAK_30);

  // 4. Mastery badges
  const masteries = await Mastery.find({ child: childId }).lean();
  for (const m of masteries) {
    if (m.p >= 0.5) await award(ACHIEVEMENT_CODES.SKILL_MASTERY_50);
    if (m.p >= 0.8) await award(ACHIEVEMENT_CODES.SKILL_MASTERY_80);
    if (m.p >= 0.95) await award(ACHIEVEMENT_CODES.SKILL_MASTERY_100);
  }

  // 5. Level milestones
  if ((child.level || 1) >= 10) {
    await award(ACHIEVEMENT_CODES.LEVEL_10);
  }

  return newlyAwarded;
}
