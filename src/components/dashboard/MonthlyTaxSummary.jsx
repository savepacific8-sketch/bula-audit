import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { FileText, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_BUDGETS = {
  office_supplies: 500,
  utilities: 800,
  rent: 3000,
  transport: 600,
  food_beverage: 400,
  equipment: 2000,
  repairs_maintenance: 700,
  professional_services: 1500,
  marketing: 1000,
  insurance: 500,
  inventory: 3000,
  wages: 5000,
  telecommunications: 300,
  travel: 800,
  other: 500,
};

function VarianceIcon({ variance }) {
  if (variance === 0) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  if (variance > 0) return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
}

export default function MonthlyTaxSummary({ receipts }) {
  const now = new Date();
  const monthLabel = format(now, 'MMMM yyyy');

  const monthReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (!r.receipt_date) return false;
      const d = new Date(r.receipt_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [receipts]);

  const approvedMonth = useMemo(() => monthReceipts.filter(r => r.status === 'approved'), [monthReceipts]);

  // Aggregate by category
  const byCategory = useMemo(() => {
    const map = {};
    approvedMonth.forEach(r => {
      const cat = r.category || 'other';
      if (!map[cat]) map[cat] = { total: 0, vat: 0, count: 0 };
      map[cat].total += r.total_amount || 0;
      map[cat].vat += r.vat_amount || 0;
      map[cat].count += 1;
    });
    return map;
  }, [approvedMonth]);

  const totalExpenses = approvedMonth.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalVAT = approvedMonth.reduce((s, r) => s + (r.vat_amount || 0), 0);
  const totalExVAT = totalExpenses - totalVAT;
  const vatRate = totalExpenses > 0 ? (totalVAT / totalExpenses) * 100 : 0;

  // Build rows sorted by total desc
  const categoryRows = Object.entries(byCategory)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([cat, data]) => {
      const budget = CATEGORY_BUDGETS[cat] || 500;
      const variance = data.total - budget;
      const pct = budget > 0 ? (data.total / budget) * 100 : 0;
      return { cat, ...data, budget, variance, pct };
    });

  const totalBudget = categoryRows.reduce((s, r) => s + r.budget, 0);
  const totalVariance = totalExpenses - totalBudget;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Monthly Tax Summary — {monthLabel}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Approved receipts only · Fiji VAT reporting</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">

        {/* Top-line metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-primary/8 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Spend</p>
            <p className="text-base font-bold text-foreground">{formatFJD(totalExpenses)}</p>
          </div>
          <div className="rounded-lg bg-accent/15 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">VAT Paid</p>
            <p className="text-base font-bold text-foreground">{formatFJD(totalVAT)}</p>
            <p className="text-[10px] text-muted-foreground">{vatRate.toFixed(1)}% effective</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${totalVariance > 0 ? 'bg-red-50' : totalVariance < 0 ? 'bg-emerald-50' : 'bg-secondary'}`}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">vs Budget</p>
            <p className={`text-base font-bold ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-emerald-600' : 'text-foreground'}`}>
              {totalVariance > 0 ? '+' : ''}{formatFJD(totalVariance)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalVariance > 0 ? 'over budget' : totalVariance < 0 ? 'under budget' : 'on budget'}
            </p>
          </div>
        </div>

        {/* VAT breakdown line */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Ex-VAT spend</span>
          <span className="font-semibold">{formatFJD(totalExVAT)}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">VAT Input Credit</span>
          <span className="font-semibold text-primary">{formatFJD(totalVAT)}</span>
        </div>

        {/* Category breakdown table */}
        {categoryRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No approved receipts this month</p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-12 gap-1 pb-1 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="col-span-4">Category</div>
              <div className="col-span-2 text-right">Spend</div>
              <div className="col-span-2 text-right">VAT</div>
              <div className="col-span-2 text-right">Budget</div>
              <div className="col-span-2 text-right">Variance</div>
            </div>
            {categoryRows.map(({ cat, total, vat, budget, variance, pct }) => (
              <div key={cat} className="grid grid-cols-12 gap-1 py-2 border-b last:border-0 items-center hover:bg-muted/30 -mx-1 px-1 rounded">
                <div className="col-span-4 flex items-center gap-1.5">
                  {pct > 110 && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                  <span className="text-xs font-medium truncate">{formatCategory(cat)}</span>
                </div>
                <div className="col-span-2 text-right text-xs font-semibold">{formatFJD(total)}</div>
                <div className="col-span-2 text-right text-xs text-muted-foreground">{vat > 0 ? formatFJD(vat) : '—'}</div>
                <div className="col-span-2 text-right text-xs text-muted-foreground">{formatFJD(budget)}</div>
                <div className={`col-span-2 text-right text-xs font-semibold flex items-center justify-end gap-0.5 ${variance > 0 ? 'text-red-500' : variance < 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  <VarianceIcon variance={variance} />
                  {variance !== 0 ? (variance > 0 ? '+' : '') + formatFJD(variance) : '—'}
                </div>
              </div>
            ))}
            {/* Totals row */}
            <div className="grid grid-cols-12 gap-1 py-2 items-center bg-muted/50 -mx-1 px-1 rounded mt-1">
              <div className="col-span-4 text-xs font-bold">Total</div>
              <div className="col-span-2 text-right text-xs font-bold">{formatFJD(totalExpenses)}</div>
              <div className="col-span-2 text-right text-xs font-bold text-primary">{formatFJD(totalVAT)}</div>
              <div className="col-span-2 text-right text-xs font-bold">{formatFJD(totalBudget)}</div>
              <div className={`col-span-2 text-right text-xs font-bold flex items-center justify-end gap-0.5 ${totalVariance > 0 ? 'text-red-500' : totalVariance < 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                <VarianceIcon variance={totalVariance} />
                {totalVariance !== 0 ? (totalVariance > 0 ? '+' : '') + formatFJD(totalVariance) : '—'}
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Budget figures are default estimates. Adjust per category in your settings.
        </p>
      </CardContent>
    </Card>
  );
}