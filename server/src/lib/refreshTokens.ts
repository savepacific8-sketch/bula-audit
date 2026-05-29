// Refresh-token issuance + rotation.
//
// Access tokens are short-lived JWTs (15 min). Refresh tokens are opaque
// 32-byte random values, stored in the DB as SHA-256 hashes so a leak of
// the DB doesn't grant session takeover.
//
// Rotation: every /refresh exchange returns a brand new refresh token and
// revokes the old one. If a revoked refresh token is later presented, we
// treat it as a reuse attack and revoke every refresh token for that user.

import { randomBytes, createHash } from 'node:crypto';
import type { Request } from 'express';
import { prisma } from '../prisma.js';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

interface IssueOpts {
  userId: string;
  tokenVersion: number;
  req?: Request;
  replacedById?: string | null;
}

export async function issueRefreshToken(opts: IssueOpts) {
  const raw = generateRefreshToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const row = await prisma.refreshToken.create({
    data: {
      userId: opts.userId,
      tokenHash,
      tokenVersion: opts.tokenVersion,
      userAgent: opts.req?.headers['user-agent']?.slice(0, 500) ?? null,
      ip: opts.req?.ip ?? null,
      expiresAt,
      replacedById: opts.replacedById ?? null,
    },
  });
  return { token: raw, id: row.id, expiresAt };
}

interface RotateOpts {
  presentedToken: string;
  req?: Request;
}

interface RotateResult {
  status: 'ok' | 'invalid' | 'expired' | 'revoked' | 'reuse_detected';
  userId?: string;
  tokenVersion?: number;
  newToken?: string;
  expiresAt?: Date;
}

/**
 * Validate + rotate a refresh token. Returns the new token + user id on success.
 */
export async function rotateRefreshToken(opts: RotateOpts): Promise<RotateResult> {
  const presentedHash = hashToken(opts.presentedToken);
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: presentedHash },
  });
  if (!row) return { status: 'invalid' };
  if (row.expiresAt < new Date()) return { status: 'expired' };
  if (row.revokedAt) {
    // Reuse of a revoked token = potential theft. Revoke every refresh
    // token for this user as a defense-in-depth measure.
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { status: 'reuse_detected' };
  }

  // Check the user still exists + token version hasn't been bumped
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return { status: 'invalid' };
  if (row.tokenVersion !== user.tokenVersion) return { status: 'revoked' };

  // Issue new token, mark old as revoked + replaced
  const issued = await issueRefreshToken({
    userId: user.id,
    tokenVersion: user.tokenVersion,
    req: opts.req,
  });
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date(), replacedById: issued.id },
  });
  return {
    status: 'ok',
    userId: user.id,
    tokenVersion: user.tokenVersion,
    newToken: issued.token,
    expiresAt: issued.expiresAt,
  };
}

/** Revoke a single refresh token (logout). */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke all refresh tokens + bump tokenVersion (logout-everywhere). */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);
}

/** Maintenance — delete revoked + expired tokens older than 30 days. */
export async function cleanupExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return count;
}
