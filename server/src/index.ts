// Must be imported BEFORE any express() call. Monkey-patches Express 4 so
// that async route handlers can throw without crashing the process — the
// rejection is forwarded to the error middleware as if it were next(err).
import 'express-async-errors';

import { initSentry } from './lib/sentry.js';
await initSentry();

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { syncDbSchema } from './lib/syncDbSchema.js';
import { errorHandler, notFound } from './middleware/error.js';

await syncDbSchema();
import { generalLimiter, authLimiter, aiLimiter } from './middleware/rateLimit.js';
import { localUploadDir, isS3 } from './lib/storage.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import companiesRouter from './routes/companies.js';
import teamMembersRouter from './routes/teamMembers.js';
import receiptsRouter from './routes/receipts.js';
import subscriptionsRouter from './routes/subscriptions.js';
import paymentProofsRouter from './routes/paymentProofs.js';
import uploadsRouter from './routes/uploads.js';
import aiRouter from './routes/ai.js';
import twofaRouter from './routes/twofa.js';
import auditLogsRouter from './routes/auditLogs.js';

const app = express();
const isProd = env.NODE_ENV === 'production';

// Trust the first proxy (Cloudflare / Railway / Render) so req.ip is the
// real client IP, not the load balancer. Required for rate limiting + audit.
app.set('trust proxy', 1);

// ── Security headers ────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
            styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline at runtime
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            fontSrc: ["'self'", 'data:'],
            frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
            connectSrc: ["'self'", 'https://api.openai.com', 'https://challenges.cloudflare.com'],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false, // CSP off in dev so Vite HMR works
    hsts: isProd
      ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  }),
);

// ── CORS ────────────────────────────────────────────────────────────
app.use(
  cors({
    // Dev: allow phone/LAN (e.g. http://192.168.x.x:5173). Prod: single CLIENT_ORIGIN.
    origin:
      env.NODE_ENV === 'development'
        ? (origin, cb) => {
            if (!origin) return cb(null, true);
            const ok =
              origin === env.CLIENT_ORIGIN ||
              /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
              /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
              /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
              /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) ||
              /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/.test(origin) ||
              /^https:\/\/[a-z0-9-]+\.ngrok\.io$/.test(origin);
            cb(null, ok);
          }
        : env.CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

if (env.NODE_ENV !== 'test') {
  app.use(morgan(isProd ? 'combined' : 'dev'));
}

// Serve uploads from local disk only when STORAGE_DRIVER=local.
// On S3/R2 the uploads live in the bucket and the URLs already point there.
if (!isS3) {
  app.use('/uploads', express.static(localUploadDir, { maxAge: isProd ? '7d' : 0 }));
}

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api', generalLimiter); // applies to everything below /api
app.use('/api/auth', authLimiter, authRouter); // per-route stricter limit
app.use('/api/companies', companiesRouter);
app.use('/api/team-members', teamMembersRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/payment-proofs', paymentProofsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/2fa', twofaRouter);
app.use('/api/audit-logs', auditLogsRouter);

// ── Serve the built React frontend (production only) ───────────────────
// When deployed to a single-service host (e.g. Railway), the frontend's
// built files live at <repo>/dist relative to the project root. The server
// runs from <repo>/server/dist/index.js, so the path is ../../dist.
if (isProd) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // server/dist/index.js -> server/dist -> server/ -> <repo>/ -> <repo>/dist
  const frontendDist = path.resolve(__dirname, '..', '..', 'dist');
  if (fs.existsSync(frontendDist)) {
    console.log(`[server] serving frontend from ${frontendDist}`);
    app.use(express.static(frontendDist, { maxAge: '7d', index: false }));
    // SPA fallback — non-API, non-upload requests return index.html
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    console.warn(`[server] frontend dist not found at ${frontendDist}; API-only mode`);
  }
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${env.PORT} (LAN + localhost)`);
  console.log(`[server] env:        ${env.NODE_ENV}`);
  console.log(`[server] CORS:       ${env.CLIENT_ORIGIN}`);
  console.log(`[server] storage:    ${env.STORAGE_DRIVER}${isS3 ? ` (${env.S3_BUCKET})` : ` (${localUploadDir})`}`);
  console.log(`[server] email:      ${env.EMAIL_DRIVER}`);
});

const shutdown = (signal: string) => {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Safety net: log instead of crash on unexpected unhandled rejections.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
