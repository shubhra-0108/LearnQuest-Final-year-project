import { Router } from 'express';
import { z } from 'zod';
import { Child, Mastery, Attempt, LearningSession, Question } from '../models/index.js';
import { HttpError, wrap, parse, OID } from '../lib/errors.js';
import { requireGuardian } from '../middleware/auth.js';
import * as adaptive from '../services/adaptive.js';

const r = Router();
r.use(requireGuardian);

r.get('/child/:id/mastery-trend', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const child = await Child.findOne({ _id: id, guardian: req.user.id });
  if (!child) throw new HttpError(404, 'Child not found');

  const masteries = await Mastery.find({ child: id }).sort({ updatedAt: -1 }).lean();
  res.json({
    trends: masteries.map((m) => ({
      skill: m.skill,
      p: m.p,
      percent: Math.round(m.p * 100),
      attempts: m.attempts,
      correct: m.correct,
      accuracy: m.attempts ? Math.round((m.correct / m.attempts) * 100) : 0,
      lastPracticed: m.lastPracticed,
    })),
  });
}));

r.get('/child/:id/velocity', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const child = await Child.findOne({ _id: id, guardian: req.user.id });
  if (!child) throw new HttpError(404, 'Child not found');

  const masteries = await Mastery.find({ child: id }).lean();
  const snapshots = masteries.map((m) => ({
    date: m.updatedAt?.toISOString() || new Date().toISOString(),
    skill: m.skill,
    p_known: m.p,
  }));

  const velocityData = await adaptive.getLearningVelocity(snapshots, 14);
  res.json(velocityData);
}));

r.get('/child/:id/recommendations', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const child = await Child.findOne({ _id: id, guardian: req.user.id });
  if (!child) throw new HttpError(404, 'Child not found');

  const masteries = await Mastery.find({ child: id }).lean();
  const masteryMap = Object.fromEntries(masteries.map((m) => [m.skill, m.p]));

  const distinctSkills = await Question.find({ status: 'reviewed' }).distinct('skill');
  const recommendation = await adaptive.recommendSkill({
    mastery: masteryMap,
    availableSkills: distinctSkills,
    language: child.language || 'en',
  });

  res.json({ recommendation });
}));

export default r;
