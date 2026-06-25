import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import BulaLogo from '@/components/layout/BulaLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import TurnstileWidget from '@/components/TurnstileWidget';
import { formatApiError } from '@/lib/apiErrors';

const TURNSTILE_ENABLED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

export default function Signup() {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError('Please complete the security check below.');
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, fullName.trim() || undefined, turnstileToken);
      navigate('/', { replace: true });
    } catch (err) {
      if (err?.code === 'EMAIL_CONFIRMATION_REQUIRED') {
        setError(err.message);
      } else {
        setError(formatApiError(err, 'Sign-up failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <BulaLogo size={56} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground font-poppins">BULA AUDIT</h1>
            <p className="text-sm text-muted-foreground mt-1">Create your account</p>
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
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              disabled={loading}
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ chars, letter and number"
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">
              At least 8 characters, include a letter and a number, no spaces. Avoid common passwords like password123.
            </p>
          </div>

          <TurnstileWidget
            onToken={setTurnstileToken}
            onError={(msg) => setError(msg)}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              'Create account'
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            By creating an account you agree to our{' '}
            <Link to="/terms" className="underline hover:text-primary">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
          </p>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                try {
                  setError(null);
                  await base44.auth.loginWithGoogle(window.location.origin + '/');
                } catch (err) {
                  setError(formatApiError(err, 'Google sign-in failed'));
                }
              }}
            >
              Continue with Google
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}