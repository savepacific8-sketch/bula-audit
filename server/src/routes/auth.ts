import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import {
  isGoogleConfigured,
  getGoogleAuthUrl,
  exchangeCodeForProfile,
} from '../lib/google.js';
import { passwordSchema } from '../lib/password.js';
import { audit } from '../lib/audit.js';
import { sendEmail, passwordResetEmail, verificationEmail, isEmailConfigured } from '../lib/email.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} from '../lib/refreshTokens.js';
import { verifyTotp, consumeBackupCode } from '../lib/twofa.js';
import { signTwoFaChallenge, verifyTwoFaChallenge } from './twofa.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstileToken } from '../lib/turnstile.js';

const router = Router();

const ACCESS_COOKIE = 'token';
const REFRESH_COOKIE = 'refresh_token';

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
};
const accessCookieOpts = { ...cookieBase, maxAge: 15 * 60 * 1000 }; // 15 min
const refreshCookieOpts = {
  ...cookieBase,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/api/auth',
};

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 30;
const VERIFY_TOKEN_TTL_HOURS = 48;

function publicUser(user: {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  currentCompanyId: string | null;
  currentCompanyRole: string | null;
  emailVerified: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    avatar_url: user.avatarUrl,
    role: user.role,
    email_verified: user.emailVerified,
    /** inbox = real email (Resend); console = link only in server logs / dev UI */
    email_delivery: isEmailConfigured ? 'inbox' : 'console',
    data: {
      current_company_id: user.currentCompanyId,
      current_company_role: user.currentCompanyRole,
    },
  };
}

function hashStr(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueSession(user: { id: string; email: string; tokenVersion: number }, req: Request, res: Response) {
  const accessToken = signToken({ sub: user.id, email: user.email, tv: user.tokenVersion });
  const refresh = await issueRefreshToken({
    userId: user.id,
    tokenVersion: user.tokenVersion,
    req,
  });
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOpts);
  res.cookie(REFRESH_COOKIE, refresh.token, refreshCookieOpts);
  return { accessToken, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

// ── Signup ────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: passwordSchema,
  full_name: z.string().min(1).max(120).optional(),
  turnstile_token: z.string().nullish(),
});

router.post('/signup', authLimiter, async (req, res) => {
  const { email, password, full_name, turnstile_token } = signupSchema.parse(req.body);
  await verifyTurnstileToken(turnstile_token, req.ip ?? undefined);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await audit(req, { action: 'auth.signup', entity: 'User', metadata: { email, exists: true } });
    throw new HttpError(409, 'Could not create account');
  }

  const passwordHashed = await hashPassword(password);
  const verifyRaw = randomBytes(32).toString('hex');
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: passwordHashed,
      fullName: full_name,
      emailVerificationToken: hashStr(verifyRaw),
      emailVerificationExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  // Send verification email (silent failure — we don't block signup if mail fails)
  try {
    const verifyUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${verifyRaw}`;
    const tpl = verificationEmail(verifyUrl);
    await sendEmail({ to: email, ...tpl });
    if (!isEmailConfigured) {
      console.log(`[verify-email] link for ${email}: ${verifyUrl}`);
    }
  } catch (err) {
    console.error('[signup] failed to send verification email:', err);
  }

  const session = await issueSession(user, req, res);
  await audit(req, { action: 'auth.signup', entity: 'User', entityId: user.id });
  res.json({
    token: session.accessToken,
    refresh_token: session.refreshToken,
    user: publicUser(user),
  });
});

// ── Login ─────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(128),
  turnstile_token: z.string().nullish(),
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password, turnstile_token } = loginSchema.parse(req.body);
  await verifyTurnstileToken(turnstile_token, req.ip ?? undefined);
  const user = await prisma.user.findUnique({ where: { email } });

  const genericFail = new HttpError(401, 'Invalid credentials');

  if (!user || !user.passwordHash) {
    await audit(req, { action: 'auth.login.fail', metadata: { email, reason: 'no_user' } });
    throw genericFail;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await audit(req, {
      action: 'auth.login.locked',
      entity: 'User',
      entityId: user.id,
      metadata: { lockedUntil: user.lockedUntil.toISOString() },
    });
    throw new HttpError(
      423,
      `Account temporarily locked. Try again after ${user.lockedUntil.toISOString()}.`,
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const newCount = user.failedLoginCount + 1;
    const shouldLock = newCount >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : newCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });
    await audit(req, {
      action: 'auth.login.fail',
      entity: 'User',
      entityId: user.id,
      metadata: { failedCount: newCount, locked: shouldLock },
    });
    throw genericFail;
  }

  // Password is correct. If 2FA is enabled, do NOT issue a session yet —
  // return a short-lived challenge token instead. Frontend will collect the
  // code and POST it to /login/2fa.
  if (user.totpEnabled) {
    const challengeToken = signTwoFaChallenge(user.id);
    await audit(req, {
      action: 'auth.login.success',
      entity: 'User',
      entityId: user.id,
      metadata: { stage: '2fa_required' },
    });
    return res.json({
      requires_2fa: true,
      challenge_token: challengeToken,
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip ?? null,
    },
  });

  const session = await issueSession(updated, req, res);
  await audit(req, { action: 'auth.login.success', entity: 'User', entityId: updated.id });
  res.json({
    token: session.accessToken,
    refresh_token: session.refreshToken,
    user: publicUser(updated),
  });
});

// Second step of login when 2FA is enabled.
const twoFaSchema = z.object({
  challenge_token: z.string().min(10),
  // Either a TOTP code (6-8 digits) or a backup code (XXXX-XXXXXX).
  code: z.string().min(6).max(16),
});

router.post('/login/2fa', authLimiter, async (req, res) => {
  const { challenge_token, code } = twoFaSchema.parse(req.body);

  let payload;
  try {
    payload = verifyTwoFaChallenge(challenge_token);
  } catch {
    throw new HttpError(401, 'Challenge expired. Sign in again.');
  }
  if (payload.kind !== '2fa_pending') throw new HttpError(400, 'Invalid challenge');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.totpEnabled || !user.totpSecret) {
    throw new HttpError(400, 'No 2FA enrolled');
  }

  // Try as TOTP first; fall back to backup code
  let ok = verifyTotp(user.totpSecret, code);
  let usedBackupCode = false;
  if (!ok) {
    ok = await consumeBackupCode(user.id, code);
    usedBackupCode = ok;
  }
  if (!ok) {
    await audit(req, {
      action: 'auth.login.fail',
      entity: 'User',
      entityId: user.id,
      metadata: { stage: '2fa', reason: 'bad_code' },
    });
    throw new HttpError(401, 'Invalid 2FA code');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip ?? null,
    },
  });
  const session = await issueSession(updated, req, res);
  await audit(req, {
    action: 'auth.login.success',
    entity: 'User',
    entityId: updated.id,
    metadata: { stage: '2fa_ok', used_backup_code: usedBackupCode },
  });
  res.json({
    token: session.accessToken,
    refresh_token: session.refreshToken,
    user: publicUser(updated),
    used_backup_code: usedBackupCode,
  });
});

// ── Refresh ───────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const refreshToken =
    (typeof req.body?.refresh_token === 'string' && req.body.refresh_token) ||
    (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
  if (!refreshToken) throw new HttpError(401, 'No refresh token');

  const result = await rotateRefreshToken({ presentedToken: refreshToken, req });
  if (result.status !== 'ok' || !result.userId || !result.newToken) {
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    if (result.status === 'reuse_detected') {
      await audit(req, { action: 'auth.logout', metadata: { reason: 'refresh_token_reuse' } });
    }
    throw new HttpError(401, 'Refresh token invalid');
  }

  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  if (!user) throw new HttpError(401, 'User no longer exists');

  const accessToken = signToken({ sub: user.id, email: user.email, tv: user.tokenVersion });
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOpts);
  res.cookie(REFRESH_COOKIE, result.newToken, refreshCookieOpts);
  res.json({
    token: accessToken,
    refresh_token: result.newToken,
    user: publicUser(user),
  });
});

// ── Logout (single session) ──────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const refreshToken =
    (typeof req.body?.refresh_token === 'string' && req.body.refresh_token) ||
    (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.clearCookie(ACCESS_COOKIE);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  if (req.user) {
    await audit(req, { action: 'auth.logout', entity: 'User', entityId: req.user.id });
  }
  res.json({ ok: true });
});

// ── Logout everywhere ────────────────────────────────────────────────

router.post('/logout-all', requireAuth, async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  await revokeAllForUser(req.user.id);
  res.clearCookie(ACCESS_COOKIE);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  await audit(req, {
    action: 'auth.logout',
    entity: 'User',
    entityId: req.user.id,
    metadata: { all_sessions: true },
  });
  res.json({ ok: true });
});

// ── Me ────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  let user = req.user;

  if (!user.currentCompanyId) {
    const member = await prisma.teamMember.findFirst({
      where: { userEmail: user.email, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    if (member) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          currentCompanyId: member.companyId,
          currentCompanyRole: member.role,
        },
      });
    } else {
      const owned = await prisma.company.findFirst({
        where: { ownerEmail: user.email },
        orderBy: { createdAt: 'asc' },
      });
      if (owned) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { currentCompanyId: owned.id, currentCompanyRole: 'owner' },
        });
      }
    }
  }

  res.json({ user: publicUser(user) });
});

const updateMeSchema = z.object({
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  current_company_id: z.string().nullable().optional(),
  current_company_role: z
    .enum(['owner', 'manager', 'staff', 'accountant'])
    .nullable()
    .optional(),
});

router.patch('/me', requireAuth, async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const data = updateMeSchema.parse(req.body);

  let companyRole: string | undefined = data.current_company_role ?? undefined;

  if (data.current_company_id) {
    const member = await prisma.teamMember.findUnique({
      where: {
        companyId_userEmail: {
          companyId: data.current_company_id,
          userEmail: req.user.email,
        },
      },
    });
    const owned = await prisma.company.findFirst({
      where: { id: data.current_company_id, ownerEmail: req.user.email },
      select: { id: true },
    });
    if ((!member || member.status !== 'active') && !owned) {
      throw new HttpError(403, 'Not a member of that company');
    }
    if (member?.status === 'active') {
      if (data.current_company_role && data.current_company_role !== member.role) {
        throw new HttpError(403, 'Cannot impersonate a different role');
      }
      companyRole = companyRole ?? member.role;
    } else if (owned) {
      companyRole = companyRole ?? 'owner';
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      fullName: data.full_name ?? undefined,
      avatarUrl: data.avatar_url ?? undefined,
      currentCompanyId: data.current_company_id ?? undefined,
      currentCompanyRole: companyRole,
    },
  });
  res.json({ user: publicUser(updated) });
});

// ── Email verification ────────────────────────────────────────────────

router.post('/verify-email/resend', requireAuth, async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  if (req.user.emailVerified) return res.json({ ok: true, alreadyVerified: true });

  const verifyRaw = randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      emailVerificationToken: hashStr(verifyRaw),
      emailVerificationExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });
  const verifyUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${verifyRaw}`;
  try {
    const tpl = verificationEmail(verifyUrl);
    await sendEmail({ to: req.user.email, ...tpl });
    if (!isEmailConfigured) console.log(`[verify-email] link for ${req.user.email}: ${verifyUrl}`);
  } catch (err) {
    console.error('[verify-email:resend] failed:', err);
  }
  const payload: Record<string, unknown> = {
    ok: true,
    email_delivery: isEmailConfigured ? 'inbox' : 'console',
  };
  // Local dev only: return link in API so you don't have to hunt terminal logs
  if (env.NODE_ENV !== 'production' && !isEmailConfigured) {
    payload.verify_url = verifyUrl;
  }
  res.json(payload);
});

const verifyConfirmSchema = z.object({ token: z.string().min(32) });

router.post('/verify-email/confirm', async (req, res) => {
  const { token } = verifyConfirmSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: hashStr(token) },
  });
  if (
    !user ||
    !user.emailVerificationExpires ||
    user.emailVerificationExpires < new Date()
  ) {
    throw new HttpError(400, 'Verification link is invalid or expired');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });
  res.json({ ok: true });
});

// ── Change password (logged-in) ───────────────────────────────────────

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: passwordSchema,
});

router.post('/change-password', requireAuth, async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  if (!req.user.passwordHash) {
    throw new HttpError(400, 'This account signs in with Google — no password to change');
  }
  const { current_password, new_password } = changePasswordSchema.parse(req.body);
  if (current_password === new_password) {
    throw new HttpError(400, 'New password must differ from the current one');
  }
  const ok = await verifyPassword(current_password, req.user.passwordHash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const newHash = await hashPassword(new_password);
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      passwordHash: newHash,
      tokenVersion: { increment: 1 }, // sign out other sessions
    },
  });
  await revokeAllForUser(req.user.id);

  // Re-issue a fresh session for the current device so the user stays signed in here
  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (fresh) {
    const session = await issueSession(fresh, req, res);
    await audit(req, { action: 'auth.role_change', entity: 'User', entityId: fresh.id, metadata: { kind: 'password_changed' } });
    return res.json({
      ok: true,
      token: session.accessToken,
      refresh_token: session.refreshToken,
    });
  }
  res.json({ ok: true });
});

// ── Password reset ────────────────────────────────────────────────────

const resetRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  turnstile_token: z.string().nullish(),
});

router.post('/password-reset/request', authLimiter, async (req, res) => {
  const { email, turnstile_token } = resetRequestSchema.parse(req.body);
  await verifyTurnstileToken(turnstile_token, req.ip ?? undefined);
  const user = await prisma.user.findUnique({ where: { email } });
  let devResetUrl: string | undefined;

  if (user) {
    const raw = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashStr(raw), passwordResetExpires: expires },
    });

    const resetUrl = `${env.CLIENT_ORIGIN}/reset-password?token=${raw}`;
    if (env.NODE_ENV !== 'production' && !isEmailConfigured) {
      devResetUrl = resetUrl;
    }
    try {
      const tpl = passwordResetEmail(resetUrl, RESET_TOKEN_TTL_MINUTES);
      await sendEmail({ to: email, ...tpl });
      if (!isEmailConfigured) console.log(`[password-reset] link for ${email}: ${resetUrl}`);
    } catch (err) {
      console.error('[password-reset] failed to send email:', err);
    }

    await audit(req, {
      action: 'auth.password_reset.request',
      entity: 'User',
      entityId: user.id,
    });
  } else {
    await audit(req, {
      action: 'auth.password_reset.request',
      metadata: { email, exists: false },
    });
  }

  const payload: Record<string, unknown> = {
    ok: true,
    message: 'If that email is registered, a reset link has been sent.',
    email_delivery: isEmailConfigured ? 'inbox' : 'console',
  };
  if (devResetUrl) payload.reset_url = devResetUrl;
  res.json(payload);
});

const resetConfirmSchema = z.object({
  token: z.string().min(32),
  password: passwordSchema,
});

router.post('/password-reset/confirm', authLimiter, async (req, res) => {
  const { token, password } = resetConfirmSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { passwordResetToken: hashStr(token) },
  });
  if (
    !user ||
    !user.passwordResetExpires ||
    user.passwordResetExpires < new Date()
  ) {
    throw new HttpError(400, 'Reset link is invalid or expired');
  }

  const passwordHashed = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: passwordHashed,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: { increment: 1 }, // invalidate all existing sessions
    },
  });
  // Also revoke all refresh tokens for this user
  await revokeAllForUser(user.id);

  await audit(req, {
    action: 'auth.password_reset.complete',
    entity: 'User',
    entityId: user.id,
  });
  res.json({ ok: true });
});

// ── Google OAuth ──────────────────────────────────────────────────────

const googleStates = new Map<string, { fromUrl?: string; expires: number }>();

router.get('/google', (req, res) => {
  if (!isGoogleConfigured) throw new HttpError(503, 'Google OAuth not configured');
  const state = randomBytes(24).toString('hex');
  const fromUrl = typeof req.query.from_url === 'string' ? req.query.from_url : undefined;
  googleStates.set(state, { fromUrl, expires: Date.now() + 10 * 60 * 1000 });
  res.redirect(getGoogleAuthUrl(state));
});

router.get('/google/callback', async (req, res) => {
  if (!isGoogleConfigured) throw new HttpError(503, 'Google OAuth not configured');
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) throw new HttpError(400, 'Missing code or state');

  const stored = googleStates.get(state);
  googleStates.delete(state);
  if (!stored || stored.expires < Date.now()) {
    throw new HttpError(400, 'Invalid or expired state');
  }

  const profile = await exchangeCodeForProfile(code);
  const user = await prisma.user.upsert({
    where: { email: profile.email.toLowerCase() },
    update: {
      googleId: profile.sub,
      avatarUrl: profile.picture ?? undefined,
      emailVerified: true,
    },
    create: {
      email: profile.email.toLowerCase(),
      googleId: profile.sub,
      fullName: profile.name,
      avatarUrl: profile.picture,
      emailVerified: true,
    },
  });

  const session = await issueSession(user, req, res);
  await audit(req, { action: 'auth.google', entity: 'User', entityId: user.id });

  const redirectTo = stored.fromUrl || env.CLIENT_ORIGIN;
  const url = new URL(redirectTo);
  url.searchParams.set('access_token', session.accessToken);
  url.searchParams.set('refresh_token', session.refreshToken);
  res.redirect(url.toString());
});

router.get('/google/status', (_req, res) => {
  res.json({ configured: isGoogleConfigured });
});

export default router;
