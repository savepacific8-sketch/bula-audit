// TOTP-based 2FA + recovery (backup) codes.
//
// Secrets are stored unencrypted in the DB. For higher assurance, encrypt
// with a column key derived from JWT_SECRET; not done here to keep things
// inspectable.

import { authenticator } from 'otplib';
import { randomBytes, createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

authenticator.options = { window: 1 }; // accept previous + next 30s window

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function makeOtpAuthUrl(email: string, secret: string): string {
  const issuer = encodeURIComponent(env.APP_NAME);
  const account = encodeURIComponent(email);
  return authenticator.keyuri(account, env.APP_NAME, secret);
}

export async function makeQrDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });
}

export function verifyTotp(secret: string, token: string): boolean {
  if (!secret || !token) return false;
  try {
    return authenticator.check(token.replace(/\s/g, ''), secret);
  } catch {
    return false;
  }
}

// ── Backup codes ────────────────────────────────────────────────────

function hashCode(code: string): string {
  return createHash('sha256').update(code.toLowerCase()).digest('hex');
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 10-char base32-ish, easy to type, formatted as XXXX-XXXX
    const raw = randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 10)}`);
  }
  return codes;
}

export async function replaceBackupCodes(userId: string, codes: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: hashCode(c) })),
    }),
  ]);
}

/**
 * Consume a backup code. Returns true if it matched an unused code (and marks
 * it used). False otherwise.
 */
export async function consumeBackupCode(userId: string, presented: string): Promise<boolean> {
  const hash = hashCode(presented.trim());
  const row = await prisma.backupCode.findUnique({ where: { codeHash: hash } });
  if (!row || row.userId !== userId || row.usedAt) return false;
  await prisma.backupCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return true;
}
