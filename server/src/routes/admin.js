import { Router } from 'express';
import { z } from 'zod';
import { Child, Question, Attempt, Payout, Pool, User, Achievement } from '../models/index.js';
import { HttpError, wrap, parse, OID } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { draftQuestions } from '../services/aiDraft.js';
import { disburse, closeAndRelease, drainWaiting } from '../services/payouts.js';
import * as adaptive from '../services/adaptive.js';

const r = Router();
r.use(requireAdmin);

r.get('/stats', wrap(async (_req, res) => {
  const [children, attempts, pending, review, pool, drafts] = await Promise.all([
    Child.countDocuments(),
    Attempt.countDocuments(),
    Payout.countDocuments({ status: { $in: ['requested', 'approved', 'processing'] } }),
    Payout.countDocuments({ status: 'review' }),
    Pool.findById('main').lean(),
    Question.countDocuments({ status: 'draft' }),
  ]);

  res.json({
    children,
    attempts,
    pendingPayouts: pending,
    reviewPayouts: review,
    draftQuestions: drafts,
    pool: {
      balanceRs: Math.round((pool?.balancePaise || 0) / 100),
      fundedRs: Math.round((pool?.totalFundedPaise || 0) / 100),
      paidRs: Math.round((pool?.totalPaidPaise || 0) / 100),
    },
  });
}));

const qBody = z.object({
  subject: z.enum(['math', 'science']),
  skill: z.string().min(2).max(40),
  grade: z.number().int().min(1).max(10),
  difficulty: z.number().int().min(1).max(5),
  text: z.object({
    en: z.string().min(3).max(400),
    hi: z.string().max(400).default(''),
  }),
  options: z.array(
    z.object({
      en: z.string().min(1).max(120),
      hi: z.string().max(120).default(''),
    })
  ).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.object({
    en: z.string().max(400).default(''),
    hi: z.string().max(400).default(''),
  }).default({ en: '', hi: '' }),
});

r.get('/questions', wrap(async (req, res) => {
  const status = parse(
    z.enum(['draft', 'reviewed', 'retired']).default('draft'),
    req.query.status
  );
  const list = await Question.find({ status }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ questions: list });
}));

r.post('/questions', wrap(async (req, res) => {
  const b = parse(qBody, req.body);
  const q = await Question.create({ ...b, status: 'draft', source: 'manual' });
  res.status(201).json({ question: q });
}));

// Human review gate
r.patch('/questions/:id', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const { status } = parse(
    z.object({ status: z.enum(['reviewed', 'retired', 'draft']) }),
    req.body
  );
  const q = await Question.findByIdAndUpdate(
    id,
    { status, reviewedBy: req.user.id },
    { new: true }
  );
  if (!q) throw new HttpError(404, 'Question not found');
  res.json({ question: q });
}));

r.post('/questions/ai-draft', wrap(async (req, res) => {
  const b = parse(
    z.object({
      subject: z.enum(['math', 'science']),
      skill: z.string().min(2).max(40),
      grade: z.number().int().min(1).max(10),
      difficulty: z.number().int().min(1).max(5),
      count: z.number().int().min(1).max(5).default(3),
    }),
    req.body
  );

  const items = await draftQuestions(b);
  const docs = await Question.insertMany(
    items.map((i) => ({
      ...i,
      subject: b.subject,
      skill: b.skill,
      grade: b.grade,
      difficulty: b.difficulty,
      status: 'draft',
      source: 'ai',
    }))
  );
  res.status(201).json({ created: docs.length });
}));

r.get('/calibration', wrap(async (_req, res) => {
  const qs = await Question.find({ status: 'reviewed', 'stats.served': { $gte: 20 } })
    .select('difficulty stats text')
    .lean();

  if (!qs.length) {
    return res.json({ suggestions: [], note: 'Questions need at least 20 responses to evaluate' });
  }

  const out = await adaptive.calibrate(
    qs.map((q) => ({
      id: String(q._id),
      served: q.stats.served,
      correct: q.stats.correct,
      difficulty: q.difficulty,
    }))
  );
  res.json(out);
}));

r.post('/pool/fund', wrap(async (req, res) => {
  const { amountRs } = parse(
    z.object({ amountRs: z.number().int().min(1).max(10_000_000) }),
    req.body
  );
  const paise = amountRs * 100;
  await Pool.updateOne(
    { _id: 'main' },
    { $inc: { balancePaise: paise, totalFundedPaise: paise } },
    { upsert: true }
  );
  const retried = await drainWaiting();
  res.json({ ok: true, retriedPayouts: retried });
}));

r.get('/payouts', wrap(async (req, res) => {
  const status = parse(
    z.enum(['review', 'approved', 'requested', 'processing', 'paid', 'failed', 'rejected']).default('review'),
    req.query.status
  );
  const list = await Payout.find({ status })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate('child', 'name risk')
    .lean();

  const gs = await User.find({ _id: { $in: list.map((p) => p.guardian) } })
    .select('email')
    .lean();
  const email = Object.fromEntries(gs.map((g) => [String(g._id), g.email]));

  res.json({
    payouts: list.map((p) => ({
      id: p._id,
      child: p.child?.name,
      risk: Math.round((p.child?.risk || 0) * 10) / 10,
      rupees: Math.round(p.amountPaise / 100),
      guardian: email[String(p.guardian)],
      history: p.history,
    })),
  });
}));

r.post('/payouts/:id/release', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const p = await Payout.findOneAndUpdate(
    { _id: id, status: 'review' },
    {
      $set: { status: 'approved' },
      $push: {
        history: {
          status: 'approved',
          note: 'Admin cleared safety check after manual review',
          at: new Date(),
        },
      },
    },
    { new: true }
  );
  if (!p) throw new HttpError(409, 'Payout not found in review queue');
  const out = await disburse(p._id);
  res.json({ status: out.status });
}));

r.post('/payouts/:id/reject', wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const out = await closeAndRelease(
    id,
    'rejected',
    'Rejected by administrator after safety review. Points refunded.',
    ['review', 'requested', 'approved']
  );
  if (!out) throw new HttpError(409, 'Cannot reject this payout');
  res.json({ status: out.status });
}));

export default r;
