/**
 * Set current_company_id / role from TeamMember (or owned company) for a user.
 * Run if uploads fail with "Insufficient permissions".
 *
 * Usage: npx tsx src/scripts/sync-company-context.ts user@example.com
 */
import 'dotenv/config';
import { prisma } from '../prisma.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npx tsx src/scripts/sync-company-context.ts <email>');
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error('User not found:', email);
  process.exit(1);
}

const member = await prisma.teamMember.findFirst({
  where: { userEmail: email, status: 'active' },
  orderBy: { createdAt: 'asc' },
});

if (member) {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      currentCompanyId: member.companyId,
      currentCompanyRole: member.role,
    },
  });
  console.log(`OK: set company ${member.companyId} role ${member.role} for ${email}`);
} else {
  const owned = await prisma.company.findFirst({ where: { ownerEmail: email } });
  if (!owned) {
    console.error('No team membership or owned company for', email);
    process.exit(1);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { currentCompanyId: owned.id, currentCompanyRole: 'owner' },
  });
  console.log(`OK: set owned company ${owned.id} for ${email}`);
}

await prisma.$disconnect();
