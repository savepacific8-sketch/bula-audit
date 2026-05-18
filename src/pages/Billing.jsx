import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { useSubscription } from '@/hooks/useSubscription';
import { PLANS, PLAN_ORDER, STATUS_CONFIG, formatPlanPrice, getPrice } from '@/lib/billing';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import PlanCard from '@/components/billing/PlanCard';
import UsageMeter from '@/components/billing/UsageMeter';
import PlanBadge from '@/components/billing/PlanBadge';
import PaymentInstructions from '@/components/billing/PaymentInstructions';
import UploadPaymentProof from '@/components/billing/UploadPaymentProof';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard, Calendar, Users, Receipt, ArrowUpCircle,
  AlertTriangle, X
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

/* ── Simple modal ────────────────────────────────────────────── */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <h2 className="font-bold text-foreground text-base">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Payment History Card ────────────────────────────────────── */
function PaymentHistoryCard({ companyId }) {
  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ['payment-proofs', companyId],
    queryFn: () => base44.entities.PaymentProof.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const STATUS_MAP = {
    pending:  { label: 'Pending',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  if (isLoading || proofs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Receipt className="w-4 h-4 text-primary" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {proofs.slice(0, 6).map(p => {
            const cfg = STATUS_MAP[p.status] ?? STATUS_MAP.pending;
            return (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{PLANS[p.plan_requested]?.name ?? p.plan_requested ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.payment_date ? format(parseISO(p.payment_date), 'dd MMM yyyy') : '—'} · FJD ${p.amount_paid ?? '—'}
                  </p>
                </div>
                <span className={`text-[11px] border rounded-md px-1.5 py-0.5 font-semibold shrink-0 ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function Billing() {
  const { company, userRole } = useCompany();
  const {
    subscription, plan, isLoading, monthlyUsage,
    receiptLimit, limitReached, isExpired,
  } = useSubscription();
  const queryClient = useQueryClient();

  const [cycle, setCycle] = useState('monthly');
  const [showPlans, setShowPlans] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const canManage = userRole === 'owner';
  const canView = userRole === 'owner' || userRole === 'accountant';

  if (!canView) {
    return (
      <div className="space-y-4">
        <PageHeader title="Billing" subtitle="Subscription & payments" />
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Only company owners and accountants can view billing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Billing" subtitle="Subscription & payments" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  const daysLeft = subscription?.end_date
    ? differenceInDays(parseISO(subscription.end_date), new Date())
    : null;

  const handleSelectPlan = (planKey) => {
    setSelectedPlan(planKey);
    setShowPlans(false);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', company?.id] });
    queryClient.invalidateQueries({ queryKey: ['payment-proofs', company?.id] });
    setTimeout(() => setShowPayment(false), 2500);
  };

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Billing" subtitle="Manage your subscription & payments" />

      {/* ── Suspension / Expiry Warning ── */}
      {(subscription?.status === 'suspended' || isExpired) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-800 text-sm">
              {subscription?.status === 'suspended' ? 'Account Suspended' : 'Subscription Expired'}
            </p>
            <p className="text-xs text-rose-600 mt-0.5">
              Receipt uploads and exports are paused. Your data is safe.
              {canManage && ' Please renew your subscription to reactivate.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Receipt limit reached ── */}
      {limitReached && !isExpired && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Monthly receipt limit reached</p>
            <p className="text-xs text-amber-600 mt-0.5">Upgrade your plan to upload more receipts this month.</p>
          </div>
          {canManage && (
            <Button size="sm" className="shrink-0 text-xs h-8" onClick={() => setShowPlans(true)}>Upgrade</Button>
          )}
        </div>
      )}

      {/* ── Trial ending warning ── */}
      {subscription?.status === 'trial' && daysLeft !== null && daysLeft <= 5 && daysLeft >= 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600 mt-0.5">Upgrade now to keep access to all your receipts.</p>
          </div>
          {canManage && (
            <Button size="sm" className="shrink-0 text-xs h-8" onClick={() => setShowPlans(true)}>Upgrade</Button>
          )}
        </div>
      )}

      {/* ── No subscription ── */}
      {!subscription && (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
          <p className="font-semibold text-foreground">No active subscription</p>
          <p className="text-sm text-muted-foreground">Choose a plan to get started with BULA AUDIT.</p>
          {canManage && (
            <Button onClick={() => setShowPlans(true)} className="gap-2">
              <ArrowUpCircle className="w-4 h-4" /> View Plans
            </Button>
          )}
        </div>
      )}

      {/* ── Current Plan Card ── */}
      {subscription && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4 text-primary" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <p className="font-bold text-foreground text-xl">{plan?.name ?? 'Unknown Plan'}</p>
                <PlanBadge planKey={subscription.plan} status={subscription.status} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-primary">
                  {formatPlanPrice(subscription.plan, subscription.billing_cycle ?? 'monthly')}
                </p>
                {subscription.billing_cycle === 'yearly' && (
                  <p className="text-[11px] text-emerald-600 font-medium">Yearly · 2 months free</p>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {subscription.status === 'trial' ? 'Trial Ends' : 'Next Payment'}
                  </span>
                </div>
                <p className="text-sm font-semibold">
                  {subscription.end_date
                    ? format(parseISO(subscription.end_date), 'dd MMM yyyy')
                    : subscription.next_payment_date
                    ? format(parseISO(subscription.next_payment_date), 'dd MMM yyyy')
                    : '—'}
                </p>
                {daysLeft !== null && daysLeft >= 0 && (
                  <p className="text-[11px] text-muted-foreground">{daysLeft}d remaining</p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">User Limit</span>
                </div>
                <p className="text-sm font-semibold">
                  {plan?.user_limit >= 999 ? 'Team access' : `${plan?.user_limit ?? 1} user${(plan?.user_limit ?? 1) > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Usage meter */}
            <UsageMeter used={monthlyUsage} limit={receiptLimit} />

            {/* Feature pills */}
            {plan && (
              <div className="flex flex-wrap gap-1.5">
                {plan.exports && <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-1.5 py-0.5 font-medium">CSV Export</span>}
                {plan.pdf_reports && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-1.5 py-0.5 font-medium">PDF Reports</span>}
                {plan.team_roles && <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-md px-1.5 py-0.5 font-medium">Team Roles</span>}
                {plan.accountant_access && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-1.5 py-0.5 font-medium">Accountant Access</span>}
              </div>
            )}

            {canManage && (
              <Button onClick={() => setShowPlans(true)} className="w-full gap-2 mt-2">
                <ArrowUpCircle className="w-4 h-4" />
                {subscription.status === 'trial' ? 'Upgrade to Paid Plan' : 'Change Plan'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Payment History ── */}
      {canManage && <PaymentHistoryCard companyId={company?.id} />}

      {/* ── Choose Plan Modal ── */}
      <Modal open={showPlans} onClose={() => setShowPlans(false)} title="Choose Your Plan">
        <div className="flex items-center justify-center gap-2 mb-6">
          {['monthly', 'yearly'].map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${cycle === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground'}`}
            >
              {c === 'monthly' ? 'Monthly' : (
                <>Yearly <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">-17%</span></>
              )}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLAN_ORDER.filter(k => k !== 'free_trial').map(key => (
            <PlanCard
              key={key}
              planKey={key}
              cycle={cycle}
              currentPlanKey={subscription?.plan}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>
      </Modal>

      {/* ── Payment Modal ── */}
      <Modal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title={`Pay for ${PLANS[selectedPlan]?.name ?? ''}`}
      >
        {selectedPlan && (
          <div className="space-y-6">
            <PaymentInstructions
              amount={getPrice(selectedPlan, cycle)}
              planName={PLANS[selectedPlan]?.name}
              cycle={cycle}
            />
            <div className="border-t border-border pt-5">
              <p className="text-sm font-semibold text-foreground mb-3">Upload Payment Proof</p>
              <UploadPaymentProof
                subscription={subscription}
                planRequested={selectedPlan}
                cycleRequested={cycle}
                amountDue={getPrice(selectedPlan, cycle)}
                onSuccess={handlePaymentSuccess}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}