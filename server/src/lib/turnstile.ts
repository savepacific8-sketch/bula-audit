import { env } from '../env.js';
import { HttpError } from '../middleware/error.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

/**
 * Verifies a Cloudflare Turnstile token from the browser widget.
 * When TURNSTILE_SECRET_KEY is unset, verification is skipped (dev / soft launch).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<void> {
  if (!isTurnstileConfigured()) return;

  if (!token || token.length < 10) {
    throw new HttpError(400, 'Security check required. Please complete the CAPTCHA.');
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    console.error('[turnstile] verify HTTP', res.status);
    throw new HttpError(503, 'Security check unavailable. Try again shortly.');
  }

  const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
  if (!data.success) {
    console.warn('[turnstile] failed:', data['error-codes']);
    throw new HttpError(400, 'Security check failed. Please try again.');
  }
}
