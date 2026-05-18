import { Link } from 'react-router-dom';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { CalendarClock, ArrowRight, AlertCircle } from 'lucide-react';
import { formatFJD } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';

function dueBadge(dueDateStr) {
  const d = new Date(dueDateStr);
  if (isPast(d) && !isToday(d)) {
    return { label: 'Overdue', className: 'bg-rose-100 text-rose-700 border border-rose-200' };
  }
  const days = differenceInDays(d, new Date());
  if (days === 0) return { label: 'Due today', className: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (days <= 3) return { label: `${days}d left`, className: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (days <= 7) return { label: `${days}d left`, className: 'bg-sky-100 text-sky-700 border border-sky-200' };
  return { label: `${days}d left`, className: 'bg-muted text-muted-foreground border border-border' };
}

export default function UpcomingPayments({ receipts }) {
  // unpaid receipts with a due date, sorted soonest first
  const upcoming = receipts
    .filter(r => r.payment_status === 'unpaid' && r.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 8);

  if (upcoming.length === 0) return null;

  const overdueCount = upcoming.filter(r => {
    const d = new Date(r.due_date);
    return isPast(d) && !isToday(d);
  }).length;

  return (
    <div className={`rounded-2xl overflow-hidden border ${overdueCount > 0 ? 'border-rose-200 bg-rose-50/40' : 'border-sky-200 bg-sky-50/30'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 pt-4 pb-3 border-b ${overdueCount > 0 ? 'border-rose-200' : 'border-sky-200'}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${overdueCount > 0 ? 'bg-rose-100' : 'bg-sky-100'}`}>
          {overdueCount > 0
            ? <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            : <CalendarClock className="w-3.5 h-3.5 text-sky-600" />
          }
        </div>
        <div>
          <p className={`text-[13px] font-semibold ${overdueCount > 0 ? 'text-rose-800' : 'text-sky-800'}`}>
            Upcoming Payments ({upcoming.length})
          </p>
          <p className={`text-[10px] ${overdueCount > 0 ? 'text-rose-500' : 'text-sky-500'}`}>
            {overdueCount > 0 ? `${overdueCount} overdue — action required` : 'Unpaid invoices with due dates'}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="px-4 pb-3 mt-1">
        {upcoming.map(r => {
          const badge = dueBadge(r.due_date);
          const days = differenceInDays(new Date(r.due_date), new Date());
          const isUrgent = (isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))) || days <= 3;
          return (
            <Link
              key={r.id}
              to={`/receipt-review?id=${r.id}`}
              className={cn(
                "flex items-center justify-between py-2.5 border-b border-black/5 last:border-0 px-1 rounded transition-colors",
                isUrgent ? "hover:bg-rose-100/60 bg-rose-50/50" : "hover:bg-black/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{r.supplier_name || 'Unknown Supplier'}</p>
                <p className="text-[11px] text-muted-foreground">
                  Due {format(new Date(r.due_date), 'dd MMM yyyy')}
                  {r.receipt_number ? ` · #${r.receipt_number}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-[13px] font-semibold">{r.total_amount != null ? formatFJD(r.total_amount) : '—'}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${badge.className}`}>
                  {badge.label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}