import { prisma } from '../prisma.js';

/** Compact receipt summary for the spending_trends agent. */
export async function buildSpendingContext(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const companyId = user?.currentCompanyId;
  if (!companyId) {
    return 'The user has no company selected. Ask them to complete onboarding or pick a company.';
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const receipts = await prisma.receipt.findMany({
    where: { companyId, status: { not: 'rejected' } },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      supplierName: true,
      category: true,
      totalAmount: true,
      vatAmount: true,
      receiptDate: true,
      status: true,
      currency: true,
    },
  });

  if (!receipts.length) {
    return `Company: ${company?.name ?? companyId}. No receipts uploaded yet.`;
  }

  const byCategory: Record<string, number> = {};
  const bySupplier: Record<string, number> = {};
  let totalSpend = 0;
  let totalVat = 0;

  for (const r of receipts) {
    const amt = r.totalAmount ?? 0;
    totalSpend += amt;
    totalVat += r.vatAmount ?? 0;
    const cat = r.category || 'uncategorized';
    byCategory[cat] = (byCategory[cat] ?? 0) + amt;
    const sup = r.supplierName || 'Unknown';
    bySupplier[sup] = (bySupplier[sup] ?? 0) + amt;
  }

  const topCats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${k}: FJD ${v.toFixed(2)}`)
    .join('; ');
  const topSup = Object.entries(bySupplier)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k}: FJD ${v.toFixed(2)}`)
    .join('; ');

  return [
    `Company: ${company?.name ?? companyId}`,
    `Receipts (non-rejected): ${receipts.length}`,
    `Total spend (sum of totals): FJD ${totalSpend.toFixed(2)}`,
    `Total VAT on receipts: FJD ${totalVat.toFixed(2)}`,
    `Top categories: ${topCats}`,
    `Top suppliers: ${topSup}`,
    'Use only this data for amounts unless the user asks about a specific receipt.',
  ].join('\n');
}
