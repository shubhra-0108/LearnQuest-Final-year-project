import { update, predictCorrect, difficultyToB, applyForgetting, DEFAULT_BKT } from '../src/lib/bkt.js';

describe('BKT & IRT Node.js Fallback Engine', () => {
  test('correct answer increases mastery estimate', () => {
    const pInit = 0.30;
    const pNext = update(pInit, true);
    expect(pNext).toBeGreaterThan(pInit);
    // Reference check: standard BKT with default params gives ~0.710
    expect(pNext).toBeCloseTo(0.710, 2);
  });

  test('wrong answer decreases posterior mastery', () => {
    const pInit = 0.80;
    const pNext = update(pInit, false);
    expect(pNext).toBeLessThan(pInit);
  });

  test('mastery stays strictly bounded in (0, 1)', () => {
    let p = 0.3;
    for (let i = 0; i < 50; i++) p = update(p, true);
    expect(p).toBeLessThan(1);
    expect(p).toBeGreaterThan(0.9);

    for (let i = 0; i < 50; i++) p = update(p, false);
    expect(p).toBeGreaterThan(0);
  });

  test('combined IRT predict: harder questions have lower P(correct)', () => {
    const pEasy = predictCorrect(0.5, 1);
    const pHard = predictCorrect(0.5, 5);
    expect(pEasy).toBeGreaterThan(pHard);
  });

  test('Ebbinghaus forgetting decays mastery towards prior floor', () => {
    const pStart = 0.85;
    const pDecayed = applyForgetting(pStart, 30);
    expect(pDecayed).toBeLessThan(pStart);
    expect(pDecayed).toBeGreaterThanOrEqual(DEFAULT_BKT.pInit);
  });
});
