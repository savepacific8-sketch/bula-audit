// Email abstraction with two drivers:
//   console: logs to stderr (dev fallback, never sends real mail)
//   resend:  sends via Resend (https://resend.com)
//
// All app code calls sendEmail() — never reaches into a driver directly.

import { Resend } from 'resend';
import { env } from '../env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDriver {
  send(msg: EmailMessage): Promise<void>;
}

// ── Console driver (dev fallback) ──────────────────────────────────
class ConsoleEmailDriver implements EmailDriver {
  async send(msg: EmailMessage) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[email:console] to:      ${msg.to}`);
    console.log(`[email:console] subject: ${msg.subject}`);
    console.log(`[email:console] body:`);
    console.log(msg.text);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

// ── Resend driver ──────────────────────────────────────────────────
class ResendEmailDriver implements EmailDriver {
  private client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async send(msg: EmailMessage) {
    const result = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: env.EMAIL_REPLY_TO || undefined,
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────
function makeDriver(): EmailDriver {
  if (env.EMAIL_DRIVER === 'resend') {
    if (!env.RESEND_API_KEY) {
      console.warn('[email] EMAIL_DRIVER=resend but RESEND_API_KEY is empty. Falling back to console.');
      return new ConsoleEmailDriver();
    }
    return new ResendEmailDriver(env.RESEND_API_KEY);
  }
  return new ConsoleEmailDriver();
}

const driver = makeDriver();

export const isEmailConfigured =
  env.EMAIL_DRIVER === 'resend' && Boolean(env.RESEND_API_KEY);

/**
 * Send an email. Throws on driver failure (caller should decide whether to
 * surface to user or swallow for security reasons — e.g. password reset
 * should always respond identically regardless of email send success).
 */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  await driver.send(msg);
}

// ── Templates ──────────────────────────────────────────────────────

export function passwordResetEmail(resetUrl: string, expiresMinutes: number): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: `Reset your ${env.APP_NAME} password`,
    text: [
      `You requested a password reset for ${env.APP_NAME}.`,
      ``,
      `Click this link to set a new password:`,
      resetUrl,
      ``,
      `This link expires in ${expiresMinutes} minutes.`,
      ``,
      `If you didn't request this, you can ignore this email.`,
    ].join('\n'),
    html: `
<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#0d4f6c;margin:0 0 12px">Reset your ${env.APP_NAME} password</h2>
  <p>You requested a password reset. Click the button below to set a new password.</p>
  <p style="margin:24px 0">
    <a href="${resetUrl}" style="background:#0d4f6c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">Reset password</a>
  </p>
  <p style="font-size:13px;color:#64748b">Or copy this link: <br><a href="${resetUrl}">${resetUrl}</a></p>
  <p style="font-size:13px;color:#64748b">This link expires in ${expiresMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
</body></html>`.trim(),
  };
}

export function verificationEmail(verifyUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: `Verify your ${env.APP_NAME} email`,
    text: [
      `Welcome to ${env.APP_NAME}!`,
      ``,
      `Click this link to verify your email address:`,
      verifyUrl,
      ``,
      `If you didn't sign up, you can ignore this email.`,
    ].join('\n'),
    html: `
<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#0d4f6c;margin:0 0 12px">Welcome to ${env.APP_NAME}</h2>
  <p>Click the button below to verify your email address.</p>
  <p style="margin:24px 0">
    <a href="${verifyUrl}" style="background:#0d4f6c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">Verify email</a>
  </p>
  <p style="font-size:13px;color:#64748b">Or copy this link: <br><a href="${verifyUrl}">${verifyUrl}</a></p>
</body></html>`.trim(),
  };
}
