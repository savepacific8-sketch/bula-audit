import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { isAdmin, requireCompanyRole } from '../lib/permissions.js';
import { serializeTeamMember } from '../lib/serializers.js';

const router = Router();
router.use(requireAuth);

const teamRoles = ['owner', 'manager', 'staff', 'accountant'] as const;
const teamStatuses = ['active', 'inactive'] as const;

router.get('/', async (req, res) => {
  const user = req.user!;
  const { company_id, user_email, status } = req.query;

  const where: Record<string, unknown> = {};
  if (typeof company_id === 'string') where.companyId = company_id;
  if (typeof user_email === 'string') where.userEmail = user_email;
  if (typeof status === 'string') where.status = status;

  if (!isAdmin(user)) {
    if (typeof company_id !== 'string') {
      where.userEmail = user.email;
    } else if (
      user.currentCompanyId !== company_id ||
      !['owner', 'manager', 'accountant'].includes(user.currentCompanyRole ?? '')
    ) {
      where.OR = [{ userEmail: user.email }];
      where.companyId = company_id;
    }
  }

  const rows = await prisma.teamMember.findMany({ where, orderBy: { createdAt: 'asc' } });
  res.json(rows.map(serializeTeamMember));
});

const createSchema = z.object({
  company_id: z.string().min(1),
  user_email: z.string().email(),
  user_name: z.string().nullable().optional(),
  role: z.enum(teamRoles),
  status: z.enum(teamStatuses).optional(),
});

router.post('/', async (req, res) => {
  const user = req.user!;
  const data = createSchema.parse(req.body);
  if (!isAdmin(user)) await requireCompanyRole(user, data.company_id, ['owner', 'manager']);

  const created = await prisma.teamMember.upsert({
    where: {
      companyId_userEmail: {
        companyId: data.company_id,
        userEmail: data.user_email,
      },
    },
    update: {
      role: data.role,
      status: data.status ?? 'active',
      userName: data.user_name ?? undefined,
    },
    create: {
      companyId: data.company_id,
      userEmail: data.user_email,
      userName: data.user_name ?? null,
      role: data.role,
      status: data.status ?? 'active',
    },
  });
  res.status(201).json(serializeTeamMember(created));
});

const updateSchema = z.object({
  user_name: z.string().nullable().optional(),
  role: z.enum(teamRoles).optional(),
  status: z.enum(teamStatuses).optional(),
});

router.patch('/:id', async (req, res) => {
  const user = req.user!;
  const member = await prisma.teamMember.findUnique({ where: { id: req.params.id } });
  if (!member) throw new HttpError(404, 'TeamMember not found');
  if (!isAdmin(user)) await requireCompanyRole(user, member.companyId, ['owner', 'manager']);

  const data = updateSchema.parse(req.body);
  const updated = await prisma.teamMember.update({
    where: { id: member.id },
    data: {
      userName: data.user_name ?? undefined,
      role: data.role ?? undefined,
      status: data.status ?? undefined,
    },
  });
  res.json(serializeTeamMember(updated));
});

router.delete('/:id', async (req, res) => {
  const user = req.user!;
  const member = await prisma.teamMember.findUnique({ where: { id: req.params.id } });
  if (!member) throw new HttpError(404, 'TeamMember not found');
  if (!isAdmin(user)) {
    await requireCompanyRole(user, member.companyId, ['owner', 'manager']);
    if (member.userEmail === user.email) {
      throw new HttpError(400, 'Cannot remove yourself');
    }
  }
  await prisma.teamMember.delete({ where: { id: member.id } });
  res.json({ ok: true });
});

export default router;
