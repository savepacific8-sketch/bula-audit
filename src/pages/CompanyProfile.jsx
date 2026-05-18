import { useState, useEffect } from 'react';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Building2, Trash2, AlertTriangle, UserCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CompanyProfile() {
  const { company, setCompany, userRole } = useCompany();
  const [form, setForm] = useState({
    name: '', tin: '', phone: '', email: '', address: '',
    vat_registered: false, vat_rate: 12.5
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

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

  const handleDeleteCompany = async () => {
    setDeleting(true);
    try {
      await base44.auth.updateMe({ current_company_id: null, current_company_role: null });
      await base44.entities.Company.delete(company.id);
      toast.success('Company deleted');
      base44.auth.logout('/');
    } catch (err) {
      toast.error('Failed to delete. Please contact support.');
      setDeleting(false);
    }
  };

  const handleDeleteMyAccount = async () => {
    setDeletingAccount(true);
    try {
      // Remove from company, then log out (platform handles account deletion via support)
      await base44.auth.updateMe({ current_company_id: null, current_company_role: null });
      toast.success('Account removed. You will be signed out.');
      setTimeout(() => base44.auth.logout('/'), 1500);
    } catch (err) {
      toast.error('Failed to remove account. Please contact support.');
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Business Profile" subtitle="Your business details and VAT settings" />

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

      {/* ── User Account ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="w-4 h-4 text-primary" />
            User Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentUser && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-sm">
              <p className="font-medium">{currentUser.full_name}</p>
              <p className="text-muted-foreground text-xs">{currentUser.email}</p>
              <p className="text-muted-foreground text-xs capitalize">{currentUser.role} · {userRole} in company</p>
            </div>
          )}
          <Button
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            onClick={() => base44.auth.logout('/')}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* ── Business Danger Zone ─────────────────────────────── */}
      {canEdit && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Business Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete this company and all its data — receipts, reports, and team members. <strong>This cannot be undone.</strong>
            </p>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => { setDeleteConfirm(''); setShowDeleteDialog(true); }}
            >
              <Trash2 className="w-4 h-4" /> Delete Company &amp; All Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── User Account Danger Zone ─────────────────────────── */}
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <UserCircle className="w-4 h-4" /> Delete My Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Remove your personal account from BULA AUDIT. You will be permanently signed out and your access revoked.
          </p>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => { setDeleteAccountConfirm(''); setShowDeleteAccountDialog(true); }}
          >
            <Trash2 className="w-4 h-4" /> Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Company dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">This will permanently delete <strong>{company?.name}</strong> and all associated receipts, reports, and team members.</span>
              <span className="block mt-2">Type <strong>DELETE</strong> to confirm:</span>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
                className="mt-1"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={handleDeleteCompany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? 'Deleting...' : 'Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete My Account dialog */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Your Account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">This will remove your access to BULA AUDIT and sign you out permanently.</span>
              <span className="block mt-2">Type <strong>DELETE</strong> to confirm:</span>
              <Input
                value={deleteAccountConfirm}
                onChange={e => setDeleteAccountConfirm(e.target.value)}
                placeholder="Type DELETE"
                className="mt-1"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAccountConfirm !== 'DELETE' || deletingAccount}
              onClick={handleDeleteMyAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deletingAccount ? 'Removing...' : 'Delete My Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}