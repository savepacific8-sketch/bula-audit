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
  CheckCircle2, RotateCcw, Sparkles, AlertTriangle, RefreshCw, Info,
  Sun, Eye, Crop, Wind
} from 'lucide-react';
import { toast } from 'sonner';
import { extractReceiptData } from '@/lib/extractReceipt';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];
const formatLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const EMPTY_FORM = {
  supplier_name: '', supplier_tin: '', receipt_number: '',
  receipt_date: '', currency: 'FJD', subtotal: '', vat_rate: '',
  vat_amount: '', total_amount: '', payment_method: '', category: '',
  notes: '', item_lines: [], ai_confidence: null, ai_missing_fields: [],
  field_confidence: {}, validation_issues: [], image_quality_issues: [], needs_review: false,
};

// Returns a color class based on field confidence score
function fieldBorderClass(score) {
  if (score == null) return '';
  if (score < 60) return 'border-red-400 bg-red-50';
  if (score < 80) return 'border-amber-400 bg-amber-50';
  return '';
}

export default function UploadReceipt() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [step, setStep] = useState('capture');
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, vat_rate: company?.vat_rate || 12.5 });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size — warn if very small (likely low quality)
    if (file.size < 50 * 1024) {
      toast.warning('Image appears very small. For best results, use a higher quality photo.');
    }

    // Load image to check basic dimensions
    const objectUrl = URL.createObjectURL(file);
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 400 || img.height < 400) {
          toast.warning('Image resolution is low. Try capturing from closer or in better light.');
        }
        resolve();
      };
      img.onerror = resolve;
      img.src = objectUrl;
    });

    setPreviewSrc(objectUrl);
    setStep('preview');
    setUploading(true);
    try {
      // Upload the original file without resizing or compression
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch {
      toast.error('Failed to upload photo. Please try again.');
      setStep('capture');
    } finally {
      setUploading(false);
    }
  };

  const runExtraction = async () => {
    if (!photoUrl) { toast.error('Still uploading, please wait...'); return; }
    setStep('extract');
    setExtracting(true);
    try {
      const result = await extractReceiptData(photoUrl);
      setForm(prev => ({
        ...prev,
        supplier_name:        result.supplier_name        || '',
        supplier_tin:         result.supplier_tin         || '',
        receipt_number:       result.receipt_number       || '',
        receipt_date:         result.receipt_date         || '',
        currency:             result.currency             || 'FJD',
        subtotal:             result.subtotal             ?? '',
        vat_rate:             result.vat_rate             ?? (company?.vat_rate || 12.5),
        vat_amount:           result.vat_amount           ?? '',
        total_amount:         result.total_amount         ?? '',
        payment_method:       result.payment_method       || '',
        category:             result.category             || '',
        item_lines:           result.item_lines           || [],
        ai_confidence:        result.ai_confidence        ?? null,
        ai_missing_fields:    result.ai_missing_fields    || [],
        field_confidence:     result.field_confidence     || {},
        validation_issues:    result.validation_issues    || [],
        image_quality_issues: result.image_quality_issues || [],
        needs_review:         result.needs_review         ?? false,
      }));
      if (result.needs_review) {
        toast.warning('Receipt flagged for review — check highlighted fields.');
      } else {
        toast.success('Receipt data extracted!');
      }
    } catch {
      toast.error('Could not auto-extract. Please fill in manually.');
    } finally {
      setExtracting(false);
      setStep('review');
    }
  };

  const handleExtract = () => runExtraction();
  const handleRescan = () => runExtraction();

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
        company_id:           company.id,
        photo_url:            photoUrl,
        supplier_name:        form.supplier_name    || undefined,
        supplier_tin:         form.supplier_tin     || undefined,
        receipt_number:       form.receipt_number   || undefined,
        receipt_date:         form.receipt_date     || undefined,
        currency:             form.currency         || 'FJD',
        subtotal:             form.subtotal         !== '' ? Number(form.subtotal) : undefined,
        vat_rate:             form.vat_rate         !== '' ? Number(form.vat_rate) : undefined,
        vat_amount:           form.vat_amount       !== '' ? Number(form.vat_amount) : undefined,
        total_amount:         form.total_amount     !== '' ? Number(form.total_amount) : undefined,
        payment_method:       form.payment_method   || undefined,
        category:             form.category         || undefined,
        notes:                form.notes            || undefined,
        item_lines:           form.item_lines?.length ? form.item_lines : undefined,
        ai_confidence:        form.ai_confidence    ?? undefined,
        ai_missing_fields:    form.ai_missing_fields?.length ? form.ai_missing_fields : undefined,
        status:               'pending',
        uploaded_by:          user.email,
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
        <div className="flex-1 flex flex-col gap-4 max-w-sm mx-auto w-full py-2">
          <p className="text-muted-foreground text-sm text-center">
            Take a photo or choose one from your gallery
          </p>

          {/* Photo tips */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm mb-1">
              <Info className="w-4 h-4" /> Tips for best results
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Sun,  text: 'Good lighting, no shadows' },
                { icon: Eye,  text: 'All corners visible' },
                { icon: Crop, text: 'Capture the full receipt' },
                { icon: Wind, text: 'Flat surface, no blur' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-1.5 text-xs text-blue-700">
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <label className="w-full cursor-pointer">
            <div className="flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-2xl px-6 py-5 text-base font-semibold shadow-lg hover:bg-primary/90 transition-colors">
              <Camera className="w-6 h-6" /> Use Camera
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </label>
          <label className="w-full cursor-pointer">
            <div className="flex items-center justify-center gap-3 bg-secondary text-secondary-foreground rounded-2xl px-6 py-5 text-base font-semibold hover:bg-secondary/80 transition-colors border border-border">
              <ImagePlus className="w-6 h-6" /> Choose from Gallery
            </div>
            <input ref={galleryInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
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
          <Button variant="ghost" size="icon" onClick={reset}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">Preview</h1>
        </div>
        <div className="flex-1 rounded-2xl overflow-hidden border border-border bg-muted mb-4 min-h-64">
          <img src={previewSrc} alt="Receipt preview" className="w-full h-full object-contain max-h-[60vh]" />
        </div>
        <div className="space-y-3">
          <Button onClick={handleExtract} disabled={uploading} className="w-full gap-2 py-5 text-base">
            {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</> : <><Sparkles className="w-5 h-5" /> Extract with AI</>}
          </Button>
          <Button variant="outline" onClick={() => setStep('review')} disabled={uploading} className="w-full gap-2">
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
        <p className="text-lg font-semibold">Analysing receipt...</p>
        <div className="space-y-2 text-sm text-muted-foreground text-center max-w-xs">
          <p>Step 1: Extracting all fields from the image</p>
          <p>Step 2: Validating numbers against the receipt</p>
        </div>
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
          <Button onClick={reset} className="w-full gap-2"><Camera className="w-4 h-4" /> Upload Another</Button>
          <Button variant="outline" onClick={() => navigate('/receipts')} className="w-full gap-2">View All Receipts</Button>
        </div>
      </div>
    );
  }

  // ── REVIEW STEP ──────────────────────────────────────────────────
  const fc = form.field_confidence || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep('preview')}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-xl font-bold">Review & Save</h1>
      </div>

      {/* Thumbnail */}
      {previewSrc && (
        <div className="rounded-xl overflow-hidden border border-border h-28 bg-muted">
          <img src={previewSrc} alt="Receipt" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Image quality warning */}
      {form.image_quality_issues?.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 flex gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Image quality issues detected: </span>
            {form.image_quality_issues.join(', ')}.
            <span className="ml-1">For better accuracy, retake the photo in better lighting.</span>
          </div>
        </div>
      )}

      {/* Validation warnings */}
      {form.validation_issues?.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-300 p-3 flex gap-2 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Number validation failed: </span>
            {form.validation_issues.map(i => i.replace(/_/g, ' ')).join(', ')}.
            <span className="ml-1">Please verify the highlighted fields below.</span>
          </div>
        </div>
      )}

      {/* Needs review + AI confidence */}
      {form.ai_confidence != null && (
        <div className={`rounded-xl p-3 flex items-center justify-between border text-sm ${
          form.needs_review ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-muted/60 border-border text-muted-foreground'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>AI confidence: <strong>{form.ai_confidence}%</strong></span>
            {form.needs_review && <span className="font-semibold ml-1">— Needs Review</span>}
          </div>
          {photoUrl && (
            <Button size="sm" variant="outline" onClick={handleRescan} disabled={extracting} className="gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Re-scan
            </Button>
          )}
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Supplier Name {fc.supplier_name < 60 && <span className="text-red-500 ml-1">⚠ Low confidence</span>}</Label>
          <Input className={`mt-1 ${fieldBorderClass(fc.supplier_name)}`} value={form.supplier_name} onChange={e => updateField('supplier_name', e.target.value)} placeholder="Supplier name" />
        </div>
        <div>
          <Label className="text-xs">Supplier TIN</Label>
          <Input className="mt-1" value={form.supplier_tin} onChange={e => updateField('supplier_tin', e.target.value)} placeholder="TIN" />
        </div>
        <div>
          <Label className="text-xs">Receipt # {fc.receipt_number < 60 && <span className="text-red-500 ml-1">⚠</span>}</Label>
          <Input className={`mt-1 ${fieldBorderClass(fc.receipt_number)}`} value={form.receipt_number} onChange={e => updateField('receipt_number', e.target.value)} placeholder="Ref number" />
        </div>
        <div>
          <Label className="text-xs">Date {fc.receipt_date < 60 && <span className="text-red-500 ml-1">⚠</span>}</Label>
          <Input className={`mt-1 ${fieldBorderClass(fc.receipt_date)}`} type="date" value={form.receipt_date} onChange={e => updateField('receipt_date', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Payment Method {fc.payment_method < 60 && <span className="text-red-500 ml-1">⚠</span>}</Label>
          <Select value={form.payment_method} onValueChange={v => updateField('payment_method', v)}>
            <SelectTrigger className={`mt-1 ${fieldBorderClass(fc.payment_method)}`}><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{formatLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Monetary fields — highlight if validation issues */}
        {(() => {
          const hasMismatch = form.validation_issues?.includes('totals_mismatch');
          const subtotalFlag = fc.subtotal < 60 || (hasMismatch && form.subtotal);
          const vatFlag = fc.vat_amount < 60 || (hasMismatch && form.vat_amount);
          const totalFlag = fc.total_amount < 60 || (hasMismatch && form.total_amount);
          return (
            <>
              <div>
                <Label className="text-xs">Subtotal (FJ$) {subtotalFlag && <span className="text-red-500 ml-1">⚠</span>}</Label>
                <Input className={`mt-1 ${subtotalFlag ? 'border-red-400 bg-red-50' : ''}`} type="number" step="0.01" value={form.subtotal} onChange={e => updateField('subtotal', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">VAT Rate (%)</Label>
                <Input className="mt-1" type="number" step="0.1" value={form.vat_rate} onChange={e => updateField('vat_rate', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">VAT Amount (FJ$) {vatFlag && <span className="text-red-500 ml-1">⚠</span>}</Label>
                <Input className={`mt-1 ${vatFlag ? 'border-red-400 bg-red-50' : ''}`} type="number" step="0.01" value={form.vat_amount} onChange={e => updateField('vat_amount', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Total (FJ$) {totalFlag && <span className="text-red-500 ml-1">⚠</span>}</Label>
                <Input className={`mt-1 ${totalFlag ? 'border-red-400 bg-red-50' : ''}`} type="number" step="0.01" value={form.total_amount} onChange={e => updateField('total_amount', e.target.value)} placeholder="0.00" />
              </div>
            </>
          );
        })()}

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