// Audit log query API — admin-only, paginated, filterable.

import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const querySchema = z.object({
  user_email: z.string().email().optional(),
  action:     z.string().optional(),
  entity:     z.string().optional(),
  entity_id:  z.string().optional(),
  company_id: z.string().optional(),
  from:       z.string().optional(),
  to:         z.string().optional(),
  cursor:     z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/', async (req, res) => {
  const q = querySchema.parse(req.query);

  const where: Prisma.AuditLogWhereInput = {};
  if (q.user_email) where.userEmail = q.user_email;
  if (q.action)     where.action    = q.action;
  if (q.entity)     where.entity    = q.entity;
  if (q.entity_id)  where.entityId  = q.entity_id;
  if (q.company_id) where.companyId = q.company_id;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to)   where.createdAt.lte = new Date(q.to);
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > q.limit;
  const data = hasMore ? rows.slice(0, q.limit) : rows;

  res.json({
    items: data.map((r) => ({
      id: r.id,
      user_id: r.userId,
      user_email: r.userEmail,
      action: r.action,
      entity: r.entity,
      entity_id: r.entityId,
      company_id: r.companyId,
      ip: r.ip,
      user_agent: r.userAgent,
      metadata: r.metadata ? safeParse(r.metadata) : null,
      created_date: r.createdAt.toISOString(),
    })),
    next_cursor: hasMore ? data[data.length - 1].id : null,
  });
});

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return s; }
}

export default router;
