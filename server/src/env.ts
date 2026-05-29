import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default('http://localhost:4000/api/auth/google/callback'),

  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // ── File storage ──────────────────────────────────────────────────
  // STORAGE_DRIVER=local  -> writes to UPLOAD_DIR, served at /uploads/*
  // STORAGE_DRIVER=s3     -> writes to S3-compatible bucket (Cloudflare R2,
  //                          AWS S3, Backblaze B2, MinIO, etc.)
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(20),

  S3_ENDPOINT: z.string().default(''),    // e.g. https://<accountid>.r2.cloudflarestorage.com
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_PUBLIC_BASE_URL: z.string().default(''), // e.g. https://files.bulaaudit.com.fj
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  // ── Email ─────────────────────────────────────────────────────────
  // EMAIL_DRIVER=console -> logs emails to stderr (dev fallback)
  // EMAIL_DRIVER=resend  -> sends via Resend API
  EMAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('BULA AUDIT <noreply@localhost>'),
  EMAIL_REPLY_TO: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),

  // App identity (used in emails + OAuth callbacks)
  APP_NAME: z.string().default('BULA AUDIT'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Validate production config.
// Critical issues (security, can't function) -> refuse to boot.
// Operational issues (degraded but functional) -> warn and continue. This
// lets you do a soft launch on Railway with the free defaults: local file
// storage (uploads ephemeral) and console email driver (links print to logs).
if (env.NODE_ENV === 'production') {
  const fatal: string[] = [];
  const warn: string[] = [];

  const isDevSecret =
    !env.JWT_SECRET ||
    env.JWT_SECRET.length < 32 ||
    env.JWT_SECRET.toLowerCase().includes('change') ||
    env.JWT_SECRET.toLowerCase().includes('dev-only');
  if (isDevSecret) fatal.push('JWT_SECRET must be a strong random value (>=32 chars, not a dev placeholder).');

  if (env.CLIENT_ORIGIN.startsWith('http://localhost')) {
    fatal.push('CLIENT_ORIGIN must point to the production frontend URL (https://...).');
  }
  if (env.DATABASE_URL.startsWith('file:')) {
    fatal.push('DATABASE_URL must point to a managed database in production, not SQLite.');
  }

  // ── Operational warnings (soft launch friendly) ──
  if (env.STORAGE_DRIVER === 'local') {
    warn.push('STORAGE_DRIVER=local on Railway/Render will lose uploaded files on each deploy. Switch to s3 (Cloudflare R2) before public launch.');
  }
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_ENDPOINT)         fatal.push('S3_ENDPOINT is required when STORAGE_DRIVER=s3.');
    if (!env.S3_BUCKET)           fatal.push('S3_BUCKET is required when STORAGE_DRIVER=s3.');
    if (!env.S3_ACCESS_KEY_ID)    fatal.push('S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3.');
    if (!env.S3_SECRET_ACCESS_KEY) fatal.push('S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3.');
  }
  if (env.EMAIL_DRIVER === 'console') {
    warn.push('EMAIL_DRIVER=console will not send real emails. Verification/reset links will print to server logs. Switch to resend before public launch.');
  }
  if (env.EMAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
    fatal.push('RESEND_API_KEY is required when EMAIL_DRIVER=resend.');
  }
  if (env.GOOGLE_REDIRECT_URI.startsWith('http://localhost') && env.GOOGLE_CLIENT_ID) {
    warn.push('GOOGLE_REDIRECT_URI points to localhost but GOOGLE_CLIENT_ID is set. Update to your prod callback URL.');
  }

  if (warn.length) {
    console.warn('[env] production warnings:');
    for (const msg of warn) console.warn('  -', msg);
  }
  if (fatal.length) {
    console.error('[env] production validation FAILED:');
    for (const msg of fatal) console.error('  -', msg);
    console.error('Refusing to start. Fix the above and redeploy.');
    process.exit(1);
  }
}

