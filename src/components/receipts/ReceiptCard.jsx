import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { format } from 'date-fns';
import { Clock, CheckCircle2, XCircle, Paperclip, Banknote, AlertCircle } from 'lucide-react';

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' },
};

const paymentStatusConfig = {
  unpaid: { label: 'Unpaid', icon: AlertCircle, className: 'bg-rose-100 text-rose-700 border-rose-200' },
  paid: { label: 'Paid', icon: Banknote, className: 'bg-sky-100 text-sky-700 border-sky-200' },
};

export default function ReceiptCard({ receipt, onClick }) {
  const status = statusConfig[receipt.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const payStatus = paymentStatusConfig[receipt.payment_status] || paymentStatusConfig.unpaid;
  const PayIcon = payStatus.icon;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
      onClick={() => onClick(receipt)}
    >
      <div className="flex items-start gap-3">
        {receipt.photo_url && (
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            <img src={receipt.photo_url} alt="Receipt" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{receipt.supplier_name || 'Unknown Supplier'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {receipt.receipt_date ? format(new Date(receipt.receipt_date), 'dd MMM yyyy') : 'No date'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="font-bold text-sm whitespace-nowrap">{formatFJD(receipt.total_amount)}</p>
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${payStatus.className}`}>
                <PayIcon className="w-3 h-3 mr-1" />
                {payStatus.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${status.className}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
            {receipt.category && (
              <span className="text-[10px] text-muted-foreground">{formatCategory(receipt.category)}</span>
            )}
            {receipt.document_url && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/70">
                <Paperclip className="w-2.5 h-2.5" /> doc
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}