export default function UsageMeter({ used, limit, label = 'Receipts this month' }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isWarning = pct >= 80 && pct < 100;
  const isFull = pct >= 100;

  const barColor = isFull
    ? 'bg-rose-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-primary';

  const textColor = isFull
    ? 'text-rose-600'
    : isWarning
    ? 'text-amber-600'
    : 'text-primary';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-semibold ${textColor}`}>
          {used} / {limit === 999 ? '∞' : limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isFull && (
        <p className="text-[11px] text-rose-600 font-medium">
          Receipt limit reached — upgrade to continue uploading
        </p>
      )}
      {isWarning && (
        <p className="text-[11px] text-amber-600 font-medium">
          {limit - used} receipts remaining this month
        </p>
      )}
    </div>
  );
}