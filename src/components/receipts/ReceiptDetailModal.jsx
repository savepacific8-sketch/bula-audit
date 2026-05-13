import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatFJD, formatCategory, formatPaymentMethod } from '@/lib/formatCurrency';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier" value={receipt.supplier_name} />
          <Field label="Supplier TIN" value={receipt.supplier_tin} />
          <Field label="Receipt #" value={receipt.receipt_number} />
          <Field label="Date" value={receipt.receipt_date ? format(new Date(receipt.receipt_date), 'dd MMM yyyy') : null} />
          <Field label="Subtotal" value={formatFJD(receipt.subtotal)} />
          <Field label="VAT Rate" value={receipt.vat_rate ? `${receipt.vat_rate}%` : null} />
          <Field label="VAT Amount" value={formatFJD(receipt.vat_amount)} />
          <Field label="Total" value={formatFJD(receipt.total_amount)} />
          <Field label="Payment" value={formatPaymentMethod(receipt.payment_method)} />
          <Field label="Category" value={formatCategory(receipt.category)} />
          <Field label="Uploaded By" value={receipt.uploaded_by} />
          <Field label="Reviewed By" value={receipt.reviewed_by} />
        </div>

        {receipt.notes && (
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Notes</p>
            <p className="text-sm mt-0.5">{receipt.notes}</p>
          </div>
        )}

        {canApprove && receipt.status === 'pending' && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleStatusChange('approved')}
              disabled={updating}
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </Button>
            <Button
              onClick={() => handleStatusChange('rejected')}
              disabled={updating}
              variant="destructive"
              className="flex-1 gap-2"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}