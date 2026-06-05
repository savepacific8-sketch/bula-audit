import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect } from '@/components/ui/MobileSelect';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { extractReceiptData } from '@/lib/extractReceipt';
import { formatApiError } from '@/lib/apiErrors';
import { isPdfFile } from '@/lib/receiptMedia';
import ReceiptMediaPreview from '@/components/receipts/ReceiptMediaPreview';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

export default function UploadReceiptModal({ open, onClose, onSuccess }) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [step, setStep] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [form, setForm] = useState({
    supplier_name: '', supplier_tin: '', receipt_number: '',
    receipt_date: '', currency: 'FJD', subtotal: '', vat_rate: company?.vat_rate || 12.5,
    vat_amount: '', total_amount: '', payment_method: '', category: '', notes: '',
    item_lines: [], ai_confidence: null, ai_missing_fields: []
  });

  const normalizeCategory = (cat) => {
    if (!cat) return '';
    return CATEGORIES.includes(cat) ? cat : 'other';
  };

  const normalizePayment = (m) => {
    if (!m) return '';
    return PAYMENT_METHODS.includes(m) ? m : 'other';
  };

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!company?.id) {
      toast.error('No company selected. Finish setup or refresh the page.');
      return;
    }
    setFileInputKey(k => k + 1);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    if (!isPdfFile(file)) {
      setLocalPreviewUrl(URL.createObjectURL(file));
    } else {
      setLocalPreviewUrl('');
    }
    setUploading(true);
    setStep('extract');
    try {
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      const file_url = uploaded?.file_url;
      if (!file_url) {
        throw new Error('Upload succeeded but no file URL was returned');
      }
      setPhotoUrl(file_url);

      setExtracting(true);
      try {
        const result = await extractReceiptData(file_url);
        setForm(prev => ({
          ...prev,
          supplier_name:     result.supplier_name    || '',
          supplier_tin:      result.supplier_tin     || '',
          receipt_number:    result.receipt_number   || '',
          receipt_date:      result.receipt_date     || '',
          currency:          result.currency         || 'FJD',
          subtotal:          result.subtotal !== '' && result.subtotal != null ? String(result.subtotal) : '',
          vat_rate:          result.vat_rate != null ? String(result.vat_rate) : String(company?.vat_rate ?? 12.5),
          vat_amount:        result.vat_amount !== '' && result.vat_amount != null ? String(result.vat_amount) : '',
          total_amount:      result.total_amount !== '' && result.total_amount != null ? String(result.total_amount) : '',
          payment_method:    normalizePayment(result.payment_method),
          category:          normalizeCategory(result.category),
          item_lines:        Array.isArray(result.item_lines) ? result.item_lines : [],
          ai_confidence:     result.ai_confidence    ?? null,
          ai_missing_fields: Array.isArray(result.ai_missing_fields) ? result.ai_missing_fields : [],
        }));
        toast.success('Receipt details filled automatically!');
      } catch (extractErr) {
        console.warn('[upload] extract failed:', extractErr);
        toast.error(formatApiError(extractErr, 'Auto-fill failed. Try a clearer photo or enter fields manually.'));
      } finally {
        setExtracting(false);
        setStep('review');
      }
    } catch (err) {
      console.error('[upload] failed:', err);
      toast.error(formatApiError(err, 'Failed to upload file'));
      setStep('upload');
    } finally {
      setUploading(false);
    }
  }, [company]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const fileAccept =
    'image/*,application/pdf,.heic,.heif,.jpg,.jpeg,.jfif,.png,.gif,.webp,.bmp,.tiff,.tif';

  const handleSave = async () => {
    if (!company?.id) {
      toast.error('No company loaded. Refresh the page or finish setup.');
      return;
    }
    if (!photoUrl) {
      toast.error('Upload a file first.');
      return;
    }
    if (!form.total_amount) {
      toast.error('Total amount is required.');
      return;
    }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Receipt.create({
        company_id:       company.id,
        photo_url:        photoUrl,
        supplier_name:    form.supplier_name    || undefined,
        supplier_tin:     form.supplier_tin     || undefined,
        receipt_number:   form.receipt_number   || undefined,
        receipt_date:     form.receipt_date     || format(new Date(), 'yyyy-MM-dd'),
        currency:         form.currency         || 'FJD',
        subtotal:         form.subtotal         ? Number(form.subtotal) : undefined,
        vat_rate:         form.vat_rate         ? Number(form.vat_rate) : undefined,
        vat_amount:       form.vat_amount       ? Number(form.vat_amount) : undefined,
        total_amount:     form.total_amount     ? Number(form.total_amount) : undefined,
        payment_method:   form.payment_method ? normalizePayment(form.payment_method) : undefined,
        category:         form.category ? normalizeCategory(form.category) : undefined,
        notes:            form.notes            || undefined,
        item_lines:       form.item_lines?.length ? form.item_lines : undefined,
        ai_confidence:    form.ai_confidence    ?? undefined,
        ai_missing_fields: form.ai_missing_fields?.length ? form.ai_missing_fields : undefined,
        status:           'pending',
        uploaded_by:      user.email,
      });
      toast.success('Receipt saved!');
      queryClient.invalidateQueries({ queryKey: ['receipt-usage'] });
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to save receipt'));
    } finally {
      setSaving(false);
    }
  };

  // Close on browser back gesture / hardware back button
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ uploadReceipt: true }, '');
    const handlePop = () => { handleClose(); };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paste image from clipboard (Ctrl+V) while modal is open
  useEffect(() => {
    if (!open) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, processFile]);

  const handleClose = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl('');
    setStep('upload');
    setPhotoUrl('');
    setFileInputKey(k => k + 1);
    setForm({
      supplier_name: '', supplier_tin: '', receipt_number: '',
      receipt_date: '', currency: 'FJD', subtotal: '', vat_rate: company?.vat_rate || 12.5,
      vat_amount: '', total_amount: '', payment_method: '', category: '', notes: '',
      item_lines: [], ai_confidence: null, ai_missing_fields: []
    });
    onClose();
  };

  const updateField = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate VAT and total when subtotal or vat_rate changes
      if (field === 'subtotal' || field === 'vat_rate') {
        const sub = parseFloat(field === 'subtotal' ? value : prev.subtotal) || 0;
        const rate = parseFloat(field === 'vat_rate' ? value : prev.vat_rate) || 0;
        const vatAmt = sub * (rate / 100);
        updated.vat_amount = vatAmt.toFixed(2);
        updated.total_amount = (sub + vatAmt).toFixed(2);
      }
      return updated;
    });
  };

  const formatLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <>
    {/* File input lives OUTSIDE the Dialog to avoid iOS Safari focus-trap issues */}
    <input
      key={`cam-${fileInputKey}`}
      ref={cameraInputRef}
      type="file"
      accept={fileAccept}
      capture="environment"
      style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0 }}
      onChange={handleFileChange}
    />
    <input
      key={`gal-${fileInputKey}`}
      ref={galleryInputRef}
      type="file"
      accept={fileAccept}
      style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0 }}
      onChange={handleFileChange}
    />

    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg flex flex-col p-0 gap-0" style={{ maxHeight: '90dvh', height: step === 'review' ? '90dvh' : 'auto' }}>
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle>
            {step === 'upload' && 'Upload Receipt'}
            {step === 'extract' && 'Scanning Receipt…'}
            {step === 'review' && 'Review & Save'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Works on phone: use camera or gallery. PDFs use free text scan.
            </p>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-semibold text-white shadow"
              style={{ background: 'hsl(var(--accent))' }}
            >
              <Camera className="w-5 h-5" /> Take photo (camera)
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-4 text-sm font-semibold hover:bg-muted/50"
            >
              <ImagePlus className="w-5 h-5" /> Gallery or PDF
            </button>
          </div>
        )}

        {step === 'extract' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 px-5">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {uploading ? 'Uploading file…' : extracting ? 'Scanning receipt (free)…' : 'Processing…'}
            </p>
            <p className="text-xs text-muted-foreground">
              {uploading ? 'Please wait' : 'Extracting receipt details, this takes a few seconds'}
            </p>
          </div>
        )}

        {step === 'review' && (
          <>
            {/* Scrollable form area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {(localPreviewUrl || photoUrl) && (
                <div className="rounded-lg overflow-hidden border border-border min-h-24 max-h-48">
                  <ReceiptMediaPreview url={localPreviewUrl || photoUrl} className="h-48" />
                </div>
              )}
              {form.ai_confidence != null && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${form.ai_confidence >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <span>✨ AI extracted · {form.ai_confidence}% confidence</span>
                  {Array.isArray(form.ai_missing_fields) && form.ai_missing_fields.length > 0 && (
                    <span className="ml-auto">Missing: {form.ai_missing_fields.join(', ')}</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div className="col-span-2">
                  <Label className="text-xs">Supplier Name</Label>
                  <Input className="mt-1" value={form.supplier_name} onChange={e => updateField('supplier_name', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Supplier TIN</Label>
                  <Input className="mt-1" value={form.supplier_tin} onChange={e => updateField('supplier_tin', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Receipt #</Label>
                  <Input className="mt-1" value={form.receipt_number} onChange={e => updateField('receipt_number', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={form.receipt_date} onChange={e => updateField('receipt_date', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Payment Method</Label>
                  <MobileSelect
                    value={form.payment_method}
                    onValueChange={v => updateField('payment_method', v)}
                    placeholder="Select"
                    triggerClassName="mt-1"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
                  </MobileSelect>
                </div>
                <div>
                  <Label className="text-xs">Subtotal (FJ$)</Label>
                  <Input className="mt-1" type="number" step="0.01" value={form.subtotal} onChange={e => updateField('subtotal', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">VAT Rate (%)</Label>
                  <Input className="mt-1" type="number" step="0.1" value={form.vat_rate} onChange={e => updateField('vat_rate', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">VAT Amount (FJ$)</Label>
                  <Input className="mt-1" type="number" step="0.01" value={form.vat_amount} onChange={e => updateField('vat_amount', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Total (FJ$)</Label>
                  <Input className="mt-1" type="number" step="0.01" value={form.total_amount} onChange={e => updateField('total_amount', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Category</Label>
                  <MobileSelect
                    value={form.category}
                    onValueChange={v => updateField('category', v)}
                    placeholder="Select category"
                    triggerClassName="mt-1"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{formatLabel(c)}</option>)}
                  </MobileSelect>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => updateField('notes', e.target.value)} />
                </div>
              </div>
            </div>
            {/* Fixed footer — always visible */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-background">
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2 ds-btn-primary h-12 text-base">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Receipt'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}