import { env } from '../env.js';

/** Initialize Sentry when SENTRY_DSN is set (production monitoring). */
export async function initSentry(): Promise<void> {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    });
    console.log('[sentry] initialized');
  } catch (err) {
    console.warn('[sentry] failed to load @sentry/node — run npm install in server/', err);
  }
}
