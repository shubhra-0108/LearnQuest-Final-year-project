import mongoose from 'mongoose';
import { Payout, Pool, Child, Ledger, Notification } from '../models/index.js';
import { HttpError } from '../lib/errors.js';
import { payoutQuote } from './rewards.js';
import { logger } from '../lib/logger.js';

export async function requestPayout(childId) {
  const child = await Child.findById(childId);
  if (!child) throw new HttpError(404, 'Child profile not found');

  const open = await Payout.findOne({
    child: childId,
    status: { $in: ['requested', 'review', 'approved', 'processing'] },
  });
  if (open) {
    throw new HttpError(409, 'A reward payout is already pending approval or processing');
  }

  const quote = payoutQuote(child.points);
  if (!quote.ok) {
    throw new HttpError(400, `Need at least 500 stars (₹50) to request reward. Current: ${child.points} stars.`);
  }

  // Deduct points from child and record in ledger
  await Child.updateOne({ _id: childId }, { $inc: { points: -quote.points } });
  await Ledger.create({
    child: childId,
    type: 'redeem_hold',
    points: quote.points,
    note: `Reward request of ₹${quote.rs}`,
  });

  // Flag for safety check if child risk score > 3
  const isRisky = (child.risk || 0) >= 3.0;
  const initialStatus = isRisky ? 'review' : 'requested';

  const payout = await Payout.create({
    child: childId,
    guardian: child.guardian,
    points: quote.points,
    amountPaise: quote.rs * 100,
    status: initialStatus,
    history: [
      {
        status: initialStatus,
        note: isRisky ? 'Flagged for admin safety check due to high speed risk score' : 'Child requested reward',
        at: new Date(),
      },
    ],
  });

  // Notify guardian
  await Notification.create({
    recipient: child.guardian,
    recipientType: 'guardian',
    type: 'payout_approved',
    title: `Reward Requested: ${child.name} (₹${quote.rs})`,
    message: `${child.name} has redeemed ${quote.points} stars for ₹${quote.rs}. Please approve in your dashboard.`,
    data: { payoutId: payout._id },
  });

  return payout;
}

export async function disburse(payoutId) {
  const p = await Payout.findById(payoutId);
  if (!p) throw new HttpError(404, 'Payout not found');
  if (p.status !== 'approved') {
    throw new HttpError(409, `Payout is in status '${p.status}', cannot disburse`);
  }

  // Try to atomically debit from sponsor pool
  const pool = await Pool.findOneAndUpdate(
    { _id: 'main', balancePaise: { $gte: p.amountPaise } },
    {
      $inc: {
        balancePaise: -p.amountPaise,
        totalPaidPaise: p.amountPaise,
      },
    },
    { new: true }
  );

  if (!pool) {
    logger.warn(`Pool balance insufficient for payout ${payoutId}`);
    p.status = 'processing';
    p.history.push({
      status: 'processing',
      note: 'Waiting for sponsor pool refill',
      at: new Date(),
    });
    await p.save();
    return { status: 'waiting_for_pool' };
  }

  // Simulate instant UPI transfer
  p.status = 'paid';
  p.providerRef = `UPI_SIM_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  p.history.push({
    status: 'paid',
    note: `Disbursed ₹${p.amountPaise / 100} to guardian UPI via simulated gateway`,
    at: new Date(),
  });
  await p.save();

  // Create notifications
  await Notification.create({
    recipient: p.guardian,
    recipientType: 'guardian',
    type: 'payout_paid',
    title: `₹${p.amountPaise / 100} Sent to your UPI!`,
    message: `Reward payout has been successfully credited to your UPI handle.`,
    data: { payoutId: p._id, ref: p.providerRef },
  });

  return { status: 'paid', ref: p.providerRef };
}

export async function closeAndRelease(payoutId, finalStatus, note, allowedFrom = []) {
  const p = await Payout.findOne({ _id: payoutId, status: { $in: allowedFrom } });
  if (!p) return null;

  p.status = finalStatus;
  p.history.push({ status: finalStatus, note, at: new Date() });
  await p.save();

  // If rejected or failed, refund points to child
  if (['rejected', 'failed'].includes(finalStatus)) {
    await Child.updateOne({ _id: p.child }, { $inc: { points: p.points } });
    await Ledger.create({
      child: p.child,
      type: 'redeem_release',
      points: p.points,
      ref: String(p._id),
      note: `Refund for ${finalStatus} payout: ${note}`,
    });
  }

  return p;
}

export async function drainWaiting() {
  const waiting = await Payout.find({ status: 'approved' }).sort({ createdAt: 1 }).limit(50);
  let processed = 0;
  for (const p of waiting) {
    const res = await disburse(p._id);
    if (res.status === 'paid') processed++;
    else break; // Pool empty
  }
  return processed;
}
