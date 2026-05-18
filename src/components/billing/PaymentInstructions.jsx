import { PAYMENT_METHODS } from '@/lib/billing';
import { useState } from 'react';

export default function PaymentInstructions({ amount, planName, cycle }) {
  const [selected, setSelected] = useState(PAYMENT_METHODS[0].value);
  const method = PAYMENT_METHODS.find(m => m.value === selected);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">Amount due for <strong>{planName}</strong> ({cycle})</p>
        <p className="text-3xl font-bold text-primary">FJD ${amount}</p>
      </div>

      {/* Method tabs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Method</p>
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => setSelected(m.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selected === m.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-foreground hover:border-primary/40'
              }`}
            >
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      {method && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Instructions</p>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {method.instructions}
          </pre>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        After paying, upload your proof of payment below. Our team will activate your plan within 24 hours.
      </p>
    </div>
  );
}