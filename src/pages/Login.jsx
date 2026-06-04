import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import BulaLogo from '@/components/layout/BulaLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, checkUserAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const fromRaw = new URLSearchParams(location.search).get('from') || '/';
  const from =
    typeof fromRaw === 'string' &&
    fromRaw.startsWith('/') &&
    !fromRaw.includes('[object')
      ? fromRaw
      : '/';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  useEffect(() => {
    base44.auth.googleStatus()
      .then((s) => setGoogleEnabled(Boolean(s?.configured)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await base44.auth.login(email.trim(), password);
      if (result?.requires2fa) {
        setChallengeToken(result.challengeToken);
        return;
      }
      await checkUserAuth();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit2fa = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await base44.auth.loginWithTwoFa(challengeToken, code.trim());
      await checkUserAuth();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  if (challengeToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground font-poppins">Two-factor sign-in</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit2fa} className="space-y-4 bg-card rounded-2xl border border-border p-6 shadow-sm">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="code">Authenticator code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456 or backup code"
                disabled={loading}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Lost your device? Paste one of your backup codes (XXXX-XXXXXX).
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !code}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
              ) : (
                'Verify'
              )}
            </Button>

            <button
              type="button"
              onClick={() => { setChallengeToken(null); setCode(''); setError(null); }}
              className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              Back to password
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <BulaLogo size={56} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground font-poppins">BULA AUDIT</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 bg-card rounded-2xl border border-border p-6 shadow-sm">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
            ) : (
              'Sign in'
            )}
          </Button>

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          {googleEnabled && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <a
                href={base44.auth.getGoogleLoginUrl(window.location.origin + from)}
                className="block"
              >
                <Button type="button" variant="outline" className="w-full">
                  Continue with Google
                </Button>
              </a>
            </>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>

        <p className="text-center text-[11px] text-muted-foreground/70">
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          {' · '}
          <Link to="/terms" className="hover:underline">Terms</Link>
        </p>
      </div>
    </div>
  );
}
