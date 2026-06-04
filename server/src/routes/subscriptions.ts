import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { isAdmin, requireCompanyRole } from '../lib/permissions.js';
import { serializeSubscription } from '../lib/serializers.js';

const router = Router();
router.use(requireAuth);

const plans = ['free', 'free_trial', 'starter', 'business', 'pro', 'accountant'] as const;
const cycles = ['monthly', 'yearly'] as const;
const statuses = [
  'free',
  'trial',
  'active',
  'pending_payment',
  'overdue',
  'suspended',
  'cancelled',
] as const;

const upsertSchema = z.object({
  company_id: z.string().min(1).optional(),
  plan: z.enum(plans).optional(),
  billing_cycle: z.enum(cycles).optional(),
  status: z.enum(statuses).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  next_payment_date: z.string().nullable().optional(),
  amount_due: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

router.get('/', async (req, res) => {
  const user = req.user!;
  const { company_id } = req.query;
  const where: Prisma.SubscriptionWhereInput = {};
  if (typeof company_id === 'string') where.companyId = company_id;

  if (!isAdmin(user)) {
    if (typeof company_id !== 'string') return res.json([]);
    await requireCompanyRole(user, company_id, ['owner', 'accountant']);
  }

  const rows = await prisma.subscription.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(rows.map(serializeSubscription));
});

router.post('/', async (req, res) => {
  const user = req.user!;
  const data = upsertSchema.parse(req.body);
  if (!data.company_id) throw new HttpError(400, 'company_id required');
  if (!data.plan) throw new HttpError(400, 'plan required');
  if (!isAdmin(user)) await requireCompanyRole(user, data.company_id, ['owner', 'manager']);

  const created = await prisma.subscription.create({
    data: {
      companyId: data.company_id,
      plan: data.plan,
      billingCycle: data.billing_cycle ?? 'monthly',
      status: data.status ?? 'trial',
      startDate: toDate(data.start_date) ?? null,
      endDate: toDate(data.end_date) ?? null,
      nextPaymentDate: toDate(data.next_payment_date) ?? null,
      amountDue: data.amount_due ?? null,
      notes: data.notes ?? null,
    },
  });
  res.status(201).json(serializeSubscription(created));
});

router.patch('/:id', async (req, res) => {
  const user = req.user!;
  const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
  if (!sub) throw new HttpError(404, 'Subscription not found');

  if (!isAdmin(user)) await requireCompanyRole(user, sub.companyId, ['owner']);

  const data = upsertSchema.partial().parse(req.body);
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      plan: data.plan ?? undefined,
      billingCycle: data.billing_cycle ?? undefined,
      status: data.status ?? undefined,
      startDate: toDate(data.start_date),
      endDate: toDate(data.end_date),
      nextPaymentDate: toDate(data.next_payment_date),
      amountDue: data.amount_due ?? undefined,
      notes: data.notes ?? undefined,
    },
  });
  res.json(serializeSubscription(updated));
});

router.delete('/:id', async (req, res) => {
  const user = req.user!;
  if (!isAdmin(user)) throw new HttpError(403, 'Admin only');
  await prisma.subscription.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
