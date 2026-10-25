import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Child, Mastery, Attempt, ConsentLog, ChildAchievement, LearningSession, Notification } from '../models/index.js';
import { HttpError, wrap, parse, OID } from '../lib/errors.js';
import { requireGuardian } from '../middleware/auth.js';
import { SUBJECTS } from '../policy.js';

const r = Router();
r.use(requireGuardian);

r.get('/', wrap(async (req, res) => {
  const children = await Child.find({ guardian: req.user.id })
    .select('-pinHash')
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    children: children.map(c => ({
      id: c._id,
      name: c.name,
      grade: c.grade,
      language: c.language,
      points: c.points,
      level: c.level || 1,
      xp: c.xp || 0,
      streakDays: c.streakDays || 0,
      risk: c.risk || 0,
      isLocked: Boolean(c.lockUntil && c.lockUntil > new Date()),
    })),
  });
}));

r.post('/', wrap(async (req, res) => {
  const b = parse(
    z.object({
      name: z.string().trim().min(1).max(40),
      grade: z.number().int().min(1).max(10),
      language: z.enum(['en', 'hi']).default('en'),
      pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
      consentGiven: z.literal(true, {
        errorMap: () => ({ message: 'You must review and agree to the consent statement' }),
      }),
    }),
    req.body
  );

  const pinHash = await bcrypt.hash(b.pin, 10);
  const consent = { version: '2024-v2', givenAt: new Date() };

  const child = await Child.create({
    guardian: req.user.id,
    name: b.name,
    grade: b.grade,
    language: b.language,
    pinHash,
    consent,
  });

  await ConsentLog.create({
    guardian: req.user.id,
    child: child._id,
    version: consent.version,
    action: 'granted',
  });

  res.status(201).json({
    child: {
      id: child._id,
      name: child.name,
      grade: child.grade,
      language: child.language,
      points: 0,
    },
  });
}));

r.get('/:id/progress', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const child = await Child.findOne({ _id: id, guardian: req.user.id }).lean();
  if (!child) throw new HttpError(404, 'Child not found');

  const [masteryList, attemptsCount, achievements, sessions] = await Promise.all([
    Mastery.find({ child: id }).lean(),
    Attempt.countDocuments({ child: id }),
    ChildAchievement.find({ child: id }).populate('achievement').lean(),
    LearningSession.find({ child: id }).sort({ startedAt: -1 }).limit(10).lean(),
  ]);

  res.json({
    child: {
      id: child._id,
      name: child.name,
      grade: child.grade,
      points: child.points,
      level: child.level || 1,
      xp: child.xp || 0,
      streakDays: child.streakDays || 0,
      longestStreak: child.longestStreak || 0,
    },
    mastery: masteryList.map(m => ({
      skill: m.skill,
      percent: Math.round(m.p * 100),
      attempts: m.attempts,
      correct: m.correct,
      lastPracticed: m.lastPracticed,
    })),
    stats: {
      totalAttempts: attemptsCount,
      achievementsCount: achievements.length,
    },
    achievements: achievements.map(a => a.achievement),
    recentSessions: sessions,
  });
}));

r.get('/:id/notifications', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const notes = await Notification.find({ recipient: id })
    .sort({ at: -1 })
    .limit(20)
    .lean();
  res.json({ notifications: notes });
}));

r.patch('/:id/notifications/:nid/read', wrap(async (req, res) => {
  const nid = parse(z.string().regex(OID), req.params.nid);
  await Notification.updateOne({ _id: nid }, { $set: { read: true } });
  res.json({ ok: true });
}));

r.delete('/:id', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const child = await Child.findOneAndDelete({ _id: id, guardian: req.user.id });
  if (!child) throw new HttpError(404, 'Child not found');

  // Log consent withdrawal
  await ConsentLog.create({
    guardian: req.user.id,
    child: id,
    version: '2024-v2',
    action: 'withdrawn',
  });

  // Cascade delete child data (GDPR / right to be forgotten)
  await Promise.all([
    Mastery.deleteMany({ child: id }),
    Attempt.deleteMany({ child: id }),
    ChildAchievement.deleteMany({ child: id }),
    LearningSession.deleteMany({ child: id }),
    Notification.deleteMany({ recipient: id }),
  ]);

  res.json({ ok: true, deleted: id });
}));

export default r;
