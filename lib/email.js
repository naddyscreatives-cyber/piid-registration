// FILE: lib/email.js — Ticket confirmation email (Resend) with the QR embedded inline.
// Depends on: resend (npm), RESEND_API_KEY, RESEND_FROM, lib/qrToken, lib/env, lib/logger.
// Spec reference: Section 6 (Email Delivery).
//
// DELIVERY RULE: registration NEVER fails because email failed. This module
// returns {ok:false} instead of throwing, and /api/register carries on.

import { Resend } from 'resend';
import { env_optional, env_require, env_eventDetails } from './env';
import { qr_renderPngBuffer } from './qrToken';
import { log_line, log_error, log_shortId } from './logger';

/** Attachment content id referenced by the <img src="cid:…"> in the template. */
const QR_CID = 'piid-qr-ticket';

// ===== SECTION: EMAIL TEMPLATE =====

/**
 * email_buildTicketHtml — the confirmation email body.
 * Table-based and inline-styled, because email clients ignore most modern CSS.
 * @param {object} guest
 * @param {string} guest.fullName    Guest's full name.
 * @param {string} guest.profession  Stored profession value.
 * @returns {string} HTML body.
 */
export function email_buildTicketHtml(guest) {
  const event = env_eventDetails();
  const firstName = String(guest.fullName).trim().split(/\s+/)[0];

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px -20px rgba(15,23,42,.35);">
      <tr>
        <td style="height:6px;background:linear-gradient(90deg,#3b82f6,#a855f7,#f97316,#10b981);"></td>
      </tr>
      <tr>
        <td style="padding:36px 32px 8px 32px;">
          <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#64748b;font-weight:700;">You're registered</p>
          <h1 style="margin:0 0 18px 0;font-size:30px;line-height:1.15;font-weight:800;">Welcome, ${email_escape(firstName)}!</h1>
          <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
            Your spot at <strong>${email_escape(event.name)}</strong> is confirmed. Show the QR code below at the
            registration desk and at each showroom you visit.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 32px 4px 32px;">
          <div style="display:inline-block;padding:18px;background:#ffffff;border:2px solid #e2e8f0;border-radius:20px;">
            <img src="cid:${QR_CID}" alt="Your PIID Summit QR ticket" width="240" height="240"
                 style="display:block;width:240px;height:240px;" />
          </div>
          <p style="margin:12px 0 0 0;font-size:12px;color:#94a3b8;">
            Can't see the code? The same QR is attached to this email as <strong>piid-ticket.png</strong>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:16px;">
            <tr><td style="padding:16px 18px;font-size:14px;line-height:1.7;color:#334155;">
              <strong style="color:#0f172a;">${email_escape(event.name)}</strong><br />
              ${email_escape(event.date)}<br />
              ${email_escape(event.venue)}
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 36px 32px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
            Take a screenshot of the QR code now — venue signal can be unreliable.
            If anything looks wrong, reply to this email or visit the registration desk on the day.
          </p>
        </td>
      </tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0 auto;font-size:11px;line-height:1.6;color:#94a3b8;text-align:center;">
      You are receiving this because you registered for ${email_escape(event.name)}.
      Your details are used for registration, check-in and event communication only.
    </p>
  </body>
</html>`;
}

/**
 * email_escape — minimal HTML escaping for values interpolated into the template.
 * @param {unknown} value Any value.
 * @returns {string} Escaped text.
 */
function email_escape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== SECTION: SEND (WITH ONE RETRY) =====

/**
 * email_sendTicket — sends the confirmation email, retrying once on failure.
 * @param {object} guest
 * @param {string} guest.id         Registrant UUID (for log correlation).
 * @param {string} guest.fullName   Guest's full name.
 * @param {string} guest.email      Destination address.
 * @param {string} guest.profession Stored profession value.
 * @param {string} qrToken          The signed token to render into the QR.
 * @returns {Promise<{ok: boolean, error?: string}>} Never throws.
 */
export async function email_sendTicket(guest, qrToken) {
  try {
    const resend = new Resend(env_require('RESEND_API_KEY'));
    const from = env_optional('RESEND_FROM', 'PIID Summit <onboarding@resend.dev>');
    const png = await qr_renderPngBuffer(qrToken);
    const event = env_eventDetails();

    const payload = {
      from,
      to: [guest.email],
      subject: `Your ${event.name} ticket — ${String(guest.fullName).trim().split(/\s+/)[0]}`,
      html: email_buildTicketHtml(guest),
      text:
        `You're registered for ${event.name}.\n\n` +
        `${event.date}\n${event.venue}\n\n` +
        `Your QR ticket is attached as piid-ticket.png — show it at the registration desk ` +
        `and at each showroom you visit.\n`,
      attachments: [
        {
          filename: 'piid-ticket.png',
          content: png.toString('base64'),
          content_id: QR_CID,   // makes the attachment render inline via cid:
        },
      ],
    };

    // ----- attempt 1 -----
    let { error } = await resend.emails.send(payload);

    // ----- attempt 2 (one retry, per Spec 6) -----
    if (error) {
      log_line('EMAIL', `retrying send for ${log_shortId(guest.id)}`);
      await new Promise((r) => setTimeout(r, 600));
      ({ error } = await resend.emails.send(payload));
    }

    if (error) {
      log_error('EMAIL', `send failed for registrant ${log_shortId(guest.id)}`, error.message || error);
      return { ok: false, error: String(error.message || error) };
    }

    log_line('EMAIL', `sent ticket to registrant ${log_shortId(guest.id)}`);
    return { ok: true };
  } catch (err) {
    log_error('EMAIL', `send threw for registrant ${log_shortId(guest?.id)}`, err);
    return { ok: false, error: err instanceof Error ? err.message : 'unknown email error' };
  }
}
