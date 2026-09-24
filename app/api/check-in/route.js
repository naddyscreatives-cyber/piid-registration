// FILE: app/api/check-in/route.js — POST /api/check-in
// Verifies a scanned QR token and logs one showroom check-in for the signed-in admin.
// Depends on: lib/adminAuth (Supabase Auth session), lib/qrToken (HMAC verify),
//             lib/supabaseServer, lib/logger, QR_SECRET.
// Spec reference: Sections 4 (scan outcomes), 5, 7, 8.
//
// RESPONSE CONTRACT — the scanner UI switches on `status`:
//   "valid"     → emerald card, WELCOME, {firstName}!
//   "duplicate" → rose card,    ALREADY CHECKED IN + original scan time
//   "invalid"   → rose card,    TICKET NOT RECOGNIZED (never any guest PII)
//   HTTP 5xx / network failure → amber retry card, handled by the client

import { NextResponse } from 'next/server';
import { api_resolveShowroomAdmin } from '@/lib/adminAuth';
import { qr_verifyToken } from '@/lib/qrToken';
import {
  db_findRegistrantByToken,
  db_logShowroomScan,
  db_countScansForShowroom,
} from '@/lib/supabaseServer';
import { rl_check } from '@/lib/rateLimit';
import { log_line, log_error, log_shortId } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generous: a busy door scans fast, but this still stops a runaway loop. */
const SCAN_LIMIT = 120;
const SCAN_WINDOW_MS = 60_000;

/**
 * api_checkIn — POST handler for /api/check-in.
 * @param {Request} request JSON body {qrToken}; Authorization: Bearer <supabase access token>.
 * @returns {Promise<NextResponse>} JSON {status, firstName?, scannedAt?, showroom, totalScans?}.
 */
export async function POST(request) {
  // ===== SECTION: ADMIN SESSION =====
  // The showroom is read from the admin's Supabase session, never from the body,
  // so scans can never be logged under the wrong showroom (Spec 8).
  const admin = await api_resolveShowroomAdmin(request);
  if (!admin.ok) {
    return NextResponse.json(
      { status: 'unauthorized', message: admin.message },
      { status: admin.status }
    );
  }

  const limit = rl_check(`checkin:${admin.userId}`, SCAN_LIMIT, SCAN_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { status: 'error', message: 'Scanning too fast — pause for a moment.' },
      { status: 429 }
    );
  }

  // ===== SECTION: REQUEST PARSING =====
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid', showroom: admin.showroom }, { status: 400 });
  }

  // ===== SECTION: QR TOKEN VERIFICATION =====
  // Signature is checked before any database round-trip, so forged or random
  // codes are rejected for free.
  const verified = qr_verifyToken(body?.qrToken);
  if (!verified.valid) {
    log_line('CHECK-IN', `rejected unsigned/forged token at ${admin.showroom}`);
    return NextResponse.json({ status: 'invalid', showroom: admin.showroom });
  }

  // ===== SECTION: DATABASE LOOKUP =====
  let guest;
  try {
    guest = await db_findRegistrantByToken(String(body.qrToken).trim());
  } catch (err) {
    log_error('CHECK-IN', 'registrant lookup failed', err);
    return NextResponse.json(
      { status: 'error', message: 'Could not reach the database.' },
      { status: 503 }
    );
  }

  if (!guest) {
    // Correctly signed but not in the table — e.g. a ticket for a deleted
    // registration. Still "not recognised", and still no PII in the response.
    log_line('CHECK-IN', `valid signature, no registrant at ${admin.showroom}`);
    return NextResponse.json({ status: 'invalid', showroom: admin.showroom });
  }

  // ===== SECTION: LOG THE SCAN =====
  // The unique index on (registrant_id, showroom_name) decides "already scanned",
  // which keeps the answer correct even under simultaneous scans (Spec 5).
  let result;
  try {
    result = await db_logShowroomScan(guest.id, admin.showroom);
  } catch (err) {
    log_error('CHECK-IN', `insert failed for ${log_shortId(guest.id)}`, err);
    return NextResponse.json(
      { status: 'error', message: 'Could not record the scan.' },
      { status: 503 }
    );
  }

  // ===== SECTION: RESPONSE =====
  const totalScans = await db_countScansForShowroom(admin.showroom);
  const firstName = String(guest.full_name).trim().split(/\s+/)[0];

  return NextResponse.json({
    status: result.duplicate ? 'duplicate' : 'valid',
    firstName,
    fullName: guest.full_name,
    scannedAt: result.scannedAt,
    showroom: admin.showroom,
    totalScans,
  });
}

/**
 * api_checkInSession — GET handler: tells the scanner UI which showroom the
 * signed-in admin belongs to, and the running total for that showroom.
 * @param {Request} request Authorization: Bearer <supabase access token>.
 * @returns {Promise<NextResponse>} JSON {showroom, email, totalScans}.
 */
export async function GET(request) {
  const admin = await api_resolveShowroomAdmin(request);
  if (!admin.ok) {
    return NextResponse.json(
      { status: 'unauthorized', message: admin.message },
      { status: admin.status }
    );
  }
  const totalScans = await db_countScansForShowroom(admin.showroom);
  return NextResponse.json({ showroom: admin.showroom, email: admin.email, totalScans });
}
