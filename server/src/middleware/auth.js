import jwt from 'jsonwebtoken';
import { config, isProd } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { User, Child } from '../models/index.js';

export const COOKIE_G = 'lq_g';
export const COOKIE_C = 'lq_c';

const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookie(res, name, payload, maxAgeMs) {
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: Math.floor(maxAgeMs / 1000) });
  res.cookie(name, token, { ...cookieOpts, maxAge: maxAgeMs });
}

export function clearAuthCookie(res, name) {
  res.clearCookie(name, cookieOpts);
}

export async function requireGuardian(req, res, next) {
  try {
    const token = req.cookies[COOKIE_G];
    if (!token) throw new HttpError(401, 'Please log in as a guardian');
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.sub).lean();
    if (!user) throw new HttpError(401, 'User account no longer exists');
    req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      next(new HttpError(401, 'Session expired or invalid, please login again'));
    } else {
      next(err);
    }
  }
}

export async function requireAdmin(req, res, next) {
  await requireGuardian(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') {
      return next(new HttpError(403, 'Admin privileges required'));
    }
    next();
  });
}

export async function requireChild(req, res, next) {
  try {
    const token = req.cookies[COOKIE_C];
    if (!token) throw new HttpError(401, 'Child session not unlocked. Please enter PIN.');
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'child') throw new HttpError(403, 'Invalid child token');
    
    // Check if child still exists
    const child = await Child.findById(decoded.sub).lean();
    if (!child) throw new HttpError(404, 'Child profile not found');
    
    req.childId = String(child._id);
    req.guardianId = String(decoded.g);
    req.child = child;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      next(new HttpError(401, 'Child session expired, please unlock with PIN again'));
    } else {
      next(err);
    }
  }
}
