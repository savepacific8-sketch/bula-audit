import { useState } from 'react';

import { Link } from 'react-router-dom';

import { base44 } from '@/api/base44Client';

import BulaLogo from '@/components/layout/BulaLogo';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

import TurnstileWidget from '@/components/TurnstileWidget';

import { formatApiError } from '@/lib/apiErrors';



const TURNSTILE_ENABLED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);



export default function ForgotPassword() {

  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);

  const [done, setDone] = useState(false);

  const [error, setError] = useState(null);

  const [turnstileToken, setTurnstileToken] = useState(null);

  const [resetUrl, setResetUrl] = useState(null);

  const [consoleMode, setConsoleMode] = useState(false);



  const onSubmit = async (e) => {

    e.preventDefault();

    setError(null);

    setResetUrl(null);

    if (TURNSTILE_ENABLED && !turnstileToken) {

      setError('Please complete the security check below.');

      return;

    }

    setLoading(true);

    try {

      const result = await base44.auth.requestPasswordReset(email.trim(), turnstileToken);

      setDone(true);

      setConsoleMode(result?.email_delivery === 'console');

      if (result?.reset_url) setResetUrl(result.reset_url);

    } catch (err) {

      setError(formatApiError(err, 'Could not send reset link'));

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

            <h1 className="text-2xl font-bold text-foreground font-poppins">Forgot password</h1>

            <p className="text-sm text-muted-foreground mt-1">

              We&apos;ll email you a link to reset it.

            </p>

          </div>

        </div>



        {done ? (

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">

            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">

              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />

              <span>

                {consoleMode

                  ? 'Local dev: no email is sent. Use the reset link below (also printed in the server terminal).'

                  : 'If that email is registered, a reset link has been sent. Check your inbox and spam folder.'}

              </span>

            </div>

            {resetUrl && (

              <a

                href={resetUrl}

                className="block text-sm text-primary font-medium underline break-all"

              >

                Click here to reset your password

              </a>

            )}

            <Link to="/login">

              <Button variant="outline" className="w-full">Back to sign in</Button>

            </Link>

          </div>

        ) : (

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

                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>

              ) : (

                'Send reset link'

              )}

            </Button>

          </form>

        )}



        <p className="text-center text-sm text-muted-foreground">

          Remembered it?{' '}

          <Link to="/login" className="text-primary font-medium hover:underline">

            Sign in

          </Link>

        </p>

      </div>

    </div>

  );

}


