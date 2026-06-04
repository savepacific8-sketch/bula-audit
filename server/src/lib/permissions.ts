import type { User } from '@prisma/client';
import { prisma } from '../prisma.js';
import { HttpError } from '../middleware/error.js';

export type CompanyRole = 'owner' | 'manager' | 'staff' | 'accountant';

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

/** True if user may act in this company with one of the allowed roles. */
export async function userHasCompanyRole(
  user: User,
  companyId: string,
  allowed: CompanyRole[],
): Promise<boolean> {
  if (isAdmin(user)) return true;

  if (
    user.currentCompanyId === companyId &&
    user.currentCompanyRole &&
    allowed.includes(user.currentCompanyRole as CompanyRole)
  ) {
    return true;
  }

  const member = await getMembership(user.email, companyId);
  if (member?.status === 'active' && allowed.includes(member.role as CompanyRole)) {
    return true;
  }

  if (allowed.includes('owner')) {
    const owned = await prisma.company.findFirst({
      where: { id: companyId, ownerEmail: user.email },
      select: { id: true },
    });
    if (owned) return true;
  }

  return false;
}

/** @deprecated use userHasCompanyRole — sync check only when JWT company context is set */
export function hasRole(user: User, companyId: string, allowed: CompanyRole[]): boolean {
  if (isAdmin(user)) return true;
  if (user.currentCompanyId !== companyId) return false;
  return allowed.includes(user.currentCompanyRole as CompanyRole);
}

/** Throw 403 unless user is admin OR has one of `allowed` roles in the company. */
export async function requireCompanyRole(
  user: User,
  companyId: string,
  allowed: CompanyRole[],
): Promise<void> {
  if (!(await userHasCompanyRole(user, companyId, allowed))) {
    throw new HttpError(403, 'Insufficient permissions');
  }
}

/** Look up the active TeamMember row for a user in a company. */
export async function getMembership(userEmail: string, companyId: string) {
  return prisma.teamMember.findUnique({
    where: { companyId_userEmail: { companyId, userEmail } },
  });
}
