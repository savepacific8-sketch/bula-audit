import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../env.js';

// Tighter limits in production, looser in dev. Tests skip entirely.
const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';
const skip = () => isTest;

// Multiplier for non-prod environments. Keeps the same shape but gives you
// breathing room while debugging.
const devMult = isProd ? 1 : 20;

/**
 * General API limiter — generous, protects against scrapers and runaway scripts.
 * Prod: 300 per 5 min. Dev: 6000.
 */
export const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300 * devMult,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests, slow down.' },
});

/**
 * Auth limiter — /api/auth/login + signup + password-reset.
 * Prod: 10 per 15 min per IP. Dev: 200.
 * Account-level lockout (in the auth route) handles per-user brute force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10 * devMult,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: isProd
      ? 'Too many authentication attempts. Try again in 15 minutes.'
      : 'Auth rate limit hit (dev). Restart the server to reset.',
  },
});

/**
 * AI limiter — protects OpenAI bill. Per-user when authenticated,
 * per-IP when not. Prod: 60/hour. Dev: 1200/hour.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60 * devMult,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  keyGenerator: (req: Request) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return `ip:${req.ip ?? 'unknown'}`;
  },
  message: { error: 'AI usage limit reached. Try again in an hour.' },
});

/**
 * Upload limiter — Prod: 30/hour per user. Dev: 600.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30 * devMult,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  keyGenerator: (req: Request) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return `ip:${req.ip ?? 'unknown'}`;
  },
  message: { error: 'Upload limit reached. Try again in an hour.' },
});
