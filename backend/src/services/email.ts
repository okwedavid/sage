/**
 * services/email.ts
 * OWNS: Transactional email delivery (password resets).
 *
 * Resend is used when RESEND_API_KEY is configured. Without a key the service
 * degrades gracefully:
 *   - non-production: callers receive the reset link directly in the API
 *     response (clearly labeled dev mode) so local flows work with no SMTP;
 *   - production: sending is skipped with a warning (a human must configure
 *     RESEND_API_KEY — documented in the deployment checklist).
 *
 * SECURITY: never log reset tokens or email bodies.
 */
import { Settings } from '../config/settings';
import { Resend } from 'resend';

// Lazily-created Resend client (only constructed when configured).
let resendClient: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(Settings.RESEND_API_KEY);
}

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  if (!isEmailConfigured()) return null;
  resendClient = new Resend(Settings.RESEND_API_KEY);
  return resendClient;
}

/** Send the password reset email. Returns true when accepted by the provider. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<boolean> {
  const client = getResend();
  if (!client) return false;

  try {
    await client.emails.send({
      from: Settings.EMAIL_FROM,
      to,
      subject: 'Reset your SAGE password',
      html: [
        '<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">',
        '<h2 style="color: #1a1a2e;">Reset your SAGE password</h2>',
        '<p style="color: #4a4a68;">We received a request to reset the password for your SAGE account. Click the button below to choose a new password. This link expires in 1 hour.</p>',
        `<p style="margin: 24px 0;"><a href="${escapeHtml(resetUrl)}" style="background:#667eea;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;">Reset password</a></p>`,
        '<p style="color: #8a8aa3; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>',
        '</div>',
      ].join(''),
    });
    return true;
  } catch (error: any) {
    // Never include the reset URL or recipient in logs beyond the address.
    console.error(`[email] password reset send failed: ${error?.message || 'unknown error'}`);
    return false;
  }
}

/** Minimal HTML-escape for values interpolated into email markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
