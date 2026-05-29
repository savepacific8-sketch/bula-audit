import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import BulaLogo from '@/components/layout/BulaLogo';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('verifying'); // 'verifying' | 'ok' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('Missing verification token');
      return;
    }
    base44.auth.confirmVerification(token)
      .then(() => setState('ok'))
      .catch((err) => {
        setState('error');
        setError(err?.message || 'Verification failed');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <BulaLogo size={56} />
          <h1 className="text-2xl font-bold text-foreground font-poppins">Verify email</h1>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          {state === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying...</p>
            </div>
          )}
          {state === 'ok' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              <p className="text-sm font-medium">Your email is verified.</p>
              <Link to="/" className="w-full">
                <Button className="w-full">Go to app</Button>
              </Link>
            </div>
          )}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm">{error || 'Verification failed'}</p>
              <Link to="/login" className="w-full">
                <Button variant="outline" className="w-full">Back to sign in</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
