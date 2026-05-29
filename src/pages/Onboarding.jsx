import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MobileSelect } from '@/components/ui/MobileSelect';
import { Loader2, Building2, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';

const BUSINESS_TYPES = [
  { value: 'sole_trader', label: 'Sole Trader' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'ngo', label: 'NGO / Charity' },
  { value: 'government', label: 'Government Entity' },
  { value: 'other', label: 'Other' },
];

const STEPS = [
  { id: 1, title: 'Business Identity', desc: 'Tell us about your business' },
  { id: 2, title: 'Contact Details', desc: 'How can people reach you?' },
  { id: 3, title: 'Tax & VAT', desc: 'Set up your tax settings' },
];

// Individual creation steps shown during submission
const CREATION_STEPS = [
{ key: 'auth',    label: 'Verifying your account' },
{ key: 'company', label: 'Creating company record' },
{ key: 'member',  label: 'Assigning you as owner' },
{ key: 'user',    label: 'Updating your profile' },
{ key: 'trial',   label: 'Activating Free Plan (500 uploads)' },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState(null);
  const [creationProgress, setCreationProgress] = useState(null); // null | { stepKey, done: [] }

  const [form, setForm] = useState({
    name: '',
    tin: '',
    business_type: '',
    address: '',
    phone: '',
    email: '',
    vat_registered: false,
    vat_rate: '12.5',
  });

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: null }));
  };

  const validateStep = () => {
    const errors = {};
    if (step === 1 && !form.name.trim()) {
      errors.name = 'Company name is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const back = () => {
    setFieldErrors({});
    setStep(s => s - 1);
  };

  const markStep = (key) => {
    setCreationProgress(prev => ({
      stepKey: key,
      done: prev ? prev.done : [],
    }));
  };

  const completeStep = (key) => {
    setCreationProgress(prev => ({
      stepKey: null,
      done: [...(prev?.done || []), key],
    }));
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setFieldErrors({});

    // Final validation before submitting
    if (!form.name.trim()) {
      setFieldErrors({ name: 'Company name is required' });
      setStep(1);
      toast.error('Please enter your company name first');
      return;
    }

    setLoading(true);
    setCreationProgress({ stepKey: null, done: [] });

    let company = null;

    try {
      // Step 1: verify auth
      markStep('auth');
      const user = await base44.auth.me();
      if (!user) throw new Error('You are not logged in. Please refresh the page and try again.');
      completeStep('auth');

      // Step 2: create company
      markStep('company');
      try {
        company = await base44.entities.Company.create({
          name: form.name.trim(),
          tin: form.tin.trim() || undefined,
          business_type: form.business_type || undefined,
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          vat_registered: form.vat_registered,
          vat_rate: Number(form.vat_rate) || 12.5,
          owner_email: user.email,
        });
      } catch (err) {
        const detail = err?.response?.data?.message || err?.message || 'Unknown error';
        throw new Error(`Failed to create company record: ${detail}`);
      }
      completeStep('company');

      // Step 3: create team member
      markStep('member');
      try {
        await base44.entities.TeamMember.create({
          company_id: company.id,
          user_email: user.email,
          user_name: user.full_name || user.email,
          role: 'owner',
          status: 'active',
        });
      } catch (err) {
        const detail = err?.response?.data?.message || err?.message || 'Unknown error';
        throw new Error(`Company was created but failed to assign you as owner: ${detail}`);
      }
      completeStep('member');

      // Step 4: update user profile with company context
      markStep('user');
      try {
        await base44.auth.updateMe({
          current_company_id: company.id,
          current_company_role: 'owner',
        });
      } catch (err) {
        // Non-fatal: log but continue
        console.warn('Could not update user profile with company context:', err?.message);
      }
      completeStep('user');

      // Step 5: create free plan subscription (500 receipts, no expiry)
      markStep('trial');
      try {
        await base44.entities.Subscription.create({
          company_id: company.id,
          plan: 'free',
          billing_cycle: 'monthly',
          status: 'trial',
          start_date: new Date().toISOString().slice(0, 10),
        });
      } catch (err) {
        // Non-fatal: can be set up manually
        console.warn('Could not create free plan subscription:', err?.message);
      }
      completeStep('trial');

      toast.success('Bula! Company created. Free Plan activated — 500 receipt uploads included 🎉');
      // Small delay so user sees all steps completed
      setTimeout(() => onComplete(), 600);

    } catch (err) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
      setCreationProgress(null);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 shadow-sm">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">BULA AUDIT</h1>
          <p className="text-muted-foreground mt-1 text-sm">Smart accounting for Fijian businesses</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all ${
                step > s.id ? 'bg-primary text-primary-foreground' :
                step === s.id ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-secondary text-muted-foreground'
              }`}>
                {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 rounded ${step > s.id ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{STEPS[step - 1].title}</h2>
            <p className="text-sm text-muted-foreground">{STEPS[step - 1].desc}</p>
            {step === 2 && (
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                Optional - you can fill these in later from Company Profile.
              </p>
            )}
            {step === 3 && (
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                Used as the default for new receipts. You can override on each receipt.
              </p>
            )}
          </div>

          {/* Step 1: Business Identity */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Company Name <span className="text-destructive">*</span></Label>
                <Input
                  autoFocus
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g. Fiji Fresh Produce Ltd"
                  className={`mt-1 ${fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.name}
                  </p>
                )}
              </div>
              <div>
                <Label>TIN (Tax Identification Number)</Label>
                <Input
                  value={form.tin}
                  onChange={e => update('tin', e.target.value)}
                  placeholder="e.g. 50-12345-0-1"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Issued by the Fiji Revenue & Customs Service</p>
              </div>
              <div>
                <Label>Business Type</Label>
                <MobileSelect
                  value={form.business_type}
                  onValueChange={v => update('business_type', v)}
                  placeholder="Select business type"
                  triggerClassName="mt-1 w-full"
                >
                  {BUSINESS_TYPES.map(bt => (
                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                  ))}
                </MobileSelect>
              </div>
              <div>
                <Label>Business Address</Label>
                <Input
                  value={form.address}
                  onChange={e => update('address', e.target.value)}
                  placeholder="e.g. 12 Victoria Parade, Suva"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  autoFocus
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  placeholder="+679 330 0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Business Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="info@mycompany.com.fj"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 3: Tax & VAT */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/30">
                <div>
                  <p className="font-medium text-sm">VAT Registered</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Is your business registered for VAT with FRCS?</p>
                </div>
                <Switch checked={form.vat_registered} onCheckedChange={v => update('vat_registered', v)} />
              </div>
              <div>
                <Label>Default VAT Rate (%)</Label>
                <MobileSelect
                  value={String(form.vat_rate)}
                  onValueChange={v => update('vat_rate', v)}
                  placeholder="Select VAT rate"
                  triggerClassName="mt-1 w-full"
                >
                  <option value="12.5">12.5%  - Current standard rate (Aug 2025 onwards)</option>
                  <option value="15">15%   - Aug 2023 to Jul 2025</option>
                  <option value="9">9%    - Before Aug 2023</option>
                  <option value="0">0%    - Zero-rated / exempt</option>
                </MobileSelect>
                <p className="text-xs text-muted-foreground mt-1">
                  The current standard Fiji VAT rate is 12.5% (effective Aug 2025).
                  You can override this on individual receipts.
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-border p-4 bg-primary/5 space-y-1.5">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Summary</p>
                <SummaryRow label="Company" value={form.name} />
                {form.tin && <SummaryRow label="TIN" value={form.tin} />}
                {form.business_type && <SummaryRow label="Type" value={BUSINESS_TYPES.find(b => b.value === form.business_type)?.label} />}
                {form.address && <SummaryRow label="Address" value={form.address} />}
                {form.phone && <SummaryRow label="Phone" value={form.phone} />}
                {form.email && <SummaryRow label="Email" value={form.email} />}
                <SummaryRow label="VAT" value={form.vat_registered ? `Registered (${form.vat_rate}%)` : 'Not registered'} />
              </div>
            </div>
          )}

          {/* Creation progress panel */}
          {creationProgress !== null && (
            <div className="mt-5 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Setting up your company...</p>
              {CREATION_STEPS.map(cs => {
                const isDone = creationProgress.done.includes(cs.key);
                const isActive = creationProgress.stepKey === cs.key;
                return (
                  <div key={cs.key} className="flex items-center gap-2 text-sm">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={isDone ? 'text-foreground' : isActive ? 'text-primary font-medium' : 'text-muted-foreground'}>
                      {cs.label}
                    </span>
                    {isDone && <span className="text-xs text-emerald-600 ml-auto">Done</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && !loading && (
              <Button variant="outline" onClick={back} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            {step < STEPS.length ? (
              <Button onClick={next} className="flex-1 gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {loading ? 'Creating company...' : 'Create Company'}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update these details later in Company Profile
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}