import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { Link } from 'react-router-dom';
import {
  DollarSign, Receipt, Clock, CheckCircle2, XCircle,
  TrendingUp, ShoppingBag, AlertTriangle, ArrowRight, Users, Waves
} from 'lucide-react';
import SpendingTrendsChat from '@/components/dashboard/SpendingTrendsChat';
import MonthlyTaxSummary from '@/components/dashboard/MonthlyTaxSummary';
import ClearTestReceipts from '@/components/dashboard/ClearTestReceipts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';

const COLORS = [
  'hsl(178,58%,30%)',
  'hsl(20,88%,54%)',
  'hsl(210,60%,45%)',
  'hsl(150,48%,42%)',
  'hsl(0,72%,51%)',
];

const statusBadge = (status) => {
  if (status === 'approved') return 'ds-badge-approved';
  if (status === 'rejected') return 'ds-badge-rejected';
  return 'ds-badge-pending';
};

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ title, value, icon: Icon, accentColor, sub }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm flex flex-col p-4 gap-1">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: accentColor }} />
      <div className="flex items-start justify-between mt-1 mb-2">
        <span className="ds-label leading-tight">{title}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: accentColor + '22' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-[1.6rem] font-bold text-foreground leading-none tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Section Card ──────────────────────────────────────────────── */
function SectionCard({ icon: Icon, title, action, children }) {
  return (
    <div className="ds-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ── Hero Header ───────────────────────────────────────────────── */
function DashboardHero({ company, month, action }) {
  return (
    <div
      className="rounded-2xl px-5 pt-5 pb-5 relative overflow-hidden masi-pattern"
      style={{ background: 'linear-gradient(135deg, hsl(210,60%,16%) 0%, hsl(178,50%,22%) 100%)' }}
    >
      {/* Coral left stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: 'hsl(var(--accent))' }} />
      {/* Wave at bottom */}
      <div className="wave-pattern absolute bottom-0 left-0 right-0 h-10 pointer-events-none" />

      <div className="flex items-start justify-between gap-3 ml-3 relative z-10">
        <div>
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-1">Dashboard · {month}</p>
          <h1 className="text-white font-poppins font-bold text-2xl leading-tight">Bula, welcome back 🌊</h1>
          {company && (
            <p className="text-white/60 text-xs mt-1 font-medium">{company.name}</p>
          )}
        </div>
        {action && <div className="shrink-0 mt-1">{action}</div>}
      </div>

      {/* Decorative dots */}
      <div className="absolute right-5 bottom-4 flex gap-1 opacity-20">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-white" />
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
export default function Dashboard() {
  const { company } = useCompany();
  const now = new Date();

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const thisMonth = receipts.filter(r => {
    if (!r.receipt_date) return false;
    const d = new Date(r.receipt_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const approved = receipts.filter(r => r.status === 'approved');
  const approvedThisMonth = thisMonth.filter(r => r.status === 'approved');

  const totalExpenses = approvedThisMonth.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalVAT      = approvedThisMonth.reduce((s, r) => s + (r.vat_amount || 0), 0);
  const pendingCount  = receipts.filter(r => r.status === 'pending').length;
  const approvedCount = receipts.filter(r => r.status === 'approved').length;
  const rejectedCount = receipts.filter(r => r.status === 'rejected').length;

  // Top 5 categories
  const categoryTotals = {};
  approved.forEach(r => {
    if (r.category) categoryTotals[r.category] = (categoryTotals[r.category] || 0) + (r.total_amount || 0);
  });
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, total]) => ({ name: formatCategory(name), total }));

  // Top 5 suppliers
  const supplierTotals = {};
  approved.forEach(r => {
    if (r.supplier_name) supplierTotals[r.supplier_name] = (supplierTotals[r.supplier_name] || 0) + (r.total_amount || 0);
  });
  const topSuppliers = Object.entries(supplierTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const recentReceipts = [...receipts]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 6);

  const lowConfidence = receipts
    .filter(r => r.status === 'pending' && r.ai_confidence != null && r.ai_confidence < 70)
    .sort((a, b) => (a.ai_confidence || 0) - (b.ai_confidence || 0))
    .slice(0, 5);

  const month = now.toLocaleString('en-FJ', { month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">

      {/* Hero */}
      <DashboardHero company={company} month={month} action={<ClearTestReceipts />} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard title="Expenses (Month)"  value={formatFJD(totalExpenses)}  icon={DollarSign}    accentColor="hsl(178,58%,30%)"  sub="approved only" />
        <StatCard title="VAT Input Credit"  value={formatFJD(totalVAT)}       icon={TrendingUp}    accentColor="hsl(20,88%,54%)"   sub="approved only" />
        <StatCard title="Pending Review"    value={pendingCount}               icon={Clock}         accentColor="hsl(38,80%,50%)"   sub="awaiting review" />
        <StatCard title="Approved"          value={approvedCount}              icon={CheckCircle2}  accentColor="hsl(150,48%,42%)"  sub="all time" />
        <StatCard title="Rejected"          value={rejectedCount}              icon={XCircle}       accentColor="hsl(0,72%,51%)"    sub="all time" />
      </div>

      {/* Top Categories */}
      <SectionCard icon={ShoppingBag} title="Top 5 Categories">
        {topCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={topCategories} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 11, fill: 'hsl(210,12%,48%)' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [formatFJD(v), 'Total']}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {topCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-10 text-center">
            <Waves className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No approved receipts yet</p>
          </div>
        )}
      </SectionCard>

      {/* Top Suppliers */}
      <SectionCard icon={Users} title="Top 5 Suppliers">
        {topSuppliers.length > 0 ? (
          <div className="space-y-3">
            {topSuppliers.map(([name, total], i) => {
              const maxTotal = topSuppliers[0][1];
              const pct = Math.round((total / maxTotal) * 100);
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      >
                        {name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-foreground truncate">{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap ml-2">{formatFJD(total)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No data yet</p>
          </div>
        )}
      </SectionCard>

      {/* Recent Uploads */}
      <SectionCard
        icon={Receipt}
        title="Recent Uploads"
        action={
          <Link to="/receipts" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        }
      >
        {recentReceipts.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <Waves className="w-8 h-8 text-muted-foreground/25 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No receipts yet</p>
            <p className="text-xs text-muted-foreground">Upload your first receipt to start tracking expenses.</p>
          </div>
        ) : (
          <div className="space-y-0 -mx-1">
            {recentReceipts.map(r => (
              <Link
                key={r.id}
                to={`/receipt-review?id=${r.id}`}
                className="flex items-center justify-between py-2.5 border-b last:border-0 hover:bg-muted/40 px-1 rounded transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{r.supplier_name || 'Unknown Supplier'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.receipt_date ? format(new Date(r.receipt_date), 'dd MMM yyyy') : 'No date'}
                    {r.category ? ` · ${formatCategory(r.category)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="text-[13px] font-semibold">{r.total_amount != null ? formatFJD(r.total_amount) : '—'}</span>
                  <Badge className={`text-[10px] px-1.5 py-0.5 border ${statusBadge(r.status)}`}>{r.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Monthly Tax Summary */}
      <MonthlyTaxSummary receipts={receipts} />

      {/* AI Spending Analyst */}
      <SpendingTrendsChat />

      {/* Low-Confidence Receipts */}
      {lowConfidence.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-amber-200">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-amber-800">Needs Review ({lowConfidence.length})</p>
              <p className="text-[10px] text-amber-600">AI confidence below 70% — verify manually</p>
            </div>
          </div>
          <div className="px-4 pb-3 -mx-1 mt-1">
            {lowConfidence.map(r => (
              <Link
                key={r.id}
                to={`/receipt-review?id=${r.id}`}
                className="flex items-center justify-between py-2.5 border-b border-amber-100 last:border-0 hover:bg-amber-100/60 px-1 rounded transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate text-amber-900">{r.supplier_name || 'Unknown Supplier'}</p>
                  <p className="text-[11px] text-amber-600">
                    {r.receipt_date ? format(new Date(r.receipt_date), 'dd MMM yyyy') : 'No date'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-amber-700">{r.ai_confidence}%</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}