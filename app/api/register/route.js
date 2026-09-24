// FILE: app/api/register/route.js — POST /api/register
// Validates a registration, blocks duplicates, writes the guest, mints the signed
// QR token and sends the ticket email. Registration succeeds even if email fails.
// Depends on: lib/validation, lib/supabaseServer, lib/qrToken, lib/email,
//             lib/rateLimit, lib/logger.
// Spec reference: Sections 3, 5, 6, 7, 9, 10.

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { val_registrationForm, val_normalizeMobile, val_resolveProfession } from '@/lib/validation';
import {
  db_findRegistrantByEmail,
  db_insertRegistrant,
  db_updateEmailStatus,
} from '@/lib/supabaseServer';
import { qr_createToken, qr_renderDataUrl } from '@/lib/qrToken';
import { email_sendTicket } from '@/lib/email';
import { rl_check, rl_clientIp } from '@/lib/rateLimit';
import { log_line, log_error, log_shortId } from '@/lib/logger';

// Node runtime (not Edge): node:crypto for HMAC and the qrcode library need it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A few registrations per IP per minute stops bot floods without touching real guests. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

/**
 * api_register — POST handler for /api/register.
 * @param {Request} request JSON body matching the Section 3 form fields.
 * @returns {Promise<NextResponse>} JSON: {ok, qrDataUrl, emailSent} or {ok:false, fieldErrors|message}.
 */
export async function POST(request) {
  // ===== SECTION: REQUEST PARSING =====
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Something went wrong — please try again.' },
      { status: 400 }
    );
  }

  // ===== SECTION: BOT DEFENCES =====
  // Honeypot: a field hidden from humans. Anything filled in is a bot.
  // Answer 200 so the bot believes it succeeded and does not adapt (Spec 9).
  if (body?.website) {
    log_line('REGISTER', 'honeypot triggered — silently discarded');
    return NextResponse.json({ ok: true, qrDataUrl: null, emailSent: true, discarded: true });
  }

  const ip = rl_clientIp(request);
  const limit = rl_check(`register:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    log_line('REGISTER', `rate limited ${ip}`);
    return NextResponse.json(
      { ok: false, message: 'Too many attempts — please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  // ===== SECTION: VALIDATION =====
  // The browser already ran these exact rules; the server re-runs them because
  // a request can arrive from anywhere, not just from our form.
  const fieldErrors = val_registrationForm({
    fullName: body?.fullName,
    firmCompany: body?.firmCompany,
    profession: body?.profession,
    professionOther: body?.professionOther,
    email: body?.email,
    mobileNumber: body?.mobileNumber,
    cityArea: body?.cityArea,
    consent: Boolean(body?.consent),
  });

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
  }

  const email = String(body.email).trim().toLowerCase();

  // ===== SECTION: DUPLICATE CHECK =====
  try {
    const existing = await db_findRegistrantByEmail(email);
    if (existing) {
      log_line('REGISTER', `duplicate email rejected for ${log_shortId(existing.id)}`);
      return NextResponse.json(
        {
          ok: false,
          fieldErrors: {
            email: "You're already registered — check your email for your ticket.",
          },
          duplicate: true,
        },
        { status: 409 }
      );
    }
  } catch (err) {
    log_error('REGISTER', 'duplicate lookup failed', err);
    return NextResponse.json(
      { ok: false, message: 'Something went wrong — please try again.' },
      { status: 503 }
    );
  }

  // ===== SECTION: QR TOKEN =====
  // The id is minted here rather than by the database default, so the row can be
  // written once, already carrying its signed token. The QR therefore encodes a
  // signed token — never a bare, guessable UUID (Spec 7).
  const registrantId = randomUUID();
  const qrToken = qr_createToken(registrantId);

  // ===== SECTION: DATABASE WRITE =====
  let guest;
  try {
    guest = await db_insertRegistrant({
      id: registrantId,
      full_name: String(body.fullName).trim(),
      firm_company: String(body.firmCompany).trim(),
      profession: val_resolveProfession(body.profession, body.professionOther),
      email,
      mobile_number: val_normalizeMobile(body.mobileNumber),
      city_area: String(body.cityArea).trim(),
      qr_token: qrToken,
    });
  } catch (err) {
    // A 23505 here means someone registered the same email microseconds ago.
    if (err?.code === '23505') {
      return NextResponse.json(
        {
          ok: false,
          fieldErrors: { email: "You're already registered — check your email for your ticket." },
          duplicate: true,
        },
        { status: 409 }
      );
    }
    log_error('REGISTER', 'insert failed', err);
    return NextResponse.json(
      { ok: false, message: 'Something went wrong — please try again.' },
      { status: 503 }
    );
  }

  // ===== SECTION: EMAIL DELIVERY (NON-BLOCKING FOR SUCCESS) =====
  const sendResult = await email_sendTicket(
    { id: guest.id, fullName: guest.full_name, email: guest.email, profession: body.profession },
    qrToken
  );
  await db_updateEmailStatus(guest.id, sendResult.ok ? 'sent' : 'failed');

  // ===== SECTION: RESPONSE =====
  // qrDataUrl lets the success card show the ticket on screen immediately, which
  // is the guest's safety net when the email is delayed or lands in spam.
  let qrDataUrl = null;
  try {
    qrDataUrl = await qr_renderDataUrl(qrToken);
  } catch (err) {
    log_error('REGISTER', 'QR preview render failed', err);
  }

  return NextResponse.json({
    ok: true,
    firstName: String(guest.full_name).trim().split(/\s+/)[0],
    emailSent: sendResult.ok,
    qrDataUrl,
  });
}
