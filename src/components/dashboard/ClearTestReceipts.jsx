import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { queryClientInstance } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ClearTestReceipts({ onCleared }) {
  const { company, userRole } = useCompany();
  const [step, setStep] = useState(0); // 0=idle, 1=first confirm, 2=second confirm
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState(null); // { count } | { error }

  // Only visible to owner / admin
  if (userRole !== 'owner' && userRole !== 'admin') return null;

  const handleCancel = () => { setStep(0); };

  const handleDelete = async () => {
    setDeleting(true);
    setStep(0);
    try {
      // 1. Fetch all receipts for this company
      const receipts = await base44.entities.Receipt.filter({ company_id: company.id });

      if (receipts.length === 0) {
        setResult({ count: 0 });
        setDeleting(false);
        return;
      }

      // 2. Delete each receipt (item_lines and AI data are stored inline — deleted with the receipt)
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
        setResult({ error: `Permission denied or error:\n${errors.slice(0, 3).join('\n')}` });
        setDeleting(false);
        return;
      }

      // 3. Wipe all receipt cache data immediately (removes stale data from UI at once)
      // then refetch all active receipt queries from the database
      queryClientInstance.setQueriesData({ queryKey: ['receipts'] }, []);
      queryClientInstance.setQueriesData({ queryKey: ['receipt'] }, null);
      await queryClientInstance.invalidateQueries({ queryKey: ['receipts'] });
      await queryClientInstance.invalidateQueries({ queryKey: ['receipt'] });

      setResult({ count: deleted, errors: errors.length > 0 ? errors : null });
      onCleared?.();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        disabled={deleting}
        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-1.5 shrink-0"
        onClick={() => setStep(1)}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {deleting ? 'Deleting…' : 'Clear Test Receipts'}
      </Button>

      {/* Result notification */}
      {result && (
        <div
          className={`fixed bottom-24 md:bottom-6 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-xl flex items-start gap-2 ${
            result.error ? 'bg-destructive text-destructive-foreground' : 'bg-emerald-600 text-white'
          }`}
        >
          {result.error
            ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            {result.error
              ? <span className="whitespace-pre-wrap break-words">{result.error}</span>
              : <>
                  <span className="font-semibold">Deleted {result.count} receipt{result.count !== 1 ? 's' : ''}</span>
                  {result.errors && (
                    <p className="text-xs mt-0.5 opacity-80">{result.errors.length} failed — check permissions</p>
                  )}
                </>
            }
          </div>
          <button className="ml-2 opacity-70 hover:opacity-100 shrink-0" onClick={() => setResult(null)}>✕</button>
        </div>
      )}

      {/* Step 1 — first confirmation */}
      <AlertDialog open={step === 1} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Clear all receipts for {company?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>This will permanently delete <strong>all receipt records</strong>, including:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Receipt records and metadata</li>
                  <li>All AI extraction data and confidence scores</li>
                  <li>All line items stored on receipts</li>
                  <li>Uploaded receipt image references</li>
                </ul>
                <p className="font-medium pt-1">
                  Users, company settings, VAT configuration, and team members will <strong>not</strong> be affected.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setStep(2)}
            >
              Yes, continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2 — final confirmation */}
      <AlertDialog open={step === 2} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm space-y-2">
                <p className="text-base font-semibold text-foreground">
                  This action <span className="underline">cannot be undone</span>.
                </p>
                <p>
                  All receipts for <strong>{company?.name}</strong> will be permanently deleted from the database.
                  There is no way to recover this data.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel — keep receipts</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete everything — I understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}