import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, SlidersHorizontal, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * period shape:
 * { type: 'this_month' | 'last_month' | 'select_month' | 'custom', start: Date, end: Date, label: string }
 */

export function buildPeriod(type, customMonth = null, customRange = null) {
  const now = new Date();
  if (type === 'this_month') {
    return { type, start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMM yyyy') };
  }
  if (type === 'last_month') {
    const lm = subMonths(now, 1);
    return { type, start: startOfMonth(lm), end: endOfMonth(lm), label: format(lm, 'MMM yyyy') };
  }
  if (type === 'select_month' && customMonth) {
    return {
      type,
      start: startOfMonth(customMonth),
      end: endOfMonth(customMonth),
      label: format(customMonth, 'MMM yyyy'),
    };
  }
  if (type === 'custom' && customRange?.start && customRange?.end) {
    return {
      type,
      start: customRange.start,
      end: customRange.end,
      label: `${format(customRange.start, 'd MMM')} – ${format(customRange.end, 'd MMM yyyy')}`,
    };
  }
  return { type: 'this_month', start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMM yyyy') };
}

export default function DashboardPeriodFilter({ period, onChange }) {
  const [openPanel, setOpenPanel] = useState(null); // 'month' | 'custom' | null
  const [pickerMonth, setPickerMonth] = useState(
    period.type === 'select_month' ? period.start : new Date()
  );
  const [customStart, setCustomStart] = useState(
    period.type === 'custom' ? format(period.start, 'yyyy-MM-dd') : ''
  );
  const [customEnd, setCustomEnd] = useState(
    period.type === 'custom' ? format(period.end, 'yyyy-MM-dd') : ''
  );

  const togglePanel = (panel) => setOpenPanel(p => p === panel ? null : panel);

  const handleQuick = (type) => {
    setOpenPanel(null);
    onChange(buildPeriod(type));
  };

  const applyMonth = () => {
    onChange(buildPeriod('select_month', pickerMonth));
    setOpenPanel(null);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    onChange(buildPeriod('custom', null, { start: new Date(customStart), end: new Date(customEnd) }));
    setOpenPanel(null);
  };

  const prevMonth = () => setPickerMonth(m => subMonths(m, 1));
  const nextMonth = () => {
    const next = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1);
    if (next <= new Date()) setPickerMonth(next);
  };
  const canGoNext = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1) <= new Date();

  const isMonthActive = period.type === 'select_month' || period.type === 'custom';

  return (
    <div className="space-y-2.5">

      {/* ── Control row ── */}
      <div className="flex items-center gap-2">

        {/* Segmented control: This Month / Last Month */}
        <div
          className="flex items-center rounded-xl overflow-hidden border border-border bg-card shadow-sm"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          {[
            { type: 'this_month', label: 'This Month' },
            { type: 'last_month', label: 'Last Month' },
          ].map(({ type, label }, idx) => {
            const active = period.type === type;
            return (
              <button
                key={type}
                onClick={() => handleQuick(type)}
                className={`
                  relative px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-200 cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10
                  ${idx === 0 ? '' : 'border-l border-border'}
                  ${active
                    ? 'text-primary-foreground z-10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }
                `}
                style={active ? {
                  background: 'linear-gradient(135deg, hsl(178,58%,28%) 0%, hsl(178,52%,36%) 100%)',
                } : {}}
              >
                {active && (
                  <span className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ background: 'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,.08) 4px,rgba(255,255,255,.08) 5px)' }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Month picker icon button */}
        <button
          onClick={() => togglePanel('month')}
          title="Select specific month"
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12.5px] font-semibold
            transition-all duration-200 cursor-pointer shadow-sm
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${period.type === 'select_month'
              ? 'text-primary-foreground border-primary/60'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }
          `}
          style={period.type === 'select_month' ? {
            background: 'linear-gradient(135deg, hsl(178,58%,28%) 0%, hsl(178,52%,36%) 100%)',
          } : {}}
        >
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xs:inline sm:inline">
            {period.type === 'select_month' ? period.label : 'Month'}
          </span>
          {period.type === 'select_month' && <Check className="w-3 h-3 shrink-0" />}
        </button>

        {/* Custom range icon button */}
        <button
          onClick={() => togglePanel('custom')}
          title="Custom date range"
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12.5px] font-semibold
            transition-all duration-200 cursor-pointer shadow-sm
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${period.type === 'custom'
              ? 'text-primary-foreground border-primary/60'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }
          `}
          style={period.type === 'custom' ? {
            background: 'linear-gradient(135deg, hsl(178,58%,28%) 0%, hsl(178,52%,36%) 100%)',
          } : {}}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {period.type === 'custom' ? period.label : 'Custom'}
          </span>
          {period.type === 'custom' && <Check className="w-3 h-3 shrink-0" />}
        </button>

      </div>

      {/* ── Active period pill (when not a quick preset) ── */}
      {isMonthActive && (
        <div className="flex items-center gap-1.5">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: 'hsl(178,58%,30%,0.1)',
              color: 'hsl(178,58%,28%)',
              border: '1px solid hsl(178,58%,30%,0.25)',
            }}
          >
            <CalendarDays className="w-3 h-3" />
            {period.label}
          </div>
        </div>
      )}

      {/* ── Month picker panel ── */}
      <AnimatePresence>
        {openPanel === 'month' && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-card border border-border rounded-2xl overflow-hidden w-full max-w-[300px]"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {/* Header */}
            <div
              className="px-4 pt-3 pb-2.5 border-b border-border/60"
              style={{ background: 'linear-gradient(135deg, hsl(210,60%,16%) 0%, hsl(178,50%,20%) 100%)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Select Month</p>
              <p className="text-white font-semibold text-sm">{format(pickerMonth, 'MMMM yyyy')}</p>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={prevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>

              <span className="text-[14px] font-bold text-foreground">
                {format(pickerMonth, 'MMMM yyyy')}
              </span>

              <button
                onClick={nextMonth}
                disabled={!canGoNext}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors cursor-pointer
                  ${canGoNext ? 'hover:bg-muted text-foreground' : 'text-muted-foreground/30 cursor-not-allowed'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => setOpenPanel(null)}
                className="flex-1 py-2 text-[13px] font-medium rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={applyMonth}
                className="flex-1 py-2 text-[13px] font-semibold rounded-xl text-primary-foreground transition-colors cursor-pointer"
                style={{ background: 'linear-gradient(135deg, hsl(178,58%,28%) 0%, hsl(178,52%,36%) 100%)' }}
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Custom range panel ── */}
      <AnimatePresence>
        {openPanel === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-card border border-border rounded-2xl overflow-hidden w-full"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {/* Header */}
            <div
              className="px-4 pt-3 pb-2.5 border-b border-border/60"
              style={{ background: 'linear-gradient(135deg, hsl(210,60%,16%) 0%, hsl(178,50%,20%) 100%)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Date Range</p>
              <p className="text-white font-semibold text-sm">
                {customStart && customEnd
                  ? `${format(new Date(customStart), 'd MMM')} – ${format(new Date(customEnd), 'd MMM yyyy')}`
                  : 'Pick start & end dates'}
              </p>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setOpenPanel(null)}
                  className="flex-1 py-2 text-[13px] font-medium rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCustom}
                  disabled={!customStart || !customEnd}
                  className="flex-1 py-2 text-[13px] font-semibold rounded-xl text-primary-foreground transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, hsl(178,58%,28%) 0%, hsl(178,52%,36%) 100%)' }}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}