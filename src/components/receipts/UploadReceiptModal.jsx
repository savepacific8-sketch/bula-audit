import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractReceiptData } from '@/lib/extractReceipt';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

export default function UploadReceiptModal({ open, onClose, onSuccess }) {
  const { company } = useCompany();
  const [step, setStep] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    supplier_name: '', supplier_tin: '', receipt_number: '',
    receipt_date: '', currency: 'FJD', subtotal: '', vat_rate: company?.vat_rate || 12.5,
    vat_amount: '', total_amount: '', payment_method: '', category: '', notes: '',
    item_lines: [], ai_confidence: null, ai_missing_fields: []
  });

  const processFile = useCallback(async (file) => {
    if (!file) return;
    // Reset input so iOS fires onChange again if same photo is reselected
    setFileInputKey(k => k + 1);
    setUploading(true);
    setStep('extract');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
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
          subtotal:          result.subtotal         ?? '',
          vat_rate:          result.vat_rate         ?? company?.vat_rate ?? 12.5,
          vat_amount:        result.vat_amount       ?? '',
          total_amount:      result.total_amount     ?? '',
          payment_method:    result.payment_method   || '',
          category:          result.category         || '',
          item_lines:        result.item_lines       || [],
          ai_confidence:     result.ai_confidence    ?? null,
          ai_missing_fields: result.ai_missing_fields || [],
        }));
        toast.success('Receipt data extracted!');
      } catch {
        toast.error('Could not auto-extract. Please fill in manually.');
      } finally {
        setExtracting(false);
        setStep('review');
      }
    } catch (err) {
      toast.error('Failed to upload photo');
      setStep('upload');
    } finally {
      setUploading(false);
    }
  }, [company]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Receipt.create({
        company_id:       company.id,
        photo_url:        photoUrl,
        supplier_name:    form.supplier_name    || undefined,
        supplier_tin:     form.supplier_tin     || undefined,
        receipt_number:   form.receipt_number   || undefined,
        receipt_date:     form.receipt_date     || undefined,
        currency:         form.currency         || 'FJD',
        subtotal:         form.subtotal         ? Number(form.subtotal) : undefined,
        vat_rate:         form.vat_rate         ? Number(form.vat_rate) : undefined,
        vat_amount:       form.vat_amount       ? Number(form.vat_amount) : undefined,
        total_amount:     form.total_amount     ? Number(form.total_amount) : undefined,
        payment_method:   form.payment_method   || undefined,
        category:         form.category         || undefined,
        notes:            form.notes            || undefined,
        item_lines:       form.item_lines?.length ? form.item_lines : undefined,
        ai_confidence:    form.ai_confidence    ?? undefined,
        ai_missing_fields: form.ai_missing_fields?.length ? form.ai_missing_fields : undefined,
        status:           'pending',
        uploaded_by:      user.email,
      });
      toast.success('Receipt saved!');
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error('Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
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
      key={fileInputKey}
      ref={fileInputRef}
      type="file"
      accept="image/*,application/pdf"
      style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0 }}
      onChange={handleFileChange}
    />

    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Upload Receipt'}
            {step === 'extract' && 'Scanning Receipt…'}
            {step === 'review' && 'Review & Save'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handlePickFile}
              className="w-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 active:border-primary transition-colors bg-transparent"
            >
              <Camera className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Take a photo or choose a file</p>
              <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, PDF</p>
            </button>
          </div>
        )}

        {step === 'extract' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {uploading ? 'Uploading photo…' : 'Scanning with AI…'}
            </p>
            <p className="text-xs text-muted-foreground">
              {uploading ? 'Please wait' : 'Extracting receipt details, this takes a few seconds'}
            </p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            {photoUrl && (
              <div className="rounded-lg overflow-hidden border border-border h-24">
                <img src={photoUrl} alt="Receipt" className="w-full h-full object-contain bg-muted" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Supplier Name</Label>
                <Input value={form.supplier_name} onChange={e => updateField('supplier_name', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Supplier TIN</Label>
                <Input value={form.supplier_tin} onChange={e => updateField('supplier_tin', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Receipt #</Label>
                <Input value={form.receipt_number} onChange={e => updateField('receipt_number', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.receipt_date} onChange={e => updateField('receipt_date', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v => updateField('payment_method', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{formatLabel(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subtotal (FJ$)</Label>
                <Input type="number" step="0.01" value={form.subtotal} onChange={e => updateField('subtotal', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">VAT Rate (%)</Label>
                <Input type="number" step="0.1" value={form.vat_rate} onChange={e => updateField('vat_rate', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">VAT Amount (FJ$)</Label>
                <Input type="number" step="0.01" value={form.vat_amount} onChange={e => updateField('vat_amount', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Total (FJ$)</Label>
                <Input type="number" step="0.01" value={form.total_amount} onChange={e => updateField('total_amount', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => updateField('category', v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{formatLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={e => updateField('notes', e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Receipt'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}