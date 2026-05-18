import { useState } from 'react';
import { ChevronDown, Calendar, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

/**
 * period shape:
 * { type: 'this_month' | 'last_month' | 'select_month' | 'custom', start: Date, end: Date, label: string }
 */

export function buildPeriod(type, customMonth = null, customRange = null) {
  const now = new Date();
  if (type === 'this_month') {
    return { type, start: startOfMonth(now), end: endOfMonth(now), label: 'This Month' };
  }
  if (type === 'last_month') {
    const lm = subMonths(now, 1);
    return { type, start: startOfMonth(lm), end: endOfMonth(lm), label: 'Last Month' };
  }
  if (type === 'select_month' && customMonth) {
    return {
      type,
      start: startOfMonth(customMonth),
      end: endOfMonth(customMonth),
      label: format(customMonth, 'MMMM yyyy'),
    };
  }
  if (type === 'custom' && customRange?.start && customRange?.end) {
    return {
      type,
      start: customRange.start,
      end: customRange.end,
      label: `${format(customRange.start, 'd MMM yyyy')} – ${format(customRange.end, 'd MMM yyyy')}`,
    };
  }
  // fallback
  return { type: 'this_month', start: startOfMonth(now), end: endOfMonth(now), label: 'This Month' };
}

export default function DashboardPeriodFilter({ period, onChange }) {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(
    period.type === 'select_month' ? period.start : new Date()
  );
  const [customStart, setCustomStart] = useState(
    period.type === 'custom' ? format(period.start, 'yyyy-MM-dd') : ''
  );
  const [customEnd, setCustomEnd] = useState(
    period.type === 'custom' ? format(period.end, 'yyyy-MM-dd') : ''
  );

  const quick = ['this_month', 'last_month'];

  const handleQuick = (type) => {
    setShowMonthPicker(false);
    setShowCustomPicker(false);
    onChange(buildPeriod(type));
  };

  const handleSelectMonthToggle = () => {
    setShowCustomPicker(false);
    setShowMonthPicker(v => !v);
  };

  const handleCustomToggle = () => {
    setShowMonthPicker(false);
    setShowCustomPicker(v => !v);
  };

  const applyMonth = () => {
    onChange(buildPeriod('select_month', pickerMonth));
    setShowMonthPicker(false);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    onChange(buildPeriod('custom', null, { start: new Date(customStart), end: new Date(customEnd) }));
    setShowCustomPicker(false);
  };

  // Generate month/year navigation
  const monthLabel = format(pickerMonth, 'MMMM yyyy');
  const prevMonth = () => setPickerMonth(m => subMonths(m, 1));
  const nextMonth = () => {
    const next = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1);
    if (next <= new Date()) setPickerMonth(next);
  };
  const canGoNext = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1) <= new Date();

  return (
    <div className="space-y-2">
      {/* Segmented + dropdown row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Quick presets */}
        <div className="flex rounded-xl overflow-hidden border border-border bg-card shadow-sm">
          {quick.map((type) => {
            const label = type === 'this_month' ? 'This Month' : 'Last Month';
            const active = period.type === type;
            return (
              <button
                key={type}
                onClick={() => handleQuick(type)}
                className={`px-3 py-2 text-[13px] font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  ${active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Select Month button */}
        <button
          onClick={handleSelectMonthToggle}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-medium transition-colors duration-150 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${period.type === 'select_month'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-foreground hover:bg-muted'
            }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {period.type === 'select_month' ? period.label : 'Select Month'}
          <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${showMonthPicker ? 'rotate-180' : ''}`} />
        </button>

        {/* Custom Range button */}
        <button
          onClick={handleCustomToggle}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-medium transition-colors duration-150 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${period.type === 'custom'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-foreground hover:bg-muted'
            }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {period.type === 'custom' ? period.label : 'Custom Range'}
          <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${showCustomPicker ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Month picker panel */}
      {showMonthPicker && (
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 w-full max-w-xs space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-foreground cursor-pointer text-lg font-bold">‹</button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              onClick={nextMonth}
              disabled={!canGoNext}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold cursor-pointer
                ${canGoNext ? 'hover:bg-muted text-foreground' : 'text-muted-foreground cursor-not-allowed opacity-40'}`}
            >›</button>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowMonthPicker(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
            <button onClick={applyMonth} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-semibold">Apply</button>
          </div>
        </div>
      )}

      {/* Custom range panel */}
      {showCustomPicker && (
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 w-full max-w-sm space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Date Range</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End Date</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCustomPicker(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted cursor-pointer">Cancel</button>
            <button
              onClick={applyCustom}
              disabled={!customStart || !customEnd}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-semibold disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}