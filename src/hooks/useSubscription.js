import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { PLANS, canUploadReceipts, canExportReports } from '@/lib/billing';
import { startOfMonth, endOfMonth, isAfter, isBefore, parseISO } from 'date-fns';

export function useSubscription() {
  const { company } = useCompany();

  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const subs = await base44.entities.Subscription.filter({ company_id: company.id });
      // Return most recent
      if (!subs.length) return null;
      return subs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    },
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  // Receipt usage this billing month
  const { data: monthlyUsage = 0 } = useQuery({
    queryKey: ['receipt-usage', company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      const receipts = await base44.entities.Receipt.filter({ company_id: company.id });
      return receipts.filter(r => {
        if (r.status === 'rejected') return false;
        const d = r.created_date ? new Date(r.created_date) : null;
        return d && d >= start && d <= end;
      }).length;
    },
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  const plan = subscription ? PLANS[subscription.plan] : null;
  const receiptLimit = plan?.receipt_limit ?? 20;
  const usagePct = receiptLimit > 0 ? Math.min(100, Math.round((monthlyUsage / receiptLimit) * 100)) : 0;
  const limitReached = monthlyUsage >= receiptLimit;

  const isExpired = subscription?.end_date
    ? isAfter(new Date(), parseISO(subscription.end_date))
    : false;

  const uploadAllowed = !isExpired && canUploadReceipts(subscription) && !limitReached;
  const exportAllowed = !isExpired && canExportReports(subscription);

  return {
    subscription,
    plan,
    isLoading,
    refetch,
    monthlyUsage,
    receiptLimit,
    usagePct,
    limitReached,
    isExpired,
    uploadAllowed,
    exportAllowed,
  };
}