import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS, formatPlanPrice } from '@/lib/billing';

export default function PlanCard({ planKey, cycle, currentPlanKey, onSelect, disabled }) {
  const plan = PLANS[planKey];
  if (!plan) return null;

  const isCurrent = planKey === currentPlanKey;
  const isUpgrade = !isCurrent;
  const price = formatPlanPrice(planKey, cycle);

  return (
    <div
      className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
        plan.popular
          ? 'border-accent shadow-md ring-2 ring-accent/20'
          : isCurrent
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card hover:border-primary/30'
      }`}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow"
          style={{ background: 'hsl(var(--accent))' }}
        >
          <Star className="w-2.5 h-2.5 fill-white" /> Most Popular
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-foreground text-base">{plan.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: plan.color + '22' }}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: plan.color }} />
          </div>
        </div>

        {/* Price */}
        <div className="mt-3">
          <span className="text-2xl font-bold text-foreground" style={{ color: plan.color }}>{price}</span>
          {cycle === 'yearly' && plan.price_monthly > 0 && (
            <span className="ml-2 text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md px-1.5 py-0.5 font-semibold">
              2 months free
            </span>
          )}
        </div>
      </div>

      {/* Limits */}
      <div className="flex gap-3 text-[11px] font-medium text-muted-foreground">
        <span className="px-2 py-0.5 rounded-md bg-muted">
          {plan.receipt_limit >= 5000 ? '5,000' : plan.receipt_limit.toLocaleString()} receipts/mo
        </span>
        <span className="px-2 py-0.5 rounded-md bg-muted">
          {plan.user_limit >= 999 ? 'Team access' : `${plan.user_limit} user${plan.user_limit > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Features */}
      <ul className="space-y-1.5 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
            <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <div className="text-center text-xs font-semibold text-primary py-2 border border-primary/30 rounded-xl bg-primary/5">
          Current Plan
        </div>
      ) : (
        <Button
          onClick={() => onSelect(planKey)}
          disabled={disabled}
          className="w-full mt-auto"
          style={plan.popular ? { background: 'hsl(var(--accent))' } : {}}
          variant={plan.popular ? 'default' : 'outline'}
        >
          {plan.price_monthly === 0 ? 'Current Plan' : isUpgrade ? 'Select Plan' : 'Downgrade'}
        </Button>
      )}
    </div>
  );
}