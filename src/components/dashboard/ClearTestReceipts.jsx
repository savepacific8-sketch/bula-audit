import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
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
  const [result, setResult] = useState(null);

  // Only visible to owner / admin
  if (userRole !== 'owner' && userRole !== 'admin') return null;

  const handleFirstConfirm = () => setStep(1);
  const handleSecondConfirm = () => setStep(2);
  const handleCancel = () => { setStep(0); setResult(null); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const receipts = await base44.entities.Receipt.filter({ company_id: company.id });
      let deleted = 0;
      for (const r of receipts) {
        await base44.entities.Receipt.delete(r.id);
        deleted++;
      }
      setResult({ count: deleted });
      setStep(0);
      onCleared?.();
    } catch (err) {
      setResult({ error: err.message });
      setStep(0);
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
        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-1.5"
        onClick={handleFirstConfirm}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Clear Test Receipts
      </Button>

      {/* Result toast-style message */}
      {result && (
        <div className={`fixed bottom-24 md:bottom-6 right-4 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg ${result.error ? 'bg-destructive text-destructive-foreground' : 'bg-emerald-600 text-white'}`}>
          {result.error ? `Error: ${result.error}` : `✓ Deleted ${result.count} receipt${result.count !== 1 ? 's' : ''}`}
          <button className="ml-3 opacity-70 hover:opacity-100" onClick={() => setResult(null)}>✕</button>
        </div>
      )}

      {/* Step 1 — first confirmation */}
      <AlertDialog open={step === 1} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Clear all receipts?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will permanently delete <strong>all receipt records</strong> for <strong>{company?.name}</strong>, including:
              </span>
              <ul className="list-disc list-inside text-sm space-y-0.5 pl-1">
                <li>Receipt records and metadata</li>
                <li>AI extraction data and item lines</li>
                <li>Uploaded receipt images</li>
              </ul>
              <span className="block mt-2 font-medium">
                Users, company settings, VAT configuration, and team members will <strong>not</strong> be affected.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleSecondConfirm}
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
            <AlertDialogDescription>
              <span className="block text-base font-semibold text-foreground mb-1">
                This action <span className="underline">cannot be undone</span>.
              </span>
              All receipts for <strong>{company?.name}</strong> will be permanently deleted. There is no way to recover this data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel — keep receipts</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete everything — I understand'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}