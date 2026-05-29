import type { Request } from 'express';
import { prisma } from '../prisma.js';

export type AuditAction =
  | 'auth.signup'
  | 'auth.login.success'
  | 'auth.login.fail'
  | 'auth.login.locked'
  | 'auth.logout'
  | 'auth.google'
  | 'auth.password_reset.request'
  | 'auth.password_reset.complete'
  | 'auth.role_change'
  | 'company.create'
  | 'company.update'
  | 'company.delete'
  | 'receipt.create'
  | 'receipt.update'
  | 'receipt.delete'
  | 'receipt.approve'
  | 'receipt.reject'
  | 'team.invite'
  | 'team.update'
  | 'team.remove'
  | 'subscription.update'
  | 'payment_proof.review'
  | 'admin.action';

interface AuditEntry {
  action: AuditAction;
  entity?: string;
  entityId?: string;
  companyId?: string;
  metadata?: unknown;
}

function getIp(req?: Request): string | undefined {
  if (!req) return undefined;
  // Trust proxy must be enabled in Express config for production
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}

function getUserAgent(req?: Request): string | undefined {
  if (!req) return undefined;
  const ua = req.headers['user-agent'];
  if (!ua) return undefined;
  return ua.length > 500 ? ua.slice(0, 500) : ua;
}

/**
 * Record a sensitive action to the audit log. Never throws — audit failures
 * must not block the actual operation.
 */
export async function audit(
  req: Request | undefined,
  entry: AuditEntry,
): Promise<void> {
  try {
    const user = req?.user;
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        companyId: entry.companyId ?? null,
        ip: getIp(req) ?? null,
        userAgent: getUserAgent(req) ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  } catch (err) {
    // Audit must never crash the request. Log to stderr for ops visibility.
    console.error('[audit] failed to record entry:', err);
  }
}
