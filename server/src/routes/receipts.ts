import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { isAdmin, requireCompanyRole } from '../lib/permissions.js';
import { serializeReceiptForApi } from '../lib/mediaUrls.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

const vatTypes = [
  'inclusive',
  'exclusive',
  'zero_rated',
  'exempt',
  'no_vat',
  'manual',
] as const;
const paymentMethods = [
  'cash',
  'card',
  'bank_transfer',
  'cheque',
  'mobile_money',
  'other',
] as const;
const paymentStatuses = ['unpaid', 'paid'] as const;
const categories = [
  'office_supplies',
  'utilities',
  'rent',
  'transport',
  'food_beverage',
  'equipment',
  'repairs_maintenance',
  'professional_services',
  'marketing',
  'insurance',
  'inventory',
  'wages',
  'telecommunications',
  'travel',
  'other',
] as const;
const statuses = ['pending', 'approved', 'rejected'] as const;

const upsertSchema = z.object({
  company_id: z.string().min(1).optional(),
  photo_url: z.string().min(1).optional(),
  document_url: z.string().nullable().optional(),
  document_name: z.string().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  supplier_tin: z.string().nullable().optional(),
  receipt_number: z.string().nullable().optional(),
  receipt_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  vat_type: z.enum(vatTypes).optional(),
  vat_rate: z.number().nullable().optional(),
  vat_amount: z.number().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  payment_method: z.enum(paymentMethods).nullable().optional(),
  payment_status: z.enum(paymentStatuses).optional(),
  category: z.enum(categories).nullable().optional(),
  item_lines: z.array(z.unknown()).nullable().optional(),
  ai_confidence: z.number().nullable().optional(),
  ai_missing_fields: z.array(z.string()).nullable().optional(),
  status: z.enum(statuses).optional(),
  notes: z.string().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  reviewed_date: z.string().nullable().optional(),
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

router.get('/', async (req, res) => {
  const user = req.user!;
  const { company_id, status, uploaded_by, include_deleted } = req.query;

  const where: Prisma.ReceiptWhereInput = { deletedAt: null };
  if (typeof company_id === 'string') where.companyId = company_id;
  if (typeof status === 'string') where.status = status;
  if (typeof uploaded_by === 'string') where.uploadedBy = uploaded_by;

  // Only admins may see soft-deleted records (for FRCS audit)
  if (isAdmin(user) && include_deleted === 'true') delete where.deletedAt;

  if (!isAdmin(user)) {
    if (typeof company_id !== 'string') {
      return res.json([]);
    }
    const role = user.currentCompanyId === company_id ? user.currentCompanyRole : null;
    if (!role) throw new HttpError(403, 'Not a member of this company');
    if (role === 'staff') where.uploadedBy = user.email;
  }

  const rows = await prisma.receipt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  res.json(await Promise.all(rows.map((r) => serializeReceiptForApi(r))));
});

router.get('/:id', async (req, res) => {
  const user = req.user!;
  const receipt = await prisma.receipt.findUnique({ where: { id: req.params.id } });
  if (!receipt) throw new HttpError(404, 'Receipt not found');
  // Hide soft-deleted from non-admins
  if (receipt.deletedAt && !isAdmin(user)) throw new HttpError(404, 'Receipt not found');
  if (!isAdmin(user)) {
    await requireCompanyRole(user, receipt.companyId, ['owner', 'manager', 'accountant', 'staff']);
    if (user.currentCompanyRole === 'staff' && receipt.uploadedBy !== user.email) {
      throw new HttpError(403, 'Staff can only view their own receipts');
    }
  }
  res.json(await serializeReceiptForApi(receipt));
});

router.post('/', async (req, res) => {
  const user = req.user!;
  const data = upsertSchema.parse(req.body);
  if (!data.company_id) throw new HttpError(400, 'company_id required');
  if (!data.photo_url) throw new HttpError(400, 'photo_url required');
  if (!isAdmin(user)) {
    await requireCompanyRole(user, data.company_id, ['owner', 'manager', 'staff']);
  }

  const created = await prisma.receipt.create({
    data: {
      companyId: data.company_id,
      photoUrl: data.photo_url,
      documentUrl: data.document_url ?? null,
      documentName: data.document_name ?? null,
      supplierName: data.supplier_name ?? null,
      supplierTin: data.supplier_tin ?? null,
      receiptNumber: data.receipt_number ?? null,
      receiptDate: toDate(data.receipt_date) ?? null,
      dueDate: toDate(data.due_date) ?? null,
      currency: data.currency ?? 'FJD',
      subtotal: data.subtotal ?? null,
      vatType: data.vat_type ?? 'inclusive',
      vatRate: data.vat_rate ?? null,
      vatAmount: data.vat_amount ?? null,
      totalAmount: data.total_amount ?? null,
      paymentMethod: data.payment_method ?? null,
      paymentStatus: data.payment_status ?? 'unpaid',
      category: data.category ?? null,
      itemLines: data.item_lines ? JSON.stringify(data.item_lines) : null,
      aiConfidence: data.ai_confidence ?? null,
      aiMissingFields: data.ai_missing_fields
        ? JSON.stringify(data.ai_missing_fields)
        : null,
      status: data.status ?? 'pending',
      notes: data.notes ?? null,
      uploadedBy: user.email,
    },
  });
  await audit(req, {
    action: 'receipt.create',
    entity: 'Receipt',
    entityId: created.id,
    companyId: created.companyId,
    metadata: { supplier: data.supplier_name, total: data.total_amount },
  });
  res.status(201).json(await serializeReceiptForApi(created));
});

router.patch('/:id', async (req, res) => {
  const user = req.user!;
  const receipt = await prisma.receipt.findUnique({ where: { id: req.params.id } });
  if (!receipt) throw new HttpError(404, 'Receipt not found');

  if (!isAdmin(user)) {
    await requireCompanyRole(user, receipt.companyId, ['owner', 'manager', 'staff']);
    if (user.currentCompanyRole === 'staff' && receipt.uploadedBy !== user.email) {
      throw new HttpError(403, 'Staff can only edit their own receipts');
    }
  }

  const data = upsertSchema.partial().parse(req.body);
  const updated = await prisma.receipt.update({
    where: { id: receipt.id },
    data: {
      photoUrl: data.photo_url ?? undefined,
      documentUrl: data.document_url ?? undefined,
      documentName: data.document_name ?? undefined,
      supplierName: data.supplier_name ?? undefined,
      supplierTin: data.supplier_tin ?? undefined,
      receiptNumber: data.receipt_number ?? undefined,
      receiptDate: toDate(data.receipt_date),
      dueDate: toDate(data.due_date),
      currency: data.currency ?? undefined,
      subtotal: data.subtotal ?? undefined,
      vatType: data.vat_type ?? undefined,
      vatRate: data.vat_rate ?? undefined,
      vatAmount: data.vat_amount ?? undefined,
      totalAmount: data.total_amount ?? undefined,
      paymentMethod: data.payment_method ?? undefined,
      paymentStatus: data.payment_status ?? undefined,
      category: data.category ?? undefined,
      itemLines:
        data.item_lines === undefined
          ? undefined
          : data.item_lines === null
            ? null
            : JSON.stringify(data.item_lines),
      aiConfidence: data.ai_confidence ?? undefined,
      aiMissingFields:
        data.ai_missing_fields === undefined
          ? undefined
          : data.ai_missing_fields === null
            ? null
            : JSON.stringify(data.ai_missing_fields),
      status: data.status ?? undefined,
      notes: data.notes ?? undefined,
      reviewedBy: data.reviewed_by ?? undefined,
      reviewedDate: toDate(data.reviewed_date),
    },
  });
  // Audit status changes separately so we can track approve/reject patterns
  if (data.status && data.status !== receipt.status) {
    await audit(req, {
      action:
        data.status === 'approved'
          ? 'receipt.approve'
          : data.status === 'rejected'
            ? 'receipt.reject'
            : 'receipt.update',
      entity: 'Receipt',
      entityId: receipt.id,
      companyId: receipt.companyId,
      metadata: { previousStatus: receipt.status, newStatus: data.status },
    });
  } else {
    await audit(req, {
      action: 'receipt.update',
      entity: 'Receipt',
      entityId: receipt.id,
      companyId: receipt.companyId,
    });
  }
  res.json(await serializeReceiptForApi(updated));
});

// Soft delete by default (FRCS-style retention). Admin can force-purge
// with ?permanent=true. Already-deleted receipts remain hidden from
// non-admin queries (see filter in GET /).
router.delete('/:id', async (req, res) => {
  const user = req.user!;
  const receipt = await prisma.receipt.findUnique({ where: { id: req.params.id } });
  if (!receipt) throw new HttpError(404, 'Receipt not found');
  if (!isAdmin(user)) await requireCompanyRole(user, receipt.companyId, ['owner', 'manager']);

  const permanent = isAdmin(user) && req.query.permanent === 'true';
  if (permanent) {
    await prisma.receipt.delete({ where: { id: receipt.id } });
  } else {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { deletedAt: new Date() },
    });
  }
  await audit(req, {
    action: 'receipt.delete',
    entity: 'Receipt',
    entityId: receipt.id,
    companyId: receipt.companyId,
    metadata: { permanent },
  });
  res.json({ ok: true, soft: !permanent });
});

export default router;
