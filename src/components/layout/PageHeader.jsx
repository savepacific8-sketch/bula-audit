/**
 * PageHeader – Consistent Fiji-branded section header across all pages.
 * Deep Pacific blue gradient with masi/wave pattern, coral accent bar,
 * large Poppins title, muted subtitle, and optional action slot.
 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div
      className="rounded-2xl mb-5 px-5 pt-5 pb-4 masi-pattern wave-pattern relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, hsl(var(--fiji-deep)) 0%, hsl(210,55%,22%) 100%)' }}
    >
      {/* Coral left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ background: 'hsl(var(--accent))' }}
      />

      {/* Subtle bottom highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />

      <div className="flex items-center justify-between gap-4 ml-3">
        <div className="min-w-0">
          <h1 className="text-white font-poppins font-bold text-2xl leading-tight tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/50 text-xs mt-1 font-medium">{subtitle}</p>
          )}
        </div>
        {action && (
          <div className="shrink-0">{action}</div>
        )}
      </div>
    </div>
  );
}