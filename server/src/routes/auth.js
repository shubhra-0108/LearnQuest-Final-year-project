import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Child } from '../models/index.js';
import { HttpError, wrap, parse, OID } from '../lib/errors.js';
import { encrypt, decrypt, maskUpi } from '../lib/crypto.js';
import {
  COOKIE_G,
  COOKIE_C,
  setAuthCookie,
  clearAuthCookie,
  requireGuardian,
} from '../middleware/auth.js';

const r = Router();
const DAY = 24 * 3600e3;
const pw = z.string().min(8, 'Use at least 8 characters').max(100);

r.post('/register', wrap(async (req, res) => {
  const b = parse(
    z.object({
      name: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(120),
      password: pw,
    }),
    req.body
  );

  const existing = await User.findOne({ email: b.email.toLowerCase() });
  if (existing) throw new HttpError(409, 'An account with this email already exists');

  const user = await User.create({
    name: b.name,
    email: b.email.toLowerCase(),
    passwordHash: await bcrypt.hash(b.password, 12),
  });

  setAuthCookie(res, COOKIE_G, { sub: String(user._id), role: user.role }, DAY * 7);
  res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}));

r.post('/login', wrap(async (req, res) => {
  const b = parse(
    z.object({
      email: z.string().trim().email(),
      password: z.string().max(100),
    }),
    req.body
  );

  const user = await User.findOne({ email: b.email.toLowerCase() });
  const ok = user && (await bcrypt.compare(b.password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Email or password is wrong');

  setAuthCookie(res, COOKIE_G, { sub: String(user._id), role: user.role }, DAY * 7);
  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}));

r.post('/logout', (_req, res) => {
  clearAuthCookie(res, COOKIE_G);
  clearAuthCookie(res, COOKIE_C);
  res.json({ ok: true });
});

r.get('/me', requireGuardian, wrap(async (req, res) => {
  const u = await User.findById(req.user.id).lean();
  if (!u) throw new HttpError(401, 'Please log in');

  let upi = '';
  if (u.upiEnc) {
    try {
      upi = maskUpi(decrypt(u.upiEnc));
    } catch {
      upi = '***';
    }
  }

  res.json({
    user: {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      upi,
    },
  });
}));

r.put('/payout-destination', requireGuardian, wrap(async (req, res) => {
  const { upi } = parse(
    z.object({
      upi: z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/, 'Enter a valid UPI ID like name@bank'),
    }),
    req.body
  );

  await User.updateOne({ _id: req.user.id }, { $set: { upiEnc: encrypt(upi) } });
  res.json({ upi: maskUpi(upi) });
}));

// Unlock one child with PIN
r.post('/child-login', requireGuardian, wrap(async (req, res) => {
  const b = parse(
    z.object({
      childId: z.string().regex(OID),
      pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
    }),
    req.body
  );

  const child = await Child.findOne({ _id: b.childId, guardian: req.user.id });
  if (!child) throw new HttpError(404, 'Child profile not found');

  if (child.lockUntil && child.lockUntil > new Date()) {
    const minsLeft = Math.ceil((child.lockUntil - new Date()) / 60000);
    throw new HttpError(429, `Too many wrong PIN attempts. Locked for ${minsLeft} more minute(s).`);
  }

  const ok = await bcrypt.compare(b.pin, child.pinHash);
  if (!ok) {
    const fails = (child.pinFails || 0) + 1;
    if (fails >= 5) {
      await Child.updateOne(
        { _id: child._id },
        {
          $set: {
            pinFails: 0,
            lockUntil: new Date(Date.now() + 10 * 60e3),
          },
        }
      );
      throw new HttpError(429, '5 wrong PIN tries. Locked for 10 minutes.');
    } else {
      await Child.updateOne({ _id: child._id }, { $set: { pinFails: fails } });
      throw new HttpError(401, `Wrong PIN. ${5 - fails} tries remaining.`);
    }
  }

  // Clear fails and unlock
  await Child.updateOne(
    { _id: child._id },
    { $set: { pinFails: 0 }, $unset: { lockUntil: 1 } }
  );

  setAuthCookie(
    res,
    COOKIE_C,
    { sub: String(child._id), role: 'child', g: req.user.id },
    4 * 3600e3 // 4 hours
  );

  res.json({
    child: {
      id: child._id,
      name: child.name,
      language: child.language,
      grade: child.grade,
      level: child.level || 1,
      xp: child.xp || 0,
      points: child.points || 0,
      streakDays: child.streakDays || 0,
    },
  });
}));

r.post('/child-logout', (_req, res) => {
  clearAuthCookie(res, COOKIE_C);
  res.json({ ok: true });
});

export default r;
