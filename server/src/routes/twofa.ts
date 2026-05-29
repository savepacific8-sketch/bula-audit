// 2FA management endpoints. The login-time challenge lives in routes/auth.ts;
// these endpoints handle setup, confirmation, and disabling.

import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../lib/audit.js';
import { verifyPassword } from '../lib/auth.js';
import {
  generateSecret,
  makeOtpAuthUrl,
  makeQrDataUrl,
  verifyTotp,
  generateBackupCodes,
  replaceBackupCodes,
} from '../lib/twofa.js';

const router = Router();
router.use(requireAuth);

router.get('/status', async (req, res) => {
  const user = req.user!;
  res.json({
    enabled: user.totpEnabled,
    confirmedAt: user.totpConfirmedAt?.toISOString() ?? null,
  });
});

// Step 1: generate (or regenerate) a pending secret and return a QR code.
// Secret is stored on the user but `totpEnabled` stays false until confirmed.
router.post('/setup', async (req, res) => {
  const user = req.user!;
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false, totpConfirmedAt: null },
  });
  const otpAuthUrl = makeOtpAuthUrl(user.email, secret);
  const qrDataUrl = await makeQrDataUrl(otpAuthUrl);
  res.json({ secret, otpauth_url: otpAuthUrl, qr_data_url: qrDataUrl });
});

const confirmSchema = z.object({ token: z.string().min(6).max(8) });

// Step 2: user enters a 6-digit code; if it matches, enable 2FA and return
// one-time backup codes.
router.post('/confirm', async (req, res) => {
  const user = req.user!;
  if (!user.totpSecret) throw new HttpError(400, 'Run /setup first');
  const { token } = confirmSchema.parse(req.body);
  if (!verifyTotp(user.totpSecret, token)) {
    await audit(req, { action: 'admin.action', metadata: { kind: '2fa.confirm.fail' } });
    throw new HttpError(400, 'Invalid code');
  }

  const codes = generateBackupCodes(10);
  await replaceBackupCodes(user.id, codes);
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpConfirmedAt: new Date() },
  });

  await audit(req, {
    action: 'admin.action',
    entity: 'User',
    entityId: user.id,
    metadata: { kind: '2fa.enabled' },
  });

  // Codes are returned ONCE — never retrievable again.
  res.json({ enabled: true, backup_codes: codes });
});

const disableSchema = z.object({
  password: z.string().min(1),
  token: z.string().min(6).max(8).optional(),
});

router.post('/disable', async (req, res) => {
  const user = req.user!;
  const { password, token } = disableSchema.parse(req.body);
  if (!user.passwordHash) throw new HttpError(400, 'Account has no password set');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Password incorrect');

  // If 2FA was actually on, also require a current code or backup code
  if (user.totpEnabled) {
    const codeOk = token && user.totpSecret ? verifyTotp(user.totpSecret, token) : false;
    if (!codeOk) throw new HttpError(401, 'Valid 2FA code required to disable');
  }

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: false, totpSecret: null, totpConfirmedAt: null },
    }),
  ]);

  await audit(req, {
    action: 'admin.action',
    entity: 'User',
    entityId: user.id,
    metadata: { kind: '2fa.disabled' },
  });
  res.json({ enabled: false });
});

router.post('/backup-codes/regenerate', async (req, res) => {
  const user = req.user!;
  if (!user.totpEnabled) throw new HttpError(400, '2FA not enabled');
  const codes = generateBackupCodes(10);
  await replaceBackupCodes(user.id, codes);
  await audit(req, {
    action: 'admin.action',
    entity: 'User',
    entityId: user.id,
    metadata: { kind: '2fa.backup_codes_regenerated' },
  });
  res.json({ backup_codes: codes });
});

export default router;

// ── Helper exported for login flow (see routes/auth.ts) ────────────

export interface TwoFaChallengePayload {
  sub: string;
  kind: '2fa_pending';
}

export function signTwoFaChallenge(userId: string): string {
  return jwt.sign({ sub: userId, kind: '2fa_pending' }, env.JWT_SECRET, {
    expiresIn: '10m',
  } as jwt.SignOptions);
}

export function verifyTwoFaChallenge(token: string): TwoFaChallengePayload {
  return jwt.verify(token, env.JWT_SECRET) as TwoFaChallengePayload;
}
