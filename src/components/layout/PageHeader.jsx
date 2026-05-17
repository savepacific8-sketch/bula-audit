/**
 * PageHeader – Fiji-inspired section header used across all pages.
 * Shows a deep-blue gradient banner with wave + masi pattern,
 * a title, optional subtitle, and optional action slot.
 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div
      className="rounded-2xl mb-6 px-5 py-5 masi-pattern wave-pattern relative overflow-hidden"
      style={{ background: 'hsl(var(--fiji-deep))' }}
    >
      {/* Coral accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: 'hsl(var(--accent))' }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="ml-2">
          <h1 className="text-white font-poppins font-bold text-xl leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-white/55 text-xs mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}