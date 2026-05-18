import { Link } from 'react-router-dom';
import { differenceInDays, isPast, isToday, format } from 'date-fns';
import { Bell, X, ArrowRight } from 'lucide-react';
import { formatFJD } from '@/lib/formatCurrency';
import { useState } from 'react';

export default function DueSoonAlert({ receipts }) {
  const [dismissed, setDismissed] = useState(false);

  const urgent = receipts.filter(r => {
    if (r.payment_status === 'paid' || !r.due_date) return false;
    const d = new Date(r.due_date);
    const days = differenceInDays(d, new Date());
    return (isPast(d) && !isToday(d)) || days <= 3;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  if (urgent.length === 0 || dismissed) return null;

  const overdueCount = urgent.filter(r => {
    const d = new Date(r.due_date);
    return isPast(d) && !isToday(d);
  }).length;
  const dueTodayCount = urgent.filter(r => isToday(new Date(r.due_date))).length;

  let headline = '';
  if (overdueCount > 0 && urgent.length > overdueCount) {
    headline = `${overdueCount} overdue + ${urgent.length - overdueCount} due within 3 days`;
  } else if (overdueCount > 0) {
    headline = `${overdueCount} payment${overdueCount > 1 ? 's' : ''} overdue`;
  } else if (dueTodayCount > 0) {
    headline = `${dueTodayCount} payment${dueTodayCount > 1 ? 's' : ''} due today`;
  } else {
    headline = `${urgent.length} payment${urgent.length > 1 ? 's' : ''} due within 3 days`;
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-rose-300 bg-gradient-to-br from-rose-50 to-amber-50 shadow-sm">
      {/* Pulsing left stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500 animate-pulse rounded-l-2xl" />

      <div className="pl-5 pr-4 pt-3.5 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0 ring-2 ring-rose-200">
              <Bell className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-rose-800">Payment Alert</p>
              <p className="text-[11px] text-rose-500">{headline}</p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-rose-400 hover:text-rose-600 mt-0.5 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Urgent items */}
        <div className="space-y-1.5">
          {urgent.slice(0, 4).map(r => {
            const d = new Date(r.due_date);
            const isOverdue = isPast(d) && !isToday(d);
            const days = differenceInDays(d, new Date());
            const label = isOverdue
              ? `Overdue since ${format(d, 'dd MMM')}`
              : days === 0
                ? 'Due today'
                : `Due in ${days}d — ${format(d, 'dd MMM')}`;

            return (
              <Link
                key={r.id}
                to={`/receipt-review?id=${r.id}`}
                className="flex items-center justify-between bg-white/70 hover:bg-white rounded-xl px-3 py-2 transition-colors border border-rose-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate text-rose-900">
                    {r.supplier_name || 'Unknown Supplier'}
                  </p>
                  <p className={`text-[11px] font-medium ${isOverdue ? 'text-rose-600' : days === 0 ? 'text-amber-600' : 'text-amber-500'}`}>
                    {label}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  {r.total_amount != null && (
                    <span className="text-[12px] font-bold text-rose-800">{formatFJD(r.total_amount)}</span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                </div>
              </Link>
            );
          })}
          {urgent.length > 4 && (
            <p className="text-[11px] text-rose-500 text-center pt-1">
              +{urgent.length - 4} more — check Upcoming Payments below
            </p>
          )}
        </div>
      </div>
    </div>
  );
}