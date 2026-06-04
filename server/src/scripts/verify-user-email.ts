/**
 * Mark a user's email as verified (local admin shortcut).
 *
 * Usage:
 *   npx tsx src/scripts/verify-user-email.ts user@example.com
 */
import 'dotenv/config';
import { prisma } from '../prisma.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npx tsx src/scripts/verify-user-email.ts <email>');
  process.exit(1);
}

const user = await prisma.user.update({
  where: { email },
  data: {
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  },
});

console.log(`OK: ${user.email} is now email-verified.`);
await prisma.$disconnect();
