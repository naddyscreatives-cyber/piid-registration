// FILE: lib/email.js — Ticket confirmation email (Resend) with the QR and partner logos embedded inline.
// Depends on: resend (npm), RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO, EVENT_BUTTON_URL, lib/qrToken, lib/env, lib/logger, lib/emailAssets.
// Spec reference: Section 6 (Email Delivery).
//
// DELIVERY RULE: registration NEVER fails because email failed. This module
// returns {ok:false} instead of throwing, and /api/register carries on.

import { Resend } from 'resend';
import { env_optional, env_require, env_eventDetails } from './env';
import { qr_renderPngBuffer } from './qrToken';
import { log_line, log_error, log_shortId } from './logger';
import { EMAIL_LOGOS } from './emailAssets';

/** Attachment content id referenced by the <img src="cid:…"> in the template. */
const QR_CID = 'piid-qr-ticket';

// ===== SECTION: EMAIL TEMPLATE =====

/** Content ids for the inline logo attachments. */
const LOGO_CID = (key) => `logo-${key}`;

/** Partner logos (top row) and follow links (bottom row). Heights are the on-screen size. */
const EMAIL_PARTNERS = [
  { key: 'poliform', name: 'Poliform', href: 'https://www.poliform.it/en/', height: 16 },
  { key: 'flexform', name: 'Flexform', href: 'https://www.flexform.it/en/stores/flexform-manila-stileitalia', height: 17 },
  { key: 'metrotiles', name: 'Metrotiles', href: 'https://metrotiles.com.ph', height: 16 },
];
const EMAIL_SOCIALS = [
  { key: 'stileitalia', name: 'Stile Italia', handle: '@stileitaliainc', href: 'https://www.instagram.com/stileitaliainc?stkn=NjdoMjQzeHhlcnZ4', height: 18 },
  { key: 'metrotiles', name: 'Metrotiles', handle: '@metrotilesph', href: 'https://www.instagram.com/metrotilesph?stkn=N250bWdxcmR5Zml1', height: 16 },
];
const EMAIL_ROUTE = [
  ['215', 'Flexform'],
  ['219', 'Tribù · Barazza · Lualdi'],
  ['235', 'Metrotiles'],
  ['237', 'Poliform'],
];

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * email_logoImg — one inline logo <img>, sized from the embedded PNG's aspect ratio.
 * @param {string} key    Key in EMAIL_LOGOS.
 * @param {number} height On-screen height in px.
 * @param {string} alt    Alt text.
 * @returns {string} HTML.
 */
function email_logoImg(key, height, alt) {
  const logo = EMAIL_LOGOS[key];
  const width = Math.round((logo.width / logo.height) * height);
  return `<img src="cid:${LOGO_CID(key)}" alt="${email_escape(alt)}" width="${width}" height="${height}" style="display:block;border:0;width:${width}px;height:${height}px;" />`;
}

/**
 * email_buildTicketHtml — the confirmation email body, styled like the registration site.
 * Table-based and inline-styled, because email clients ignore most modern CSS.
 * @param {object} guest
 * @param {string} guest.fullName    Guest's full name.
 * @param {string} guest.profession  Stored profession value.
 * @returns {string} HTML body.
 */
export function email_buildTicketHtml(guest) {
  const event = env_eventDetails();
  const firstName = String(guest.fullName).trim().split(/\s+/)[0];
  const buttonUrl = env_optional('EVENT_BUTTON_URL', event.siteUrl || 'https://metrotiles.com.ph');
  const buttonLabel = env_optional('EVENT_BUTTON_LABEL', 'Explore the Summit');
  const hasDate = Boolean(process.env.EVENT_DATE && process.env.EVENT_DATE.trim());

  const dot = (c) => `<td style="padding:0 5px;"><div style="width:8px;height:8px;border-radius:4px;background:${c};font-size:0;line-height:0;">&nbsp;</div></td>`;

  const partners = EMAIL_PARTNERS.map(
    (l) => `<td align="center" valign="middle" style="padding:0 6px;"><a href="${l.href}" target="_blank" style="text-decoration:none;">${email_logoImg(l.key, l.height, l.name)}</a></td>`
  ).join('');

  const route = EMAIL_ROUTE.map(
    ([no, name]) => `<tr>
      <td width="64" style="padding:7px 0;font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;">${no}</td>
      <td style="padding:7px 0;font-size:13px;color:#475569;">${email_escape(name)}</td>
    </tr>`
  ).join('');

  const socials = EMAIL_SOCIALS.map(
    (l, i) => `<td align="center" valign="top" width="50%" style="padding:0 8px;${i === 0 ? 'border-right:1px solid #e2e8f0;' : ''}">
      <a href="${l.href}" target="_blank" style="text-decoration:none;">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td height="24" valign="middle" align="center">${email_logoImg(l.key, l.height, l.name)}</td></tr></table>
        <span style="display:block;margin-top:6px;font-size:11px;font-weight:500;color:#64748b;">${email_escape(l.handle)}</span>
      </a>
    </td>`
  ).join('');

  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light" /></head>
  <body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:${FONT};color:#0f172a;">
    <!-- masthead: four dots above the event name -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr><td align="center" style="padding:8px 0 10px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${dot('#3b82f6')}${dot('#a855f7')}${dot('#f97316')}${dot('#10b981')}</tr></table>
      </td></tr>
      <tr><td align="center" style="padding:0 0 18px 0;font-size:11px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:#64748b;">
        ${email_escape(event.name)}
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;">
      <!-- partner logos -->
      <tr><td align="center" style="padding:28px 12px 22px 12px;border-bottom:1px solid #f1f5f9;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${partners}</tr></table>
      </td></tr>

      <!-- greeting -->
      <tr><td align="center" style="padding:28px 32px 0 32px;">
        <p style="margin:0 0 10px 0;font-size:11px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:#059669;">You're registered</p>
        <h1 style="margin:0 0 14px 0;font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-.02em;color:#0f172a;">Welcome, ${email_escape(firstName)}!</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">
          We&rsquo;re delighted to welcome you to the worlds of Poliform, Flexform and Metrotiles.
          Present the QR pass below for check-in at each showroom.
        </p>
      </td></tr>

      <!-- QR pass -->
      <tr><td align="center" style="padding:24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border:2px solid #e2e8f0;border-radius:20px;"><tr><td style="padding:14px;">
          <img src="cid:${QR_CID}" alt="Your ${email_escape(event.name)} QR pass" width="220" height="220" style="display:block;width:220px;height:220px;border:0;" />
        </td></tr></table>
        <p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
          Screenshot this code &mdash; it is your pass for every showroom.<br />Also attached as <strong>qr-pass.png</strong>.
        </p>
      </td></tr>

      <!-- showroom route -->
      <tr><td style="padding:26px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:16px;">
          <tr><td style="padding:16px 20px 6px 20px;font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#64748b;">
            A journey through design${hasDate ? ` &middot; ${email_escape(event.date)}` : ''}
          </td></tr>
          <tr><td style="padding:0 20px 4px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${route}</table>
          </td></tr>
          <tr><td style="padding:0 20px 14px 20px;font-size:11px;color:#94a3b8;">All showrooms along N. Garcia &mdash; a short walk apart.</td></tr>
        </table>
      </td></tr>

      <!-- button -->
      <tr><td align="center" style="padding:24px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="center" bgcolor="#0f172a" style="border-radius:16px;">
            <a href="${email_escape(buttonUrl)}" target="_blank"
               style="display:block;padding:16px 24px;font-size:13px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:16px;">
              ${email_escape(buttonLabel)}
            </a>
          </td>
        </tr></table>
      </td></tr>

      <!-- follow us -->
      <tr><td align="center" style="padding:24px 32px 32px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="272" style="width:272px;background:#f8fafc;border:1px solid #f1f5f9;border-radius:16px;">
          <tr><td align="center" style="padding:14px 12px 10px 12px;font-size:10px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#64748b;">Follow us</td></tr>
          <tr><td style="padding:0 8px 14px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${socials}</tr></table></td></tr>
        </table>
      </td></tr>
    </table>

    <p style="max-width:520px;margin:18px auto 0 auto;font-size:11px;line-height:1.6;color:#94a3b8;text-align:center;">
      You are receiving this because you registered for ${email_escape(event.name)}.
      Your details are used for registration, check-in and event communication only.
      Questions? Simply reply to this email.
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
    const from = env_optional('RESEND_FROM', 'Manila Interior Design Summit <onboarding@resend.dev>');
    const png = await qr_renderPngBuffer(qrToken);
    const event = env_eventDetails();

    const replyTo = env_optional('RESEND_REPLY_TO', '');

    const payload = {
      from,
      to: [guest.email],
      ...(replyTo ? { replyTo } : {}),
      subject: `Your ${event.name} QR pass — ${String(guest.fullName).trim().split(/\s+/)[0]}`,
      html: email_buildTicketHtml(guest),
      text:
        `You're registered for ${event.name}.\n\n` +
        `Your QR pass is attached as qr-pass.png. Present it for check-in at each showroom along N. Garcia:\n` +
        `215 Flexform · 219 Tribù, Barazza, Lualdi · 235 Metrotiles · 237 Poliform\n`,
      attachments: [
        {
          filename: 'qr-pass.png',
          content: png.toString('base64'),
          content_id: QR_CID,   // makes the attachment render inline via cid:
        },
        // Logos ride along as inline images so they show even when remote images are blocked.
        ...Object.entries(EMAIL_LOGOS).map(([key, logo]) => ({
          filename: `${key}.png`,
          content: logo.base64,
          content_id: LOGO_CID(key),
        })),
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
