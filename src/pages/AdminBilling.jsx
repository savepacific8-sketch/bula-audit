import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { PLANS, STATUS_CONFIG, PLAN_ORDER } from '@/lib/billing';
import PageHeader from '@/components/layout/PageHeader';
import PlanBadge from '@/components/billing/PlanBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect } from '@/components/ui/MobileSelect';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck, CheckCircle2, XCircle, Building2, AlertTriangle,
  RefreshCw, Eye, X, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

/* ── Modal ───────────────────────────────────────────────────── */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <h2 className="font-bold text-base">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Proof Review Modal ──────────────────────────────────────── */
function ProofReviewModal({ proof, open, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDecision = async (approve) => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.PaymentProof.update(proof.id, {
        status: approve ? 'approved' : 'rejected',
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString(),
        review_notes: notes || undefined,
      });

      if (approve && proof.subscription_id) {
        await base44.entities.Subscription.update(proof.subscription_id, {
          plan: proof.plan_requested || undefined,
          billing_cycle: proof.billing_cycle_requested || 'monthly',
          status: 'active',
        });
      }

      toast.success(approve ? 'Payment approved & subscription activated!' : 'Payment rejected.');
      onDone();
    } catch {
      toast.error('Failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!proof) return null;

  return (
    <Modal open={open} onClose={onClose} title="Review Payment Proof">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="font-medium">{proof.company_id}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Plan requested</span><span className="font-medium">{PLANS[proof.plan_requested]?.name ?? proof.plan_requested}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Billing cycle</span><span className="font-medium capitalize">{proof.billing_cycle_requested ?? 'monthly'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount paid</span><span className="font-medium">FJD ${proof.amount_paid}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{proof.payment_method?.replace('_', ' ')}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Submitted by</span><span className="font-medium">{proof.submitted_by}</span></div>
          {proof.reference_number && (
            <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-medium">{proof.reference_number}</span></div>
          )}
        </div>

        {proof.proof_url && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Payment Proof</p>
            <a href={proof.proof_url} target="_blank" rel="noreferrer">
              <img src={proof.proof_url} alt="proof" className="rounded-xl border border-border max-h-48 object-contain w-full bg-muted" />
            </a>
            <a href={proof.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 block">
              Open full size
            </a>
          </div>
        )}

        <div>
          <Label className="text-xs">Review Notes (optional)</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." className="mt-1" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
            onClick={() => handleDecision(false)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </Button>
          <Button
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleDecision(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Company Edit Modal ──────────────────────────────────────── */
function CompanySubscriptionModal({ sub, open, onClose, onDone }) {
  const [form, setForm] = useState({
    plan: sub?.plan ?? 'starter',
    status: sub?.status ?? 'active',
    start_date: sub?.start_date ?? '',
    end_date: sub?.end_date ?? '',
    next_payment_date: sub?.next_payment_date ?? '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (sub?.id) {
        await base44.entities.Subscription.update(sub.id, {
          plan: form.plan,
          status: form.status,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          next_payment_date: form.next_payment_date || undefined,
        });
        toast.success('Subscription updated');
      }
      onDone();
    } catch {
      toast.error('Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  return (
    <Modal open={open} onClose={onClose} title="Edit Subscription">
      <div className="space-y-4">
        <div>
          <Label className="text-xs">Plan</Label>
          <MobileSelect value={form.plan} onValueChange={v => update('plan', v)} placeholder="Select plan" triggerClassName="mt-1">
            {PLAN_ORDER.map(k => <option key={k} value={k}>{PLANS[k]?.name}</option>)}
          </MobileSelect>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <MobileSelect value={form.status} onValueChange={v => update('status', v)} placeholder="Select status" triggerClassName="mt-1">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </MobileSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Next Payment Date</Label>
          <Input type="date" value={form.next_payment_date} onChange={e => update('next_payment_date', e.target.value)} className="mt-1" />
        </div>
        <Button onClick={handleSave} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}

/* ── Main Admin Billing Page ─────────────────────────────────── */
export default function AdminBilling() {
  const queryClient = useQueryClient();
  const [reviewProof, setReviewProof] = useState(null);
  const [editSub, setEditSub] = useState(null);
  const [tab, setTab] = useState('proofs');
  const [appUserRole, setAppUserRole] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setAppUserRole(u?.role)).catch(() => {});
  }, []);

  const { data: proofs = [], isLoading: proofsLoading } = useQuery({
    queryKey: ['admin-proofs'],
    queryFn: () => base44.entities.PaymentProof.list('-created_date', 50),
    staleTime: 20_000,
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['admin-subs'],
    queryFn: () => base44.entities.Subscription.list('-created_date', 100),
    staleTime: 20_000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => base44.entities.Company.list(),
    staleTime: 60_000,
  });

  if (appUserRole && appUserRole !== 'admin') {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin Billing Panel" subtitle="Manage all subscriptions" />
        <div className="rounded-2xl border border-border p-12 text-center">
          <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Admin access required.</p>
        </div>
      </div>
    );
  }

  const pendingProofs = proofs.filter(p => p.status === 'pending');
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-proofs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subs'] });
  };

  const STATUS_MAP = {
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Admin Billing Panel"
        subtitle="Review payments & manage subscriptions"
        action={
          <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        }
      />

      {/* Pending badge */}
      {pendingProofs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium">
            {pendingProofs.length} payment proof{pendingProofs.length > 1 ? 's' : ''} awaiting review
          </p>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2">
        {[
          { key: 'proofs', label: `Payments (${proofs.length})` },
          { key: 'companies', label: `Subscriptions (${subscriptions.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:border-primary/30'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Payment Proofs tab ── */}
      {tab === 'proofs' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Payment Proofs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proofsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : proofs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No payment proofs yet</p>
            ) : (
              <div className="space-y-2">
                {proofs.map(p => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {companyMap[p.company_id]?.name ?? p.company_id}
                        </p>
                        <span className={`text-[10px] border rounded-md px-1.5 py-0.5 font-semibold ${STATUS_MAP[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {PLANS[p.plan_requested]?.name ?? p.plan_requested} · FJD ${p.amount_paid}
                        {p.payment_date ? ` · ${format(parseISO(p.payment_date), 'dd MMM yyyy')}` : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-8 gap-1.5 text-xs"
                      onClick={() => setReviewProof(p)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Subscriptions tab ── */}
      {tab === 'companies' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Company Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No subscriptions yet</p>
            ) : (
              <div className="space-y-2">
                {subscriptions.map(s => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {companyMap[s.company_id]?.name ?? s.company_id}
                      </p>
                      <div className="mt-1">
                        <PlanBadge planKey={s.plan} status={s.status} size="xs" />
                      </div>
                      {s.end_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ends {format(parseISO(s.end_date), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-8 text-xs"
                      onClick={() => setEditSub(s)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <ProofReviewModal
        proof={reviewProof}
        open={!!reviewProof}
        onClose={() => setReviewProof(null)}
        onDone={() => { setReviewProof(null); refresh(); }}
      />
      <CompanySubscriptionModal
        sub={editSub}
        open={!!editSub}
        onClose={() => setEditSub(null)}
        onDone={() => { setEditSub(null); refresh(); }}
      />
    </div>
  );
}