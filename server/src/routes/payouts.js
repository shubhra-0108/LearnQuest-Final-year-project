import { Router } from 'express';
import { z } from 'zod';
import { Payout, Child } from '../models/index.js';
import { HttpError, wrap, parse, OID } from '../lib/errors.js';
import { requireGuardian, requireChild } from '../middleware/auth.js';
import { requestPayout, disburse, closeAndRelease } from '../services/payouts.js';

const r = Router();

// Child requests payout
r.post('/request', requireChild, wrap(async (req, res) => {
  const payout = await requestPayout(req.childId);
  res.status(201).json({
    payout: {
      id: payout._id,
      points: payout.points,
      rupees: Math.round(payout.amountPaise / 100),
      status: payout.status,
    },
  });
}));

// Guardian routes
r.get('/', requireGuardian, wrap(async (req, res) => {
  const list = await Payout.find({ guardian: req.user.id })
    .populate('child', 'name')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({
    payouts: list.map(p => ({
      id: p._id,
      childName: p.child?.name,
      points: p.points,
      rupees: Math.round(p.amountPaise / 100),
      status: p.status,
      createdAt: p.createdAt,
      history: p.history,
    })),
  });
}));

r.post('/:id/approve', requireGuardian, wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const payout = await Payout.findOne({
    _id: id,
    guardian: req.user.id,
    status: 'requested',
  });
  if (!payout) throw new HttpError(404, 'Payout not found or not in requested status');

  payout.status = 'approved';
  payout.history.push({
    status: 'approved',
    note: 'Guardian approved reward transfer',
    at: new Date(),
  });
  await payout.save();

  // Trigger disbursement
  const disburseResult = await disburse(payout._id);
  res.json({ status: disburseResult.status });
}));

r.post('/:id/decline', requireGuardian, wrap(async (req, res) => {
  const id = parse(z.string().regex(OID), req.params.id);
  const out = await closeAndRelease(
    id,
    'rejected',
    'Declined by guardian. Points returned to child.',
    ['requested', 'approved']
  );
  if (!out) throw new HttpError(404, 'Payout not found or already processed');
  res.json({ status: 'rejected' });
}));

export default r;
