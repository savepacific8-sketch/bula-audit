import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { isAdmin, requireCompanyRole } from '../lib/permissions.js';
import { serializePaymentProof } from '../lib/serializers.js';

const router = Router();
router.use(requireAuth);

const paymentMethods = ['mpaisa', 'bank_transfer', 'cash', 'other'] as const;
const statuses = ['pending', 'approved', 'rejected'] as const;

const createSchema = z.object({
  company_id: z.string().min(1),
  subscription_id: z.string().nullable().optional(),
  proof_url: z.string().min(1),
  proof_filename: z.string().nullable().optional(),
  payment_method: z.enum(paymentMethods),
  amount_paid: z.number(),
  payment_date: z.string().nullable().optional(),
  reference_number: z.string().nullable().optional(),
  plan_requested: z.string().nullable().optional(),
  billing_cycle_requested: z.string().nullable().optional(),
});

const updateSchema = z.object({
  status: z.enum(statuses).optional(),
  reviewed_by: z.string().nullable().optional(),
  reviewed_date: z.string().nullable().optional(),
  review_notes: z.string().nullable().optional(),
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
  const where: Prisma.PaymentProofWhereInput = {};
  if (typeof company_id === 'string') where.companyId = company_id;

  if (!isAdmin(user)) {
    if (typeof company_id !== 'string') {
      where.submittedBy = user.email;
    } else if (user.currentCompanyId !== company_id) {
      where.submittedBy = user.email;
    }
  }

  const rows = await prisma.paymentProof.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(rows.map(serializePaymentProof));
});

router.post('/', async (req, res) => {
  const user = req.user!;
  const data = createSchema.parse(req.body);
  if (!isAdmin(user)) requireCompanyRole(user, data.company_id, ['owner', 'manager']);

  const created = await prisma.paymentProof.create({
    data: {
      companyId: data.company_id,
      subscriptionId: data.subscription_id ?? null,
      proofUrl: data.proof_url,
      proofFilename: data.proof_filename ?? null,
      paymentMethod: data.payment_method,
      amountPaid: data.amount_paid,
      paymentDate: toDate(data.payment_date) ?? null,
      referenceNumber: data.reference_number ?? null,
      planRequested: data.plan_requested ?? null,
      billingCycleRequested: data.billing_cycle_requested ?? null,
      submittedBy: user.email,
      status: 'pending',
    },
  });
  res.status(201).json(serializePaymentProof(created));
});

router.patch('/:id', async (req, res) => {
  const user = req.user!;
  const proof = await prisma.paymentProof.findUnique({ where: { id: req.params.id } });
  if (!proof) throw new HttpError(404, 'PaymentProof not found');
  if (!isAdmin(user)) requireCompanyRole(user, proof.companyId, ['owner', 'manager']);

  const data = updateSchema.parse(req.body);
  const updated = await prisma.paymentProof.update({
    where: { id: proof.id },
    data: {
      status: data.status ?? undefined,
      reviewedBy: data.reviewed_by ?? undefined,
      reviewedDate: toDate(data.reviewed_date),
      reviewNotes: data.review_notes ?? undefined,
    },
  });
  res.json(serializePaymentProof(updated));
});

router.delete('/:id', async (req, res) => {
  const user = req.user!;
  if (!isAdmin(user)) throw new HttpError(403, 'Admin only');
  await prisma.paymentProof.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
