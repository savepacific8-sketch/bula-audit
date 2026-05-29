import type { User } from '@prisma/client';
import { prisma } from '../prisma.js';
import { HttpError } from '../middleware/error.js';

export type CompanyRole = 'owner' | 'manager' | 'staff' | 'accountant';

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

export function hasRole(user: User, companyId: string, allowed: CompanyRole[]): boolean {
  if (isAdmin(user)) return true;
  if (user.currentCompanyId !== companyId) return false;
  return allowed.includes(user.currentCompanyRole as CompanyRole);
}

/** Throw 403 unless user is admin OR has one of `allowed` roles in the company. */
export function requireCompanyRole(
  user: User,
  companyId: string,
  allowed: CompanyRole[],
): void {
  if (!hasRole(user, companyId, allowed)) {
    throw new HttpError(403, 'Insufficient permissions');
  }
}

/** Look up the active TeamMember row for a user in a company. */
export async function getMembership(userEmail: string, companyId: string) {
  return prisma.teamMember.findUnique({
    where: { companyId_userEmail: { companyId, userEmail } },
  });
}
