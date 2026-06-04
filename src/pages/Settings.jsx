import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck, ShieldOff, Loader2, AlertCircle, CheckCircle2, Copy, KeyRound,
  MailCheck, MailWarning, User, Lock, Camera, Save,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user, checkUserAuth, logoutEverywhere } = useAuth();

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Settings"
        subtitle="Profile, security, and session settings"
      />

      <ProfileSection user={user} onUpdated={checkUserAuth} />
      <EmailVerificationSection user={user} />
      <ChangePasswordSection user={user} />
      <TwoFactorSection />
      <SessionsSection onLogoutEverywhere={logoutEverywhere} />
    </div>
  );
}

// ── Profile (name + avatar) ────────────────────────────────────────

function ProfileSection({ user, onUpdated }) {
  const [name, setName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setName(user?.full_name || '');
    setAvatarUrl(user?.avatar_url || '');
  }, [user]);

  const initial = (user?.full_name || user?.email || '?').trim()[0]?.toUpperCase() || '?';
  const changed = name !== (user?.full_name || '') || avatarUrl !== (user?.avatar_url || '');

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-pick of same file
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be 5 MB or less');
      return;
    }
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setAvatarUrl(result.file_url);
      toast.success('Avatar uploaded — click Save to apply');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: name.trim() || null,
        avatar_url: avatarUrl || null,
      });
      toast.success('Profile updated');
      await onUpdated?.();
    } catch (err) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Profile</h2>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-20 h-20 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary">{initial}</span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" onClick={onPickFile} disabled={uploading}>
            <Camera className="w-3.5 h-3.5 mr-1" /> Change
          </Button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl('')}
              className="text-[11px] text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-3 w-full">
          <div className="space-y-1">
            <Label htmlFor="profileName">Full name</Label>
            <Input
              id="profileName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={user.email} disabled />
            <p className="text-[11px] text-muted-foreground">
              Email changes are not supported yet. Contact support if you need to change it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">App role</p>
              <p className="font-medium text-sm capitalize">{user.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Company role</p>
              <p className="font-medium text-sm capitalize">{user.data?.current_company_role || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <Button onClick={onSave} disabled={saving || !changed}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

// ── Email verification ──────────────────────────────────────────────

function EmailVerificationSection({ user }) {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState(null);
  if (!user) return null;
  const verified = user.email_verified !== false;
  const consoleMode = user.email_delivery === 'console';

  const resend = async () => {
    setResending(true);
    setDevVerifyUrl(null);
    try {
      const result = await base44.auth.resendVerification();
      setSent(true);
      if (result?.verify_url) {
        setDevVerifyUrl(result.verify_url);
        toast.success('Verification link ready (local dev)');
      } else {
        toast.success('Verification email sent — check your inbox');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not send email');
    } finally { setResending(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {verified ? (
            <MailCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <MailWarning className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          )}
          <div>
            <h2 className="font-semibold">Email {verified ? 'verified' : 'not verified'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {verified
                ? 'Your email address is confirmed.'
                : consoleMode
                  ? 'Local dev: emails are not sent. Use Resend to get a link below.'
                  : sent
                    ? 'Check your inbox and spam folder.'
                    : `We sent a link to ${user.email}. Resend if you didn't get it.`}
            </p>
            {devVerifyUrl && (
              <a href={devVerifyUrl} className="text-xs text-primary font-medium underline break-all mt-1 inline-block">
                Click here to verify your email
              </a>
            )}
          </div>
        </div>
        {!verified && (
          <Button size="sm" variant="outline" onClick={resend} disabled={resending}>
            {resending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            {sent ? 'Resend again' : 'Resend'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Change password ─────────────────────────────────────────────────

function ChangePasswordSection({ user }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Google-only accounts have no password
  if (user && !user.email) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.next !== form.confirm) {
      setError('New passwords do not match');
      return;
    }
    if (form.next.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (form.next === form.current) {
      setError('New password must differ from current');
      return;
    }
    setBusy(true);
    try {
      await base44.auth.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Other sessions have been signed out.');
    } catch (err) {
      setError(err?.message || 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Change password</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Changing your password signs you out of all other devices. You'll stay signed in here.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs mb-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div className="space-y-1">
          <Label htmlFor="pwCurrent">Current password</Label>
          <Input
            id="pwCurrent"
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm(f => ({ ...f, current: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pwNext">New password</Label>
          <Input
            id="pwNext"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.next}
            onChange={(e) => setForm(f => ({ ...f, next: e.target.value }))}
            placeholder="At least 8 characters, letters + digits"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pwConfirm">Confirm new password</Label>
          <Input
            id="pwConfirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
          />
        </div>
        <div className="pt-1">
          <Button type="submit" disabled={busy || !form.current || !form.next || !form.confirm}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── 2FA ─────────────────────────────────────────────────────────────

function TwoFactorSection() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [disableForm, setDisableForm] = useState({ password: '', token: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const refresh = async () => {
    try {
      const s = await base44.twofa.status();
      setStatus(s);
    } catch (err) {
      setError(err?.message);
    }
  };
  useEffect(() => { refresh(); }, []);

  const startSetup = async () => {
    setError(null); setInfo(null); setLoading(true);
    try {
      const s = await base44.twofa.setup();
      setSetup(s);
    } catch (err) {
      setError(err?.message);
    } finally { setLoading(false); }
  };

  const confirm = async (e) => {
    e?.preventDefault();
    setError(null); setLoading(true);
    try {
      const r = await base44.twofa.confirm(confirmCode.trim());
      setBackupCodes(r.backup_codes);
      setSetup(null);
      setConfirmCode('');
      await refresh();
      setInfo('Two-factor authentication enabled. Save your backup codes below.');
    } catch (err) {
      setError(err?.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  const disable = async (e) => {
    e?.preventDefault();
    setError(null); setLoading(true);
    try {
      await base44.twofa.disable(disableForm.password, disableForm.token);
      setDisableForm({ password: '', token: '' });
      await refresh();
      setInfo('Two-factor authentication disabled.');
    } catch (err) {
      setError(err?.message || 'Could not disable');
    } finally { setLoading(false); }
  };

  const regenerate = async () => {
    setError(null); setLoading(true);
    try {
      const r = await base44.twofa.regenerateBackupCodes();
      setBackupCodes(r.backup_codes);
      setInfo('New backup codes generated. Old ones no longer work.');
    } catch (err) {
      setError(err?.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Two-factor authentication</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Add a second sign-in step with an authenticator app (Google Authenticator, Authy, 1Password).
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${status?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {status?.enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {info && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2 text-xs">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {info}
        </div>
      )}

      {backupCodes && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-800">
            <KeyRound className="w-4 h-4" />
            <p className="font-semibold">Save these backup codes somewhere safe.</p>
          </div>
          <p className="text-xs text-amber-700">
            Each code works once. Use them to sign in if you lose your authenticator. They will NOT be shown again.
          </p>
          <div className="grid grid-cols-2 gap-1 font-mono text-xs bg-white rounded p-3">
            {backupCodes.map((c) => <div key={c}>{c}</div>)}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(backupCodes.join('\n'));
              toast.success('Backup codes copied');
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy all
          </Button>
        </div>
      )}

      {!status?.enabled && !setup && (
        <Button onClick={startSetup} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Enable 2FA
        </Button>
      )}

      {setup && !status?.enabled && (
        <form onSubmit={confirm} className="space-y-3">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <img src={setup.qr_data_url} alt="Scan with authenticator" className="w-44 h-44 border rounded-lg bg-white" />
            <div className="text-xs space-y-2">
              <p>1. Scan the QR with your authenticator app.</p>
              <p>2. Or paste this secret manually:</p>
              <code className="block bg-slate-100 p-2 rounded text-[11px] break-all">{setup.secret}</code>
              <p>3. Enter the 6-digit code your app shows.</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmCode">6-digit code</Label>
            <Input
              id="confirmCode"
              inputMode="numeric"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="123456"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !confirmCode}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Confirm and enable
          </Button>
        </form>
      )}

      {status?.enabled && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Enabled {status?.confirmedAt ? new Date(status.confirmedAt).toLocaleString() : ''}.
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={regenerate} disabled={loading}>
              Regenerate backup codes
            </Button>
          </div>

          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
              <ShieldOff className="w-4 h-4" /> Disable 2FA
            </summary>
            <form onSubmit={disable} className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label htmlFor="disPwd">Current password</Label>
                <Input id="disPwd" type="password" value={disableForm.password} onChange={(e) => setDisableForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="disCode">Current 6-digit code</Label>
                <Input id="disCode" inputMode="numeric" value={disableForm.token} onChange={(e) => setDisableForm(f => ({ ...f, token: e.target.value }))} placeholder="123456" />
              </div>
              <Button type="submit" variant="destructive" size="sm" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Disable 2FA
              </Button>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}

// ── Sessions ────────────────────────────────────────────────────────

function SessionsSection({ onLogoutEverywhere }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!confirm('Sign out of every device? You will need to sign in again here too.')) return;
    setBusy(true);
    try { await onLogoutEverywhere(); } finally { setBusy(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <h2 className="font-semibold">Sessions</h2>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Sign out of every browser and device.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Log out everywhere
      </Button>
    </div>
  );
}
