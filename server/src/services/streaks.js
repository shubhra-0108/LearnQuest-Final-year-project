import { dayKey, daysBetween } from '../lib/time.js';
import { Child } from '../models/index.js';

export async function updateDailyStreak(childId) {
  const child = await Child.findById(childId);
  if (!child) return { streakDays: 0, isNewDay: false };

  const today = dayKey();
  const lastActive = child.lastActiveDate;

  if (lastActive === today) {
    return { streakDays: child.streakDays || 1, isNewDay: false };
  }

  let streak = child.streakDays || 0;
  if (!lastActive) {
    streak = 1;
  } else {
    const gap = daysBetween(lastActive, today);
    if (gap === 1) {
      streak += 1;
    } else {
      streak = 1; // Reset if missed more than 1 day
    }
  }

  const longestStreak = Math.max(child.longestStreak || 0, streak);

  await Child.updateOne(
    { _id: childId },
    {
      $set: {
        streakDays: streak,
        longestStreak,
        lastActiveDate: today,
      },
    }
  );

  return { streakDays: streak, isNewDay: true, longestStreak };
}
