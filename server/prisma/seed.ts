import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@bula.local';
  const adminPassword = 'admin1234';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Bula Admin',
      role: 'admin',
    },
  });

  const company = await prisma.company.upsert({
    where: { id: 'demo-company' },
    update: {},
    create: {
      id: 'demo-company',
      name: 'Demo Fiji Co.',
      ownerEmail: admin.email,
      businessType: 'limited_company',
      vatRegistered: true,
      vatRate: 12.5,
    },
  });

  await prisma.teamMember.upsert({
    where: { companyId_userEmail: { companyId: company.id, userEmail: admin.email } },
    update: {},
    create: {
      companyId: company.id,
      userEmail: admin.email,
      userName: admin.fullName ?? admin.email,
      role: 'owner',
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      currentCompanyId: company.id,
      currentCompanyRole: 'owner',
    },
  });

  console.log('Seeded admin user:');
  console.log(`  email:    ${adminEmail}`);
  console.log(`  password: ${adminPassword}`);
  console.log(`  company:  ${company.name} (${company.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
