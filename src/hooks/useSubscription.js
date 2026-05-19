import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { PLANS, FREE_PLANS, canUploadReceipts, canExportReports } from '@/lib/billing';
import { isAfter, parseISO, startOfMonth, endOfMonth } from 'date-fns';

export function useSubscription() {
  const { company } = useCompany();

  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const subs = await base44.entities.Subscription.filter({ company_id: company.id });
      if (!subs.length) return null;
      return subs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    },
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  const isFreePlan = subscription ? FREE_PLANS.includes(subscription.plan) : true;

  // For free plans: count ALL receipts ever (cumulative limit of 500).
  // For paid plans: count receipts this billing month.
  const { data: totalUsage = 0 } = useQuery({
    queryKey: ['receipt-usage', company?.id, isFreePlan ? 'all' : 'monthly'],
    queryFn: async () => {
      if (!company?.id) return 0;
      const receipts = await base44.entities.Receipt.filter({ company_id: company.id });
      if (isFreePlan) {
        // Count every receipt ever uploaded (not rejected) — cumulative
        return receipts.filter(r => r.status !== 'rejected').length;
      } else {
        // Paid plan: count this billing month only
        const start = startOfMonth(new Date());
        const end = endOfMonth(new Date());
        return receipts.filter(r => {
          if (r.status === 'rejected') return false;
          const d = r.created_date ? new Date(r.created_date) : null;
          return d && d >= start && d <= end;
        }).length;
      }
    },
    enabled: !!company?.id,
    staleTime: 0,
  });

  const plan = subscription ? PLANS[subscription.plan] : PLANS['free'];
  const receiptLimit = plan?.receipt_limit ?? 500;
  const usagePct = receiptLimit > 0 ? Math.min(100, Math.round((totalUsage / receiptLimit) * 100)) : 0;
  const limitReached = totalUsage >= receiptLimit;

  // Free plan never "expires"
  const isExpired = isFreePlan ? false : (
    subscription?.end_date ? isAfter(new Date(), parseISO(subscription.end_date)) : false
  );

  const isSuspended = subscription?.status === 'suspended';
  // If no subscription at all, treat as free plan — allow uploads until limit
  const uploadAllowed = !isExpired && !isSuspended && (isFreePlan || canUploadReceipts(subscription)) && !limitReached;
  const exportAllowed = isFreePlan ? true : (!isExpired && canExportReports(subscription));

  return {
    subscription,
    plan,
    isLoading,
    refetch,
    totalUsage,
    receiptLimit,
    usagePct,
    limitReached,
    isExpired,
    isFreePlan,
    uploadAllowed,
    exportAllowed,
    receiptsRemaining: Math.max(0, receiptLimit - totalUsage),
  };
}