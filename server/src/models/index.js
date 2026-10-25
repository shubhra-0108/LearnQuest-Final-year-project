import mongoose from 'mongoose';
import { policy } from '../policy.js';

const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// ─── User (Guardian + Admin) ───────────────────────────────────────────────────
const User = model('User', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['guardian', 'admin'], default: 'guardian' },
  upiEnc: { type: String, default: '' },  // AES-GCM encrypted UPI handle
  isActive: { type: Boolean, default: true },
}, { timestamps: true }));

// ─── Daily stats sub-schema (embedded in Child) ────────────────────────────────
const daySchema = new Schema({
  date: String,
  points: { type: Number, default: 0 },
  answered: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  effort: { type: Number, default: 0 },
  streakPaid: { type: Boolean, default: false },
  improvedSkills: { type: [String], default: [] },
}, { _id: false });

// ─── Child ─────────────────────────────────────────────────────────────────────
const Child = model('Child', new Schema({
  guardian: { type: ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  grade: { type: Number, required: true, min: 1, max: 10 },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  pinHash: { type: String, required: true },
  pinFails: { type: Number, default: 0 },
  lockUntil: Date,

  // Economy
  points: { type: Number, default: 0, min: 0 },
  lifetimePoints: { type: Number, default: 0 },

  // Game progression
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  // Streak tracking
  streakDays: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActiveDate: String,  // YYYY-MM-DD in IST

  // Anti-cheat
  risk: { type: Number, default: 0 },

  // Consent
  consent: {
    version: String,
    givenAt: Date,
  },

  // Daily counters
  day: { type: daySchema, default: () => ({}) },
}, { timestamps: true }));

// ─── Mastery (BKT state per skill per child) ────────────────────────────────────
const Mastery = model('Mastery', new Schema({
  child: { type: ObjectId, ref: 'Child', required: true },
  skill: { type: String, required: true },
  p: { type: Number, default: 0.3 },   // BKT P(known)
  theta: { type: Number, default: 0 }, // IRT ability estimate
  attempts: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  dayDate: String,
  dayStartP: { type: Number, default: 0.3 },
  lastPracticed: Date,
  // Spaced repetition state
  easeFactor: { type: Number, default: 2.5 },
  intervalDays: { type: Number, default: 1.0 },
  srRepetitions: { type: Number, default: 0 },
}, { timestamps: true }).index({ child: 1, skill: 1 }, { unique: true }));

// ─── Question ──────────────────────────────────────────────────────────────────
const loc = new Schema({ en: { type: String, required: true, maxlength: 400 }, hi: { type: String, default: '', maxlength: 400 } }, { _id: false });
const expl = new Schema({ en: { type: String, default: '', maxlength: 400 }, hi: { type: String, default: '', maxlength: 400 } }, { _id: false });

const Question = model('Question', new Schema({
  subject: { type: String, enum: ['math', 'science'], required: true },
  skill: { type: String, required: true },
  grade: { type: Number, min: 1, max: 10, required: true },
  difficulty: { type: Number, min: 1, max: 5, required: true },
  discrimination: { type: Number, default: 1.0, min: 0.1, max: 3.0 }, // IRT 'a' param
  text: { type: loc, required: true },
  options: { type: [loc], validate: (v) => v.length === 4 },
  answerIndex: { type: Number, min: 0, max: 3, required: true },
  explanation: { type: expl, default: () => ({}) },
  status: { type: String, enum: ['draft', 'reviewed', 'retired'], default: 'draft' },
  source: { type: String, enum: ['seed', 'manual', 'ai'], default: 'manual' },
  reviewedBy: { type: ObjectId, ref: 'User' },
  tags: [String],
  stats: {
    served: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
  },
}, { timestamps: true }).index({ status: 1, subject: 1, skill: 1 }));

// ─── Attempt (auto-delete after retentionDays) ─────────────────────────────────
const Attempt = model('Attempt', new Schema({
  child: { type: ObjectId, ref: 'Child', required: true },
  question: { type: ObjectId, ref: 'Question', required: true },
  skill: String, subject: String,
  jti: { type: String, required: true, unique: true },
  chosen: Number,
  correct: Boolean,
  ms: Number,
  pointsAwarded: { type: Number, default: 0 },
  result: Schema.Types.Mixed,
  at: { type: Date, default: Date.now, expires: policy.retentionDays * 86400 },
}).index({ child: 1, at: -1 }));

// ─── Ledger (points earn/spend log) ────────────────────────────────────────────
const Ledger = model('Ledger', new Schema({
  child: { type: ObjectId, ref: 'Child', required: true, index: true },
  type: { type: String, enum: ['earn', 'redeem_hold', 'redeem_release'], required: true },
  points: { type: Number, required: true },
  ref: String,
  note: String,
  at: { type: Date, default: Date.now },
}));

// ─── Payout ─────────────────────────────────────────────────────────────────────
const Payout = model('Payout', new Schema({
  child: { type: ObjectId, ref: 'Child', required: true },
  guardian: { type: ObjectId, ref: 'User', required: true },
  points: Number,
  amountPaise: Number,
  status: {
    type: String,
    enum: ['requested', 'review', 'approved', 'processing', 'paid', 'failed', 'rejected'],
    default: 'requested',
  },
  providerRef: String,
  history: [{
    status: String,
    note: String,
    at: { type: Date, default: Date.now },
    _id: false,
  }],
}, { timestamps: true }).index({ guardian: 1, status: 1 }));

// ─── Sponsor Pool ─────────────────────────────────────────────────────────────
const Pool = model('Pool', new Schema({
  _id: String,
  balancePaise: { type: Number, default: 0, min: 0 },
  totalFundedPaise: { type: Number, default: 0 },
  totalPaidPaise: { type: Number, default: 0 },
}));

// ─── Consent Log ─────────────────────────────────────────────────────────────
const ConsentLog = model('ConsentLog', new Schema({
  guardian: { type: ObjectId, ref: 'User', index: true },
  child: ObjectId,
  version: String,
  action: { type: String, enum: ['granted', 'withdrawn'] },
  at: { type: Date, default: Date.now },
}));

// ─── Achievement Definitions ──────────────────────────────────────────────────
const Achievement = model('Achievement', new Schema({
  code: { type: String, unique: true, required: true },
  name: { type: loc, required: true },
  description: { type: expl, required: true },
  icon: { type: String, default: '🏆' },
  category: { type: String, enum: ['streak', 'mastery', 'milestone', 'special'], default: 'milestone' },
  xpReward: { type: Number, default: 50 },
  pointsReward: { type: Number, default: 0 },
}));

// ─── Child Achievements (earned badges) ───────────────────────────────────────
const ChildAchievement = model('ChildAchievement', new Schema({
  child: { type: ObjectId, ref: 'Child', required: true },
  achievement: { type: ObjectId, ref: 'Achievement', required: true },
  earnedAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false },
}).index({ child: 1, achievement: 1 }, { unique: true }));

// ─── Learning Session ─────────────────────────────────────────────────────────
const LearningSession = model('LearningSession', new Schema({
  child: { type: ObjectId, ref: 'Child', required: true, index: true },
  subject: String,
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  questionsAnswered: { type: Number, default: 0 },
  pointsEarned: { type: Number, default: 0 },
  masteryGain: { type: Number, default: 0 },
  qualityScore: Number,
  durationSeconds: Number,
}));

// ─── Notifications (auto-delete after 30 days) ────────────────────────────────
const Notification = model('Notification', new Schema({
  recipient: { type: ObjectId, required: true, index: true }, // child or guardian id
  recipientType: { type: String, enum: ['child', 'guardian'], required: true },
  type: { type: String, enum: ['achievement', 'payout_approved', 'payout_rejected', 'payout_paid', 'tip', 'system'] },
  title: String,
  message: String,
  data: Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  at: { type: Date, default: Date.now, expires: 30 * 86400 },
}));

export {
  User, Child, Mastery, Question, Attempt, Ledger, Payout, Pool,
  ConsentLog, Achievement, ChildAchievement, LearningSession, Notification
};
