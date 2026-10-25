import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { config } from './config.js';
import { notFound, errorHandler } from './middleware/error.js';
import auth from './routes/auth.js';
import children from './routes/children.js';
import learn from './routes/learn.js';
import payouts from './routes/payouts.js';
import admin from './routes/admin.js';
import analytics from './routes/analytics.js';
import { policy } from './policy.js';

async function checkMlHealth() {
  try {
    const r = await fetch(`${config.mlUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(1500),
      headers: { accept: 'application/json' },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { status: 'degraded', ok: false, error: body.detail || `ml ${r.status}` };
    }
    return { status: 'up', ok: true, ...body };
  } catch (error) {
    return { status: 'degraded', ok: false, error: error.message };
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow client scripts and styles
    })
  );

  app.use(
    cors({
      origin: [config.clientOrigin, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // General rate limit
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Strict rate limit on auth attempts
  const strict = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(['/api/auth/login', '/api/auth/register', '/api/auth/child-login'], strict);

  app.get('/api/health', async (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    const ml = await checkMlHealth();
    res.json({
      ok: true,
      service: 'learnquest-server',
      version: '2.0.0',
      db: db ? 'connected' : 'disconnected',
      ml: ml.status,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ready', async (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    const ml = await checkMlHealth();
    const ready = db;
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'degraded',
      db: { status: db ? 'up' : 'down', connected: db },
      ml: { status: ml.status, ok: ml.ok },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/policy', (_req, res) => {
    res.json({
      pointsPerRupee: policy.pointsPerRupee,
      minPayoutRs: policy.minPayoutRs,
      maxPayoutRs: policy.maxPayoutRs,
      dailyCap: policy.dailyCap,
      minSeconds: policy.minMs / 1000,
    });
  });

  app.use('/api/auth', auth);
  app.use('/api/children', children);
  app.use('/api/learn', learn);
  app.use('/api/payouts', payouts);
  app.use('/api/admin', admin);
  app.use('/api/analytics', analytics);

  // Static serving for single-container / production deployment
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../client/dist'
  );
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) =>
      res.sendFile(path.join(dist, 'index.html'))
    );
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
