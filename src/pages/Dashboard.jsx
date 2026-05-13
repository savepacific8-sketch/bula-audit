import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { formatFJD } from '@/lib/formatCurrency';
import StatCard from '@/components/dashboard/StatCard';
import { Link } from 'react-router-dom';
import { DollarSign, Receipt, Clock, CheckCircle2, TrendingUp, ShoppingBag, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatCategory } from '@/lib/formatCurrency';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['hsl(174,62%,32%)', 'hsl(36,80%,56%)', 'hsl(210,60%,50%)', 'hsl(150,50%,45%)', 'hsl(0,72%,51%)'];

export default function Dashboard() {
  const { company } = useCompany();

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const now = new Date();
  const thisMonth = receipts.filter(r => {
    if (!r.receipt_date) return false;
    const d = new Date(r.receipt_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const approvedThisMonth = thisMonth.filter(r => r.status === 'approved');
  const totalExpenses = approvedThisMonth.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalVAT = approvedThisMonth.reduce((s, r) => s + (r.vat_amount || 0), 0);
  const pendingCount = receipts.filter(r => r.status === 'pending').length;
  const approvedCount = receipts.filter(r => r.status === 'approved').length;

  // Category breakdown
  const categoryTotals = {};
  approvedThisMonth.forEach(r => {
    if (r.category) {
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + (r.total_amount || 0);
    }
  });
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, total]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      total
    }));

  // Top suppliers
  const supplierTotals = {};
  approvedThisMonth.forEach(r => {
    if (r.supplier_name) {
      supplierTotals[r.supplier_name] = (supplierTotals[r.supplier_name] || 0) + (r.total_amount || 0);
    }
  });
  const topSuppliers = Object.entries(supplierTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })} overview
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Monthly Expenses" value={formatFJD(totalExpenses)} icon={DollarSign} color="bg-primary/10" />
        <StatCard title="VAT Total" value={formatFJD(totalVAT)} icon={TrendingUp} color="bg-accent/20" />
        <StatCard title="Pending" value={pendingCount} icon={Clock} color="bg-amber-50" />
        <StatCard title="Approved" value={approvedCount} icon={CheckCircle2} color="bg-emerald-50" />
      </div>

      {/* Recent Receipts */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Recent Receipts
          </CardTitle>
          <Link to="/receipts" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No receipts yet</p>
          ) : (
            <div className="space-y-2">
              {receipts.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.supplier_name || 'Unknown Supplier'}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.receipt_date ? format(new Date(r.receipt_date), 'dd MMM yyyy') : 'No date'}
                      {r.category ? ` · ${formatCategory(r.category)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-semibold whitespace-nowrap">{formatFJD(r.total_amount)}</span>
                    <Badge className={`text-[10px] px-1.5 ${
                      r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              Top Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topCategories} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatFJD(v)} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {topCategories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No approved receipts this month</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Top Suppliers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSuppliers.length > 0 ? (
              <div className="space-y-3">
                {topSuppliers.map(([name, total], i) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                        {name[0]}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[140px]">{name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatFJD(total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}