import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import {
  Child,
  Mastery,
  Question,
  Attempt,
  Ledger,
  Payout,
  ChildAchievement,
  LearningSession,
} from '../models/index.js';
import { HttpError, wrap, parse } from '../lib/errors.js';
import { requireChild } from '../middleware/auth.js';
import { policy, bkt, SUBJECTS, xpProgress } from '../policy.js';
import { dayKey, dayStart } from '../lib/time.js';
import * as adaptive from '../services/adaptive.js';
import { scoreAttempt, pointsToRupees } from '../services/rewards.js';
import { updateDailyStreak } from '../services/streaks.js';
import { checkAndAwardAchievements } from '../services/achievements.js';

const r = Router();
r.use(requireChild);

const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

async function me(req) {
  const c = await Child.findById(req.childId);
  if (!c) throw new HttpError(404, 'Profile not found');
  return c;
}

r.get('/profile', wrap(async (req, res) => {
  const c = await me(req);
  const progress = xpProgress(c.xp || 0);
  res.json({
    child: {
      id: c._id,
      name: c.name,
      grade: c.grade,
      language: c.language,
      points: c.points,
      lifetimePoints: c.lifetimePoints,
      streakDays: c.streakDays || 0,
      longestStreak: c.longestStreak || 0,
      level: progress.level,
      xpInLevel: progress.xpInLevel,
      xpNeeded: progress.xpNeeded,
      xpPercent: progress.percent,
    },
  });
}));

r.get('/subjects', wrap(async (req, res) => {
  const [c, skills, ms] = await Promise.all([
    me(req),
    Question.aggregate([
      { $match: { status: 'reviewed' } },
      { $group: { _id: { subject: '$subject', skill: '$skill' } } },
    ]),
    Mastery.find({ child: req.childId }).lean(),
  ]);

  const pOf = Object.fromEntries(ms.map((m) => [m.skill, m.p]));
  const out = Object.keys(SUBJECTS).map((s) => {
    const sk = skills.filter((x) => x._id.subject === s).map((x) => x._id.skill);
    const avg = sk.length
      ? sk.reduce((t, k) => t + (pOf[k] ?? bkt.pInit), 0) / sk.length
      : 0;
    return {
      subject: s,
      name: SUBJECTS[s][c.language] || SUBJECTS[s].en,
      emoji: SUBJECTS[s].emoji || '📚',
      mastery: Math.round(avg * 100),
      hasQuestions: sk.length > 0,
    };
  });

  res.json({ subjects: out });
}));

r.post('/next', wrap(async (req, res) => {
  const { subject } = parse(
    z.object({ subject: z.enum(['math', 'science']) }),
    req.body
  );
  const c = await me(req);

  // Exclude questions already answered today by this child
  const seenToday = await Attempt.find({
    child: c._id,
    at: { $gte: dayStart() },
  }).distinct('question');

  const cands = await Question.find({
    status: 'reviewed',
    subject,
    _id: { $nin: seenToday },
    grade: { $gte: Math.max(1, c.grade - 2), $lte: c.grade + 1 },
  })
    .select('skill difficulty discrimination')
    .lean();

  if (!cands.length) return res.json({ done: true });

  const skills = [...new Set(cands.map((q) => q.skill))];
  const ms = await Mastery.find({ child: c._id, skill: { $in: skills } }).lean();
  const pOf = Object.fromEntries(ms.map((m) => [m.skill, m.p]));

  // Sort skills: prioritize lower mastery skills
  skills.sort((a, b) => (pOf[a] ?? bkt.pInit) - (pOf[b] ?? bkt.pInit));
  const skill = Math.random() < 0.7 ? skills[0] : skills[Math.floor(Math.random() * skills.length)];

  const pool = cands
    .filter((q) => q.skill === skill)
    .map((q) => ({
      id: String(q._id),
      difficulty: q.difficulty,
      discrimination: q.discrimination || 1.0,
      skill: q.skill,
    }));

  const pick = await adaptive.chooseNext({
    pKnown: pOf[skill] ?? bkt.pInit,
    candidates: pool,
    target: 0.70,
  });

  const q = await Question.findById(pick.id).lean();
  const order = shuffle([0, 1, 2, 3]);

  // Sign token with start timestamp and shuffled answer order
  const token = jwt.sign(
    {
      qid: String(q._id),
      order,
      t: Date.now(),
      cid: String(c._id),
    },
    config.jwtSecret,
    { expiresIn: '15m', jwtid: crypto.randomUUID() }
  );

  const L = c.language;
  res.json({
    token,
    question: {
      subject,
      skill,
      difficulty: q.difficulty,
      text: q.text[L] || q.text.en,
      options: order.map((i) => q.options[i][L] || q.options[i].en),
    },
  });
}));

r.post('/answer', wrap(async (req, res) => {
  const { token, chosen } = parse(
    z.object({
      token: z.string().max(2000),
      chosen: z.number().int().min(0).max(3),
    }),
    req.body
  );

  let p;
  try {
    p = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(400, 'This question expired. Please get a new one.');
  }

  if (p.cid !== req.childId) {
    throw new HttpError(403, 'This question belongs to someone else');
  }

  const q = await Question.findById(p.qid).lean();
  if (!q) throw new HttpError(404, 'Question not found');

  // Server measures time and validates answer
  const ms = Date.now() - p.t;
  const correct = p.order[chosen] === q.answerIndex;

  // Anti-replay via jti unique index
  let attempt;
  try {
    attempt = await Attempt.create({
      child: req.childId,
      question: q._id,
      skill: q.skill,
      subject: q.subject,
      jti: p.jti,
      chosen: p.order[chosen],
      correct,
      ms,
    });
  } catch (e) {
    if (e.code === 11000) {
      const prev = await Attempt.findOne({ jti: p.jti }).lean();
      if (prev?.result) return res.json(prev.result);
      throw new HttpError(409, 'Answer is already being processed');
    }
    throw e;
  }

  // Update mastery via ML service (BKT)
  const today = dayKey();
  let m =
    (await Mastery.findOne({ child: req.childId, skill: q.skill })) ||
    new Mastery({
      child: req.childId,
      skill: q.skill,
      p: bkt.pInit,
      dayStartP: bkt.pInit,
    });

  if (m.dayDate !== today) {
    m.dayDate = today;
    m.dayStartP = m.p;
  }

  const daysSincePractice = m.lastPracticed ? (Date.now() - m.lastPracticed.getTime()) / 86400000 : 0;
  m.p = await adaptive.trace(m.p, correct, daysSincePractice);
  m.attempts += 1;
  if (correct) m.correct += 1;
  m.lastPracticed = new Date();
  await m.save();

  // Optimistic lock on child day counters
  let done = null;
  for (let i = 0; i < 3 && !done; i++) {
    await Child.updateOne(
      { _id: req.childId, 'day.date': { $ne: today } },
      {
        $set: {
          day: {
            date: today,
            points: 0,
            answered: 0,
            correct: 0,
            effort: 0,
            streakPaid: false,
            improvedSkills: [],
          },
        },
      }
    );

    const c = await Child.findById(req.childId).lean();
    const sc = scoreAttempt({
      correct,
      difficulty: q.difficulty,
      ms,
      skill: q.skill,
      day: c.day || {},
      dayStartP: m.dayStartP,
      pAfter: m.p,
      currentXp: c.xp || 0,
    });

    const upd = await Child.updateOne(
      { _id: c._id, 'day.points': c.day?.points || 0, 'day.answered': c.day?.answered || 0 },
      {
        $inc: { points: sc.grant, lifetimePoints: sc.grant },
        $set: {
          day: { date: today, ...sc.dayAfter },
          xp: sc.newTotalXp,
          level: sc.newLevel,
          risk: Math.max(0, (c.risk || 0) + (ms < policy.minMs ? 1 : -0.1)),
        },
      }
    );
    if (upd.modifiedCount === 1) done = { c, sc };
  }

  if (!done) {
    await Attempt.deleteOne({ _id: attempt._id });
    throw new HttpError(503, 'Server was busy. Please try again.');
  }

  const { c, sc } = done;

  // Update daily streak
  const streakInfo = await updateDailyStreak(c._id);

  // Check achievements
  const newAchievements = await checkAndAwardAchievements(c._id, {
    correct,
    difficulty: q.difficulty,
  });

  // Record points in ledger
  if (sc.grant > 0) {
    await Ledger.create({
      child: c._id,
      type: 'earn',
      points: sc.grant,
      ref: String(attempt._id),
      note: JSON.stringify(sc.parts),
    });
  }

  // Update question stats
  await Question.updateOne(
    { _id: q._id },
    { $inc: { 'stats.served': 1, 'stats.correct': correct ? 1 : 0 } }
  );

  const L = c.language;
  const result = {
    correct,
    correctIndex: p.order.indexOf(q.answerIndex),
    explanation: q.explanation?.[L] || q.explanation?.en || '',
    points: sc.grant,
    parts: sc.parts,
    flags: sc.flags,
    xpGained: sc.xpGained,
    levelUp: sc.levelUp,
    newLevel: sc.newLevel,
    streakDays: streakInfo.streakDays,
    newAchievements,
    mastery: { skill: q.skill, percent: Math.round(m.p * 100) },
    wallet: {
      points: c.points + sc.grant,
      today: sc.dayAfter.points,
      dailyCap: policy.dailyCap,
    },
  };

  await Attempt.updateOne(
    { _id: attempt._id },
    { $set: { pointsAwarded: sc.grant, result } }
  );

  res.json(result);
}));

r.get('/wallet', wrap(async (req, res) => {
  const c = await me(req);
  const open = await Payout.findOne({
    child: c._id,
    status: { $in: ['requested', 'review', 'approved', 'processing'] },
  }).lean();

  res.json({
    points: c.points,
    rupees: pointsToRupees(c.points),
    today: c.day?.date === dayKey() ? c.day.points : 0,
    dailyCap: policy.dailyCap,
    minPayoutRs: policy.minPayoutRs,
    pointsPerRupee: policy.pointsPerRupee,
    openPayout: open
      ? {
          id: open._id,
          status: open.status,
          rupees: Math.round(open.amountPaise / 100),
        }
      : null,
  });
}));

r.get('/achievements', wrap(async (req, res) => {
  const earned = await ChildAchievement.find({ child: req.childId })
    .populate('achievement')
    .sort({ earnedAt: -1 })
    .lean();

  res.json({
    achievements: earned.map((e) => ({
      ...e.achievement,
      earnedAt: e.earnedAt,
    })),
  });
}));

export default r;
