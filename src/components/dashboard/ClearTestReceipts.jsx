import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { queryClientInstance } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function ClearTestReceipts({ onCleared }) {
  const { company, userRole } = useCompany();
  const [step, setStep] = useState(0); // 0=idle, 1=first confirm, 2=second confirm, 3=deleting
  const [result, setResult] = useState(null);

  if (userRole !== 'owner' && userRole !== 'admin') return null;

  const handleDelete = async () => {
    setStep(3); // show inline deleting state
    setResult(null);
    try {
      const receipts = await base44.entities.Receipt.filter({ company_id: company.id });

      if (receipts.length === 0) {
        setResult({ count: 0 });
        setStep(0);
        return;
      }

      let deleted = 0;
      const errors = [];
      for (const r of receipts) {
        try {
          await base44.entities.Receipt.delete(r.id);
          deleted++;
        } catch (err) {
          errors.push(`Receipt ${r.id}: ${err.message}`);
        }
      }

      if (errors.length > 0 && deleted === 0) {
        setResult({ error: `Permission denied:\n${errors.slice(0, 3).join('\n')}` });
        setStep(0);
        return;
      }

      // Immediately zero out cache so UI shows empty states right away
      queryClientInstance.setQueriesData({ queryKey: ['receipts'] }, []);
      queryClientInstance.setQueriesData({ queryKey: ['receipt'] }, null);
      // Then trigger background refetch from DB
      await queryClientInstance.invalidateQueries({ queryKey: ['receipts'] });
      await queryClientInstance.invalidateQueries({ queryKey: ['receipt'] });

      setResult({ count: deleted, partialErrors: errors.length > 0 ? errors.length : 0 });
      setStep(0);
      onCleared?.();
    } catch (err) {
      setResult({ error: err.message });
      setStep(0);
    }
  };

  // ── Inline confirmation UI (avoids AlertDialog intercept issues) ──
  if (step === 1) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-right max-w-xs">
          <p className="font-semibold text-destructive mb-1">Delete ALL receipts for {company?.name}?</p>
          <p className="text-muted-foreground mb-2">This removes all receipt data, AI extractions, and line items. Team, users, and settings are kept.</p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStep(0)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setStep(2)}>Yes, continue</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-3 text-xs text-right max-w-xs">
          <p className="font-bold text-destructive mb-1">⚠️ This cannot be undone.</p>
          <p className="text-muted-foreground mb-2">All receipts for <strong>{company?.name}</strong> will be permanently deleted from the database.</p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStep(0)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete everything
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <Button variant="outline" size="sm" disabled className="border-destructive/40 text-destructive gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Deleting…
      </Button>
    );
  }

  // step === 0 — idle
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-1.5 shrink-0"
        onClick={() => { setResult(null); setStep(1); }}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Clear Test Receipts
      </Button>

      {result && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs shadow-md max-w-xs ${result.error ? 'bg-destructive text-destructive-foreground' : 'bg-emerald-600 text-white'}`}>
          {result.error
            ? <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          }
          <span className="whitespace-pre-wrap break-words flex-1">
            {result.error
              ? result.error
              : `Deleted ${result.count} receipt${result.count !== 1 ? 's' : ''}${result.partialErrors ? ` (${result.partialErrors} failed)` : ''}`
            }
          </span>
          <button className="opacity-70 hover:opacity-100 shrink-0 ml-1" onClick={() => setResult(null)}>✕</button>
        </div>
      )}
    </div>
  );
}