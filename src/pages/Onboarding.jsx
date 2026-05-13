import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Onboarding({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', tin: '', phone: '', email: '', address: '',
    vat_registered: false, vat_rate: 12.5
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const company = await base44.entities.Company.create({
        ...form,
        owner_email: user.email
      });
      await base44.entities.TeamMember.create({
        company_id: company.id,
        user_email: user.email,
        user_name: user.full_name,
        role: 'owner',
        status: 'active'
      });
      toast.success('Company created! Bula!');
      onComplete();
    } catch (err) {
      toast.error('Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 md:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary">BULA AUDIT</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your company to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Fiji Fresh Produce Ltd" />
          </div>
          <div>
            <Label>TIN (Tax Identification Number)</Label>
            <Input value={form.tin} onChange={e => update('tin', e.target.value)} placeholder="e.g. 50-12345-0-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+679" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="info@company.fj" />
            </div>
          </div>
          <div>
            <Label>Business Address</Label>
            <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Suva, Fiji" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm">VAT Registered</Label>
              <p className="text-xs text-muted-foreground">Is your business registered for VAT?</p>
            </div>
            <Switch checked={form.vat_registered} onCheckedChange={v => update('vat_registered', v)} />
          </div>
          {form.vat_registered && (
            <div>
              <Label>Default VAT Rate (%)</Label>
              <Input type="number" step="0.1" value={form.vat_rate} onChange={e => update('vat_rate', e.target.value)} />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Creating...' : 'Create Company'}
          </Button>
        </form>
      </Card>
    </div>
  );
}