import { useState, useEffect } from 'react';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';

export default function CompanyProfile() {
  const { company, setCompany, userRole } = useCompany();
  const [form, setForm] = useState({
    name: '', tin: '', phone: '', email: '', address: '',
    vat_registered: false, vat_rate: 12.5
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        tin: company.tin || '',
        phone: company.phone || '',
        email: company.email || '',
        address: company.address || '',
        vat_registered: company.vat_registered || false,
        vat_rate: company.vat_rate || 12.5,
      });
    }
  }, [company]);

  const canEdit = userRole === 'owner' || userRole === 'manager';

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await base44.entities.Company.update(company.id, {
        name: form.name,
        tin: form.tin,
        phone: form.phone,
        email: form.email,
        address: form.address,
        vat_registered: form.vat_registered,
        vat_rate: Number(form.vat_rate),
      });
      setCompany(updated);
      toast.success('Company updated');
    } catch (err) {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <PageHeader title="Company Profile" subtitle="Your business details and VAT settings" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-primary" />
            Business Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={e => update('name', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>TIN (Tax Identification Number)</Label>
            <Input value={form.tin} onChange={e => update('tin', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label>Business Address</Label>
            <Input value={form.address} onChange={e => update('address', e.target.value)} disabled={!canEdit} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">VAT Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">VAT Registered</Label>
              <p className="text-xs text-muted-foreground">Is your business VAT registered?</p>
            </div>
            <Switch checked={form.vat_registered} onCheckedChange={v => update('vat_registered', v)} disabled={!canEdit} />
          </div>
          {form.vat_registered && (
            <div>
              <Label>Default VAT Rate (%)</Label>
              <Input type="number" step="0.1" value={form.vat_rate} onChange={e => update('vat_rate', e.target.value)} disabled={!canEdit} />
              <p className="text-xs text-muted-foreground mt-1">Fiji standard VAT rate is 12.5%</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      )}
    </div>
  );
}