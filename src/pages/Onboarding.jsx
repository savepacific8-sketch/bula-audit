import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MobileSelect } from '@/components/ui/MobileSelect';
import { Loader2, Building2, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
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

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    tin: '',
    business_type: '',
    address: '',
    phone: '',
    email: '',
    vat_registered: false,
    vat_rate: 12.5,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validateStep = () => {
    if (step === 1 && !form.name.trim()) {
      toast.error('Company name is required');
      return false;
    }
    return true;
  };

  const next = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const back = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const company = await base44.entities.Company.create({
        name: form.name,
        tin: form.tin || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        vat_registered: form.vat_registered,
        vat_rate: Number(form.vat_rate) || 12.5,
        owner_email: user.email,
      });
      await base44.entities.TeamMember.create({
        company_id: company.id,
        user_email: user.email,
        user_name: user.full_name,
        role: 'owner',
        status: 'active',
      });
      // Create a 14-day free trial subscription
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await base44.entities.Subscription.create({
        company_id: company.id,
        plan: 'free_trial',
        billing_cycle: 'monthly',
        status: 'trial',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: trialEnd.toISOString().slice(0, 10),
      });
      toast.success('Bula! Your company is ready 🎉');
      onComplete();
    } catch {
      toast.error('Failed to create company. Please try again.');
    } finally {
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
                  className="mt-1"
                />
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
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.vat_rate}
                  onChange={e => update('vat_rate', e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Standard Fiji VAT is 15% (was 12.5% before 2023)</p>
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

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
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