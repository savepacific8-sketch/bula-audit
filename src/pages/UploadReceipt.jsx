import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Camera, ImagePlus, Loader2, Upload, ArrowLeft,
  CheckCircle2, RotateCcw, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

const formatLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const EMPTY_FORM = {
  supplier_name: '', supplier_tin: '', receipt_number: '',
  receipt_date: '', subtotal: '', vat_rate: '',
  vat_amount: '', total_amount: '', payment_method: '', category: '', notes: ''
};

export default function UploadReceipt() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [step, setStep] = useState('capture'); // capture | preview | extract | review | done
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, vat_rate: company?.vat_rate || 12.5 });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);
    setStep('preview');
    // Upload in background
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch {
      toast.error('Failed to upload photo. Please try again.');
      setStep('capture');
    } finally {
      setUploading(false);
    }
  };

  const handleExtract = async () => {
    if (!photoUrl) { toast.error('Still uploading, please wait...'); return; }
    setStep('extract');
    setExtracting(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract the following from this receipt image. If a field is not found, leave it blank. Return values in Fiji Dollars (FJD). For the date, use YYYY-MM-DD format. For category, pick the best match from: ${CATEGORIES.join(', ')}. For payment_method pick from: ${PAYMENT_METHODS.join(', ')}.`,
        file_urls: [photoUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            supplier_name: { type: 'string' },
            supplier_tin: { type: 'string' },
            receipt_number: { type: 'string' },
            receipt_date: { type: 'string' },
            subtotal: { type: 'number' },
            vat_rate: { type: 'number' },
            vat_amount: { type: 'number' },
            total_amount: { type: 'number' },
            payment_method: { type: 'string' },
            category: { type: 'string' }
          }
        }
      });
      setForm(prev => ({
        ...prev,
        supplier_name: result.supplier_name || '',
        supplier_tin: result.supplier_tin || '',
        receipt_number: result.receipt_number || '',
        receipt_date: result.receipt_date || '',
        subtotal: result.subtotal || '',
        vat_rate: result.vat_rate || company?.vat_rate || 12.5,
        vat_amount: result.vat_amount || '',
        total_amount: result.total_amount || '',
        payment_method: result.payment_method || '',
        category: result.category || '',
      }));
      toast.success('Receipt data extracted!');
    } catch {
      toast.error('Could not auto-extract. Please fill in manually.');
    } finally {
      setExtracting(false);
      setStep('review');
    }
  };

  const updateField = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Receipt.create({
        company_id: company.id,
        photo_url: photoUrl,
        supplier_name: form.supplier_name || undefined,
        supplier_tin: form.supplier_tin || undefined,
        receipt_number: form.receipt_number || undefined,
        receipt_date: form.receipt_date || undefined,
        subtotal: form.subtotal ? Number(form.subtotal) : undefined,
        vat_rate: form.vat_rate ? Number(form.vat_rate) : undefined,
        vat_amount: form.vat_amount ? Number(form.vat_amount) : undefined,
        total_amount: form.total_amount ? Number(form.total_amount) : undefined,
        payment_method: form.payment_method || undefined,
        category: form.category || undefined,
        notes: form.notes || undefined,
        status: 'pending',
        uploaded_by: user.email,
      });
      setStep('done');
    } catch {
      toast.error('Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('capture');
    setPhotoUrl('');
    setPreviewSrc('');
    setForm({ ...EMPTY_FORM, vat_rate: company?.vat_rate || 12.5 });
  };

  // ── CAPTURE STEP ──────────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <div className="min-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/receipts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Upload Receipt</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-sm mx-auto w-full">
          <p className="text-muted-foreground text-sm text-center mb-2">
            Take a photo or choose one from your gallery
          </p>

          {/* Camera button */}
          <label className="w-full cursor-pointer">
            <div className="flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-2xl px-6 py-5 text-base font-semibold shadow-lg hover:bg-primary/90 transition-colors">
              <Camera className="w-6 h-6" />
              Use Camera
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
          </label>

          {/* Gallery button */}
          <label className="w-full cursor-pointer">
            <div className="flex items-center justify-center gap-3 bg-secondary text-secondary-foreground rounded-2xl px-6 py-5 text-base font-semibold hover:bg-secondary/80 transition-colors border border-border">
              <ImagePlus className="w-6 h-6" />
              Choose from Gallery
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>
      </div>
    );
  }

  // ── PREVIEW STEP ──────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={reset}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Preview</h1>
        </div>

        <div className="flex-1 rounded-2xl overflow-hidden border border-border bg-muted mb-4 min-h-64">
          <img src={previewSrc} alt="Receipt preview" className="w-full h-full object-contain max-h-[60vh]" />
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleExtract}
            disabled={uploading}
            className="w-full gap-2 py-5 text-base"
          >
            {uploading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Extract with AI</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setStep('review')}
            disabled={uploading}
            className="w-full gap-2"
          >
            <Upload className="w-4 h-4" /> Fill in Manually
          </Button>
          <Button variant="ghost" onClick={reset} className="w-full gap-2 text-muted-foreground">
            <RotateCcw className="w-4 h-4" /> Retake
          </Button>
        </div>
      </div>
    );
  }

  // ── EXTRACT STEP ──────────────────────────────────────────────────
  if (step === 'extract') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <p className="text-lg font-semibold">Reading receipt...</p>
        <p className="text-sm text-muted-foreground">AI is extracting your receipt data</p>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── DONE STEP ──────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Receipt Saved!</h2>
          <p className="text-sm text-muted-foreground mt-1">Submitted for review with status <strong>Pending</strong></p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={reset} className="w-full gap-2">
            <Camera className="w-4 h-4" /> Upload Another
          </Button>
          <Button variant="outline" onClick={() => navigate('/receipts')} className="w-full gap-2">
            View All Receipts
          </Button>
        </div>
      </div>
    );
  }

  // ── REVIEW STEP ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep('preview')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Review & Save</h1>
      </div>

      {/* Thumbnail */}
      {previewSrc && (
        <div className="rounded-xl overflow-hidden border border-border h-28 bg-muted">
          <img src={previewSrc} alt="Receipt" className="w-full h-full object-contain" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Supplier Name</Label>
          <Input className="mt-1" value={form.supplier_name} onChange={e => updateField('supplier_name', e.target.value)} placeholder="Supplier name" />
        </div>
        <div>
          <Label className="text-xs">Supplier TIN</Label>
          <Input className="mt-1" value={form.supplier_tin} onChange={e => updateField('supplier_tin', e.target.value)} placeholder="TIN" />
        </div>
        <div>
          <Label className="text-xs">Receipt #</Label>
          <Input className="mt-1" value={form.receipt_number} onChange={e => updateField('receipt_number', e.target.value)} placeholder="Ref number" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input className="mt-1" type="date" value={form.receipt_date} onChange={e => updateField('receipt_date', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Payment Method</Label>
          <Select value={form.payment_method} onValueChange={v => updateField('payment_method', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{formatLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Subtotal (FJ$)</Label>
          <Input className="mt-1" type="number" step="0.01" value={form.subtotal} onChange={e => updateField('subtotal', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">VAT Rate (%)</Label>
          <Input className="mt-1" type="number" step="0.1" value={form.vat_rate} onChange={e => updateField('vat_rate', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">VAT Amount (FJ$)</Label>
          <Input className="mt-1" type="number" step="0.01" value={form.vat_amount} onChange={e => updateField('vat_amount', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">Total (FJ$)</Label>
          <Input className="mt-1" type="number" step="0.01" value={form.total_amount} onChange={e => updateField('total_amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Category</Label>
          <Select value={form.category} onValueChange={v => updateField('category', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{formatLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Notes</Label>
          <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Optional notes" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || uploading} className="w-full gap-2 py-5 text-base">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        {saving ? 'Saving...' : uploading ? 'Still uploading...' : 'Save Receipt'}
      </Button>
    </div>
  );
}