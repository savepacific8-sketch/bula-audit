import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect } from '@/components/ui/MobileSelect';
import { Upload, Loader2, CheckCircle2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/billing';

export default function UploadPaymentProof({ subscription, planRequested, cycleRequested, amountDue, onSuccess }) {
  const { company } = useCompany();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [method, setMethod] = useState('mpaisa');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) { toast.error('Please attach a payment proof'); return; }
    setUploading(true);
    try {
      const user = await base44.auth.me();
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.PaymentProof.create({
        company_id: company.id,
        subscription_id: subscription?.id || '',
        proof_url: file_url,
        proof_filename: file.name,
        payment_method: method,
        amount_paid: amountDue,
        payment_date: paymentDate,
        reference_number: reference || undefined,
        status: 'pending',
        submitted_by: user.email,
        plan_requested: planRequested,
        billing_cycle_requested: cycleRequested,
      });
      // Mark subscription as pending_payment
      if (subscription?.id) {
        await base44.entities.Subscription.update(subscription.id, { status: 'pending_payment' });
      }
      toast.success('Payment proof submitted! Our team will verify within 24 hours.');
      setDone(true);
      onSuccess?.();
    } catch (err) {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center py-8 gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <p className="font-semibold text-foreground">Proof Submitted!</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your payment proof is under review. We'll activate your plan within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Payment Method</Label>
        <MobileSelect
          value={method}
          onValueChange={setMethod}
          placeholder="Select method"
          triggerClassName="mt-1"
        >
          {PAYMENT_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
          ))}
        </MobileSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Payment Date</Label>
          <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Reference / Receipt #</Label>
          <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" className="mt-1" />
        </div>
      </div>

      {/* File upload */}
      <div>
        <Label className="text-xs">Payment Screenshot / Receipt</Label>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-1 w-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-5 hover:border-primary/50 transition-colors"
        >
          {preview ? (
            <img src={preview} alt="proof" className="max-h-32 rounded-lg object-contain" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-xs font-medium">Tap to upload screenshot or PDF</p>
            </>
          )}
        </button>
      </div>

      <Button onClick={handleSubmit} disabled={uploading || !file} className="w-full gap-2">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Submitting...' : 'Submit Payment Proof'}
      </Button>
    </div>
  );
}