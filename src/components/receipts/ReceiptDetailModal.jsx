import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatFJD, formatCategory, formatPaymentMethod } from '@/lib/formatCurrency';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { toast } from 'sonner';

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700' },
};

export default function ReceiptDetailModal({ receipt, open, onClose, onUpdate }) {
  const { canApprove } = useCompany();
  const [updating, setUpdating] = useState(false);

  if (!receipt) return null;

  const status = statusConfig[receipt.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Receipt.update(receipt.id, {
        status: newStatus,
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString()
      });
      toast.success(`Receipt ${newStatus}`);
      onUpdate();
      onClose();
    } catch (err) {
      toast.error('Failed to update receipt');
    } finally {
      setUpdating(false);
    }
  };

  const Field = ({ label, value }) => (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Receipt Details
            <Badge className={`ml-auto ${status.className}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {receipt.photo_url && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={receipt.photo_url} alt="Receipt" className="w-full max-h-56 object-contain bg-muted" />
          </div>
        )}

        {/* AI Extraction Summary */}
        {(receipt.ai_confidence != null || receipt.ai_missing_fields?.length > 0) && (
          <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> AI Extraction
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {receipt.ai_confidence != null && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${receipt.ai_confidence >= 80 ? 'bg-emerald-500' : receipt.ai_confidence >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium">{receipt.ai_confidence}% confidence</span>
                </div>
              )}
              {receipt.ai_missing_fields?.length > 0 && (
                <div className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs">Missing: {receipt.ai_missing_fields.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier" value={receipt.supplier_name} />
          <Field label="Supplier TIN" value={receipt.supplier_tin} />
          <Field label="Receipt #" value={receipt.receipt_number} />
          <Field label="Date" value={receipt.receipt_date ? format(new Date(receipt.receipt_date), 'dd MMM yyyy') : null} />
          <Field label="Currency" value={receipt.currency} />
          <Field label="Payment" value={formatPaymentMethod(receipt.payment_method)} />
          <Field label="Subtotal" value={formatFJD(receipt.subtotal)} />
          <Field label="VAT Rate" value={receipt.vat_rate ? `${receipt.vat_rate}%` : null} />
          <Field label="VAT Amount" value={formatFJD(receipt.vat_amount)} />
          <Field label="Total" value={formatFJD(receipt.total_amount)} />
          <Field label="Category" value={formatCategory(receipt.category)} />
          <Field label="Uploaded By" value={receipt.uploaded_by} />
          {receipt.reviewed_by && <Field label="Reviewed By" value={receipt.reviewed_by} />}
        </div>

        {/* Line Items */}
        {receipt.item_lines?.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
            <div className="rounded-lg border border-border overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Unit</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.item_lines.map((line, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{line.description || '—'}</td>
                      <td className="px-3 py-2 text-right">{line.quantity ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{line.unit_price != null ? formatFJD(line.unit_price) : '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{line.line_total != null ? formatFJD(line.line_total) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {receipt.notes && (
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Notes</p>
            <p className="text-sm mt-0.5">{receipt.notes}</p>
          </div>
        )}

        {canApprove && receipt.status !== 'approved' && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleStatusChange('approved')}
              disabled={updating}
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </Button>
            {receipt.status === 'pending' && (
              <Button
                onClick={() => handleStatusChange('rejected')}
                disabled={updating}
                variant="destructive"
                className="flex-1 gap-2"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}