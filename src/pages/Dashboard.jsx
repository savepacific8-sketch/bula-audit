import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { Link } from 'react-router-dom';
import { DollarSign, Receipt, Clock, CheckCircle2, XCircle, TrendingUp, ShoppingBag, AlertTriangle, ArrowRight, Users } from 'lucide-react';
import SpendingTrendsChat from '@/components/dashboard/SpendingTrendsChat';
import MonthlyTaxSummary from '@/components/dashboard/MonthlyTaxSummary';
import ClearTestReceipts from '@/components/dashboard/ClearTestReceipts';
import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';

const COLORS = ['hsl(178,58%,30%)', 'hsl(20,88%,54%)', 'hsl(210,60%,45%)', 'hsl(150,48%,42%)', 'hsl(0,72%,51%)'];

const statusBadge = (status) => {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

function StatCard({ title, value, icon: Icon, accentColor, sub }) {
  return (
    <div className="rounded-2xl p-4 bg-card border border-border shadow-sm flex flex-col gap-1 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: accentColor || 'hsl(var(--primary))' }}
      />
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accentColor ? accentColor + '20' : 'hsl(var(--primary)/0.12)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor || 'hsl(var(--primary))' }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { company } = useCompany();
  const now = new Date();

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  // Month filter
  const thisMonth = receipts.filter(r => {
    if (!r.receipt_date) return false;
    const d = new Date(r.receipt_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const approved = receipts.filter(r => r.status === 'approved');
  const approvedThisMonth = thisMonth.filter(r => r.status === 'approved');

  const totalExpenses = approvedThisMonth.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalVAT = approvedThisMonth.reduce((s, r) => s + (r.vat_amount || 0), 0);
  const pendingCount = receipts.filter(r => r.status === 'pending').length;
  const approvedCount = receipts.filter(r => r.status === 'approved').length;
  const rejectedCount = receipts.filter(r => r.status === 'rejected').length;

  // Top 5 categories (all-time approved)
  const categoryTotals = {};
  approved.forEach(r => {
    if (r.category) categoryTotals[r.category] = (categoryTotals[r.category] || 0) + (r.total_amount || 0);
  });
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, total]) => ({ name: formatCategory(name), total }));

  // Top 5 suppliers (all-time approved)
  const supplierTotals = {};
  approved.forEach(r => {
    if (r.supplier_name) supplierTotals[r.supplier_name] = (supplierTotals[r.supplier_name] || 0) + (r.total_amount || 0);
  });
  const topSuppliers = Object.entries(supplierTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Recent uploads (by created_date desc)
  const recentReceipts = [...receipts]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 6);

  // Low-confidence receipts needing review
  const lowConfidence = receipts
    .filter(r => r.status === 'pending' && r.ai_confidence != null && r.ai_confidence < 70)
    .sort((a, b) => (a.ai_confidence || 0) - (b.ai_confidence || 0))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={`Bula, Business Dashboard`}
        subtitle={now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        action={<ClearTestReceipts />}
      />

      {/* Stat Cards — 2 cols on mobile, 3 on md */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard title="Expenses (Month)" value={formatFJD(totalExpenses)} icon={DollarSign} accentColor="hsl(178,58%,30%)" sub="approved only" />
        <StatCard title="VAT Input Credit" value={formatFJD(totalVAT)} icon={TrendingUp} accentColor="hsl(20,88%,54%)" sub="approved only" />
        <StatCard title="Pending Review" value={pendingCount} icon={Clock} accentColor="hsl(38,80%,50%)" sub="awaiting review" />
        <StatCard title="Approved" value={approvedCount} icon={CheckCircle2} accentColor="hsl(150,48%,42%)" sub="all time" />
        <StatCard title="Rejected" value={rejectedCount} icon={XCircle} accentColor="hsl(0,72%,51%)" sub="all time" />
      </div>

      {/* Top Categories */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" /> Top 5 Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          {topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topCategories} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatFJD(v)} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {topCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No approved receipts yet</p>
          )}
        </CardContent>
      </Card>

      {/* Top Suppliers */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Top 5 Suppliers
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {topSuppliers.length > 0 ? (
            <div className="space-y-2.5">
              {topSuppliers.map(([name, total], i) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {name[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm truncate">{name}</span>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">{formatFJD(total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" /> Recent Uploads
          </CardTitle>
          <Link to="/receipts" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recentReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No receipts yet</p>
          ) : (
            <div className="space-y-0">
              {recentReceipts.map(r => (
                <Link
                  key={r.id}
                  to={`/receipt-review?id=${r.id}`}
                  className="flex items-center justify-between py-2.5 border-b last:border-0 hover:bg-muted/40 -mx-1 px-1 rounded transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.supplier_name || 'Unknown Supplier'}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.receipt_date ? format(new Date(r.receipt_date), 'dd MMM yyyy') : 'No date'}
                      {r.category ? ` · ${formatCategory(r.category)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-sm font-semibold">{r.total_amount != null ? formatFJD(r.total_amount) : '—'}</span>
                    <Badge className={`text-[10px] px-1.5 ${statusBadge(r.status)}`}>{r.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Tax Summary */}
      <MonthlyTaxSummary receipts={receipts} />

      {/* AI Spending Analyst */}
      <SpendingTrendsChat />

      {/* Low-Confidence Receipts */}
      {lowConfidence.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" /> Needs Review ({lowConfidence.length})
            </CardTitle>
            <p className="text-xs text-amber-600 mt-0.5">AI confidence below 70% — please verify manually</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-0">
              {lowConfidence.map(r => (
                <Link
                  key={r.id}
                  to={`/receipt-review?id=${r.id}`}
                  className="flex items-center justify-between py-2.5 border-b border-amber-100 last:border-0 hover:bg-amber-100/50 -mx-1 px-1 rounded transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.supplier_name || 'Unknown Supplier'}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.receipt_date ? format(new Date(r.receipt_date), 'dd MMM yyyy') : 'No date'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-semibold text-amber-600">{r.ai_confidence}% confidence</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}