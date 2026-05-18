import { PLANS, STATUS_CONFIG } from '@/lib/billing';

export default function PlanBadge({ planKey, status, size = 'sm' }) {
  const plan = PLANS[planKey];
  const statusCfg = STATUS_CONFIG[status];

  const textSize = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {plan && (
        <span className={`inline-flex items-center rounded-md border font-semibold ${plan.badge_class} ${textSize}`}>
          {plan.name}
        </span>
      )}
      {statusCfg && (
        <span className={`inline-flex items-center rounded-md border font-semibold ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} ${textSize}`}>
          {statusCfg.label}
        </span>
      )}
    </div>
  );
}