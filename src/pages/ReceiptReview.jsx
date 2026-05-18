import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { extractReceiptData } from '@/lib/extractReceipt.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2,
  Sparkles, AlertTriangle, RotateCcw, Save
} from 'lucide-react';
import VatAdvisorChat from '@/components/receipts/VatAdvisorChat';

const VAT_TYPES = [
  { value: 'inclusive',  label: 'VAT Inclusive' },
  { value: 'exclusive',  label: 'VAT Exclusive' },
  { value: 'zero_rated', label: 'Zero-rated' },
  { value: 'exempt',     label: 'VAT Exempt' },
  { value: 'no_vat',     label: 'No VAT Shown' },
  { value: 'manual',     label: 'Manual' },
];

const r2 = (n) => Math.round(n * 100) / 100;

// Returns updated fields based on vat_type change
function applyVatLogic(vat_type, current) {
  const sub   = parseFloat(current.subtotal)    || 0;
  const total = parseFloat(current.total_amount) || 0;
  const rate  = parseFloat(current.vat_rate)     || 12.5;

  if (vat_type === 'exclusive') {
    // net subtotal + vat = total
    const vat = r2(sub * (rate / 100));
    return { vat_amount: vat, total_amount: r2(sub + vat) };
  }
  if (vat_type === 'inclusive') {
    // total already includes VAT: net = total - vat, vat = net × rate
    // Derive from total using: vat = total × rate / (100 + rate)
    const vat     = r2(total * rate / (100 + rate));
    const subtotal = r2(total - vat);
    return { vat_amount: vat, subtotal };
  }
  if (vat_type === 'zero_rated') {
    return { vat_rate: 0, vat_amount: 0, total_amount: r2(sub) };
  }
  if (vat_type === 'exempt' || vat_type === 'no_vat') {
    return { vat_rate: '', vat_amount: '', total_amount: r2(sub) };
  }
  return {};
}

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

const statusConfig = {
  pending:  { label: 'Pending Review', icon: Clock,        className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved',       icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected',       icon: XCircle,      className: 'bg-red-100 text-red-700' },
};

export default function ReceiptReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company, canApprove } = useCompany();

  const [receipt, setReceipt] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [scanning, setScanning] = useState(false);

  // Read receipt ID from query string
  const receiptId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!receiptId) { navigate('/receipts'); return; }
    base44.entities.Receipt.filter({ id: receiptId }).then(([r]) => {
      if (!r) { navigate('/receipts'); return; }
      setReceipt(r);
      setForm({
        supplier_name:    r.supplier_name    || '',
        supplier_tin:     r.supplier_tin     || '',
        receipt_number:   r.receipt_number   || '',
        receipt_date:     r.receipt_date     || '',
        currency:         r.currency         || 'FJD',
        subtotal:         r.subtotal         ?? '',
        vat_type:         r.vat_type         || 'inclusive',
        vat_rate:         r.vat_rate         ?? 12.5,
        vat_amount:       r.vat_amount       ?? '',
        total_amount:     r.total_amount     ?? '',
        payment_method:   r.payment_method   || '',
        category:         r.category         || '',
        notes:            r.notes            || '',
      });
      setLoading(false);
    });
  }, [receiptId]);

  const field = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleVatTypeChange = (vat_type) => {
    setForm(prev => {
      const updates = applyVatLogic(vat_type, prev);
      return { ...prev, vat_type, ...updates };
    });
  };

  // When a number field changes, recalc if vat_type is exclusive or inclusive
  const handleAmountChange = (key, val) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (next.vat_type === 'exclusive' || next.vat_type === 'inclusive') {
        const updates = applyVatLogic(next.vat_type, next);
        return { ...next, ...updates };
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Receipt.update(receipt.id, {
        supplier_name:  form.supplier_name  || undefined,
        supplier_tin:   form.supplier_tin   || undefined,
        receipt_number: form.receipt_number || undefined,
        receipt_date:   form.receipt_date   || undefined,
        currency:       form.currency       || 'FJD',
        vat_type:       form.vat_type       || undefined,
        subtotal:       form.subtotal !== '' ? Number(form.subtotal) : undefined,
        vat_rate:       form.vat_rate !== '' ? Number(form.vat_rate) : undefined,
        vat_amount:     form.vat_amount !== '' ? Number(form.vat_amount) : undefined,
        total_amount:   form.total_amount !== '' ? Number(form.total_amount) : undefined,
        payment_method: form.payment_method || undefined,
        category:       form.category       || undefined,
        notes:          form.notes          || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Changes saved');
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Receipt.update(receipt.id, {
        status:        newStatus,
        reviewed_by:   user.email,
        reviewed_date: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success(`Receipt ${newStatus}`);
      setReceipt(prev => ({ ...prev, status: newStatus, reviewed_by: user.email }));
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleRescan = async () => {
    setScanning(true);
    toast.info('Re-running AI scan…');
    const result = await extractReceiptData(receipt.photo_url);
    setForm(prev => ({
      ...prev,
      supplier_name:  result.supplier_name  || '',
      supplier_tin:   result.supplier_tin   || '',
      receipt_number: result.receipt_number || '',
      receipt_date:   result.receipt_date   || '',
      currency:       result.currency       || 'FJD',
      vat_type:       result.vat_type       || prev.vat_type || 'inclusive',
      subtotal:       result.subtotal       ?? '',
      vat_rate:       result.vat_rate       ?? 12.5,
      vat_amount:     result.vat_amount     ?? '',
      total_amount:   result.total_amount   ?? '',
      payment_method: result.payment_method || '',
      category:       result.category       || '',
    }));
    // Also persist AI metadata
    await base44.entities.Receipt.update(receipt.id, {
      ai_confidence:    result.ai_confidence    ?? undefined,
      ai_missing_fields: result.ai_missing_fields?.length ? result.ai_missing_fields : undefined,
    });
    setReceipt(prev => ({
      ...prev,
      ai_confidence:    result.ai_confidence    ?? prev.ai_confidence,
      ai_missing_fields: result.ai_missing_fields ?? prev.ai_missing_fields,
    }));
    toast.success('AI scan complete');
    setScanning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const status = statusConfig[receipt.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const confidence = receipt.ai_confidence;
  const confidenceColor = confidence >= 80 ? 'bg-emerald-500' : confidence >= 50 ? 'bg-amber-400' : 'bg-red-400';
  const confidenceText  = confidence >= 80 ? 'text-emerald-700' : confidence >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b border-border px-4 flex items-center gap-3 bg-background/95 backdrop-blur"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
          paddingBottom: '10px',
        }}
      >
        <Button variant="ghost" size="icon" onClick={() => navigate('/receipts')} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate font-poppins">Receipt Review</h1>
          <p className="text-xs text-muted-foreground truncate">{receipt.supplier_name || 'No supplier'}</p>
        </div>
        <Badge className={`${status.className} shrink-0`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {status.label}
        </Badge>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* Receipt Image */}
        {receipt.photo_url && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={receipt.photo_url} alt="Receipt" className="w-full max-h-64 object-contain bg-muted" />
          </div>
        )}

        {/* AI Confidence Banner */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-primary" /> AI Extraction
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRescan}
              disabled={scanning}
              className="gap-1.5 text-xs h-7"
            >
              {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Re-run AI Scan
            </Button>
          </div>

          {confidence != null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Confidence Score</span>
                <span className={`font-semibold ${confidenceText}`}>{confidence}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confidenceColor}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}

          {receipt.ai_missing_fields?.length > 0 && (
            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 rounded-lg px-3 py-2 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span><strong>Missing fields:</strong> {receipt.ai_missing_fields.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Editable Form */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Receipt Details</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Supplier Name</Label>
              <Input value={form.supplier_name} onChange={e => field('supplier_name', e.target.value)} placeholder="e.g. Vinod's Store" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Supplier TIN</Label>
              <Input value={form.supplier_tin} onChange={e => field('supplier_tin', e.target.value)} placeholder="TIN number" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Receipt Number</Label>
              <Input value={form.receipt_number} onChange={e => field('receipt_number', e.target.value)} placeholder="e.g. INV-001" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Receipt Date</Label>
              <Input type="date" value={form.receipt_date} onChange={e => field('receipt_date', e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency} onChange={e => field('currency', e.target.value)} placeholder="FJD" maxLength={3} />
            </div>
          </div>

          {/* VAT Type */}
          <div className="space-y-1">
            <Label className="text-xs">VAT Type</Label>
            <Select value={form.vat_type} onValueChange={handleVatTypeChange}>
              <SelectTrigger><SelectValue placeholder="Select VAT type…" /></SelectTrigger>
              <SelectContent>
                {VAT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Subtotal: user-entered for exclusive; auto-calc for inclusive */}
            <div className="space-y-1">
              <Label className="text-xs">
                Subtotal
                {form.vat_type === 'inclusive' && <span className="ml-1 text-muted-foreground">(auto)</span>}
              </Label>
              <Input
                type="number"
                value={form.subtotal}
                onChange={e => handleAmountChange('subtotal', e.target.value)}
                placeholder="0.00"
                readOnly={form.vat_type === 'inclusive'}
                className={form.vat_type === 'inclusive' ? 'bg-muted text-muted-foreground' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">VAT Rate (%)</Label>
              <Input
                type="number"
                value={form.vat_rate}
                onChange={e => handleAmountChange('vat_rate', e.target.value)}
                placeholder="12.5"
                readOnly={form.vat_type === 'zero_rated' || form.vat_type === 'exempt' || form.vat_type === 'no_vat'}
                className={(form.vat_type === 'zero_rated' || form.vat_type === 'exempt' || form.vat_type === 'no_vat') ? 'bg-muted text-muted-foreground' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                VAT Amount
                {(form.vat_type === 'inclusive' || form.vat_type === 'exclusive') && <span className="ml-1 text-muted-foreground">(auto)</span>}
              </Label>
              <Input
                type="number"
                value={form.vat_amount}
                onChange={e => field('vat_amount', e.target.value)}
                placeholder="0.00"
                readOnly={form.vat_type === 'inclusive' || form.vat_type === 'exclusive'}
                className={(form.vat_type === 'inclusive' || form.vat_type === 'exclusive') ? 'bg-muted text-muted-foreground' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Total Amount
                {form.vat_type === 'exclusive' && <span className="ml-1 text-muted-foreground font-normal">(auto)</span>}
              </Label>
              <Input
                type="number"
                value={form.total_amount}
                onChange={e => handleAmountChange('total_amount', e.target.value)}
                placeholder="0.00"
                readOnly={form.vat_type === 'exclusive'}
                className={form.vat_type === 'exclusive' ? 'bg-muted text-muted-foreground font-semibold' : 'font-semibold'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => field('payment_method', v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => field('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>

        {/* Line Items (read-only) */}
        {receipt.item_lines?.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Line Items</h2>
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
                      <td className="px-3 py-2 text-right">{line.unit_price != null ? `${form.currency || 'FJD'} ${Number(line.unit_price).toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{line.line_total != null ? `${form.currency || 'FJD'} ${Number(line.line_total).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fiji VAT Advisor */}
        <VatAdvisorChat receiptId={receiptId} receipt={receipt} />

        {/* Meta */}
        <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 gap-3 text-xs">
          {receipt.uploaded_by && (
            <div>
              <p className="text-muted-foreground uppercase tracking-wide mb-0.5">Uploaded By</p>
              <p className="font-medium">{receipt.uploaded_by}</p>
            </div>
          )}
          {receipt.reviewed_by && (
            <div>
              <p className="text-muted-foreground uppercase tracking-wide mb-0.5">Reviewed By</p>
              <p className="font-medium">{receipt.reviewed_by}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border px-4 pt-3 flex gap-2 max-w-2xl mx-auto"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 gap-1.5 h-11 rounded-xl font-semibold border-border"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>

        {canApprove && receipt.status !== 'approved' && (
          <Button
            onClick={() => handleStatusChange('approved')}
            disabled={saving}
            className="flex-1 gap-1.5 h-11 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve
          </Button>
        )}

        {canApprove && receipt.status !== 'rejected' && (
          <Button
            onClick={() => handleStatusChange('rejected')}
            disabled={saving}
            className="flex-1 gap-1.5 h-11 rounded-xl font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}