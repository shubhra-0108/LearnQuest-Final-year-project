import { scoreAttempt, pointsToRupees, payoutQuote } from '../src/services/rewards.js';
import { policy } from '../src/policy.js';

describe('Reward & Anti-Cheat Logic', () => {
  const baseDay = {
    date: '2026-10-25',
    points: 0,
    answered: 0,
    correct: 0,
    effort: 0,
    streakPaid: false,
    improvedSkills: [],
  };

  test('answers under 1.5 seconds earn 0 points (anti-cheat)', () => {
    const res = scoreAttempt({
      correct: true,
      difficulty: 3,
      ms: 1200, // < 1500ms
      skill: 'math.addsub',
      day: baseDay,
      dayStartP: 0.3,
      pAfter: 0.5,
    });
    expect(res.grant).toBe(0);
    expect(res.flags).toContain('too_fast');
  });

  test('correct answer gives 2 + difficulty points', () => {
    const res = scoreAttempt({
      correct: true,
      difficulty: 4,
      ms: 4500,
      skill: 'math.addsub',
      day: baseDay,
      dayStartP: 0.3,
      pAfter: 0.32,
    });
    expect(res.parts.base).toBe(6); // 2 + 4
    expect(res.grant).toBe(6);
  });

  test('considered wrong answer gives 1 effort point (up to cap of 10)', () => {
    const res = scoreAttempt({
      correct: false,
      difficulty: 3,
      ms: 5000,
      skill: 'math.addsub',
      day: { ...baseDay, effort: 5 },
      dayStartP: 0.3,
      pAfter: 0.28,
    });
    expect(res.parts.effort).toBe(1);
    expect(res.grant).toBe(1);
  });

  test('improving skill grants +15 bonus points', () => {
    const res = scoreAttempt({
      correct: true,
      difficulty: 2,
      ms: 6000,
      skill: 'math.fractions',
      day: baseDay,
      dayStartP: 0.30,
      pAfter: 0.40, // delta = 0.10 >= 0.05
    });
    expect(res.parts.improve).toBe(15);
    expect(res.grant).toBe(2 + 2 + 15); // base(4) + improve(15) = 19
  });

  test('daily points are strictly capped at 100', () => {
    const res = scoreAttempt({
      correct: true,
      difficulty: 5,
      ms: 8000,
      skill: 'math.geometry',
      day: { ...baseDay, points: 97 },
      dayStartP: 0.3,
      pAfter: 0.5,
    });
    // total earnable is 2 + 5 = 7, but only 3 points room left
    expect(res.grant).toBe(3);
    expect(res.flags).toContain('daily_cap');
  });

  test('points to rupees conversion (10 points = ₹1)', () => {
    expect(pointsToRupees(100)).toBe(10);
    expect(pointsToRupees(450)).toBe(45);
    expect(pointsToRupees(500)).toBe(50);
  });

  test('payout quote enforces ₹50 minimum threshold', () => {
    const lowQuote = payoutQuote(490); // ₹49
    expect(lowQuote.ok).toBe(false);

    const validQuote = payoutQuote(500); // ₹50
    expect(validQuote.ok).toBe(true);
    expect(validQuote.rs).toBe(50);
    expect(validQuote.points).toBe(500);
  });
});
