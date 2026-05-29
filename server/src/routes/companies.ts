import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { isAdmin, requireCompanyRole } from '../lib/permissions.js';
import { serializeCompany } from '../lib/serializers.js';

const router = Router();
router.use(requireAuth);

const businessTypes = [
  'sole_trader',
  'partnership',
  'limited_company',
  'cooperative',
  'ngo',
  'government',
  'other',
] as const;

const upsertSchema = z.object({
  name: z.string().min(1),
  tin: z.string().nullable().optional(),
  business_type: z.enum(businessTypes).nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  vat_registered: z.boolean().optional(),
  vat_rate: z.number().optional(),
  owner_email: z.string().email().optional(),
});

// List companies the user can access (admin: all, others: their memberships + owned).
router.get('/', async (req, res) => {
  const user = req.user!;
  if (isAdmin(user)) {
    const rows = await prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(rows.map(serializeCompany));
  }
  const memberships = await prisma.teamMember.findMany({
    where: { userEmail: user.email, status: 'active' },
    select: { companyId: true },
  });
  const ids = Array.from(
    new Set([
      ...memberships.map((m) => m.companyId),
    ]),
  );
  const rows = await prisma.company.findMany({
    where: {
      OR: [{ id: { in: ids } }, { ownerEmail: user.email }],
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(serializeCompany));
});

router.get('/:id', async (req, res) => {
  const user = req.user!;
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) throw new HttpError(404, 'Company not found');
  if (!isAdmin(user) && company.ownerEmail !== user.email) {
    const membership = await prisma.teamMember.findUnique({
      where: { companyId_userEmail: { companyId: company.id, userEmail: user.email } },
    });
    if (!membership) throw new HttpError(403, 'No access to this company');
  }
  res.json(serializeCompany(company));
});

router.post('/', async (req, res) => {
  const user = req.user!;
  const data = upsertSchema.parse(req.body);

  const created = await prisma.company.create({
    data: {
      name: data.name,
      tin: data.tin ?? null,
      businessType: data.business_type ?? null,
      phone: data.phone ?? null,
      email: data.email ? data.email : null,
      address: data.address ?? null,
      vatRegistered: data.vat_registered ?? false,
      vatRate: data.vat_rate ?? 12.5,
      ownerEmail: data.owner_email ?? user.email,
    },
  });

  // Auto-create owner TeamMember and set user's active company
  await prisma.teamMember.create({
    data: {
      companyId: created.id,
      userEmail: created.ownerEmail,
      userName: user.fullName ?? user.email,
      role: 'owner',
      status: 'active',
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { currentCompanyId: created.id, currentCompanyRole: 'owner' },
  });

  res.status(201).json(serializeCompany(created));
});

router.patch('/:id', async (req, res) => {
  const user = req.user!;
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) throw new HttpError(404, 'Company not found');

  if (!isAdmin(user) && company.ownerEmail !== user.email) {
    requireCompanyRole(user, company.id, ['owner', 'manager']);
  }

  const data = upsertSchema.partial().parse(req.body);
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      name: data.name ?? undefined,
      tin: data.tin ?? undefined,
      businessType: data.business_type ?? undefined,
      phone: data.phone ?? undefined,
      email: data.email === '' ? null : data.email ?? undefined,
      address: data.address ?? undefined,
      vatRegistered: data.vat_registered ?? undefined,
      vatRate: data.vat_rate ?? undefined,
    },
  });
  res.json(serializeCompany(updated));
});

router.delete('/:id', async (req, res) => {
  const user = req.user!;
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) throw new HttpError(404, 'Company not found');
  if (!isAdmin(user) && company.ownerEmail !== user.email) {
    throw new HttpError(403, 'Only owner or admin can delete a company');
  }
  await prisma.company.delete({ where: { id: company.id } });
  res.json({ ok: true });
});

export default router;
