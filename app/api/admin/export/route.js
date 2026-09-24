// FILE: app/api/admin/export/route.js — GET /api/admin/export
// Organiser-level CSV export of registrants + their showroom check-ins.
// Depends on: lib/supabaseServer, ADMIN_EXPORT_TOKEN.
// Spec reference: Section 5 (/api/admin/export), Section 12.
//
// AUTH: gated by ADMIN_EXPORT_TOKEN, deliberately SEPARATE from the four
// showroom admin logins — a door admin should not be able to download the
// whole guest list (Spec 5).
//
// USAGE:
//   https://your-app.vercel.app/api/admin/export?token=YOUR_ADMIN_EXPORT_TOKEN
//   or send it as the header:  x-export-token: YOUR_ADMIN_EXPORT_TOKEN

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db_fetchAllForExport } from '@/lib/supabaseServer';
import { SHOWROOMS } from '@/lib/showrooms';
import { env_require } from '@/lib/env';
import { log_line, log_error } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * api_exportCsv — GET handler for /api/admin/export.
 * @param {Request} request Must carry the export token as ?token= or x-export-token.
 * @returns {Promise<NextResponse|Response>} A text/csv download, or a JSON error.
 */
export async function GET(request) {
  // ===== SECTION: AUTHORISATION =====
  const url = new URL(request.url);
  const supplied = request.headers.get('x-export-token') || url.searchParams.get('token') || '';

  let expected;
  try {
    expected = env_require('ADMIN_EXPORT_TOKEN');
  } catch (err) {
    log_error('EXPORT', 'ADMIN_EXPORT_TOKEN is not configured', err);
    return NextResponse.json({ ok: false, message: 'Export is not configured.' }, { status: 500 });
  }

  if (!val_secretsMatch(supplied, expected)) {
    log_line('EXPORT', 'rejected request with a bad token');
    return NextResponse.json({ ok: false, message: 'Not authorised.' }, { status: 401 });
  }

  // ===== SECTION: DATABASE READ =====
  let registrants;
  let logs;
  try {
    ({ registrants, logs } = await db_fetchAllForExport());
  } catch (err) {
    log_error('EXPORT', 'database read failed', err);
    return NextResponse.json({ ok: false, message: 'Could not read the data.' }, { status: 503 });
  }

  // ===== SECTION: CSV BUILD =====
  const csv = api_buildCsv(registrants, logs);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  log_line('EXPORT', `generated CSV for ${registrants.length} registrants`);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="piid-registrations-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ===== SECTION: HELPERS =====

/**
 * val_secretsMatch — constant-time comparison of two secrets.
 * @param {string} a Supplied value.
 * @param {string} b Expected value.
 * @returns {boolean} True when identical.
 */
function val_secretsMatch(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * api_buildCsv — flattens registrants + showroom logs into one wide CSV,
 * with a Yes/scan-time column per showroom so organisers can sort in Excel.
 * @param {object[]} registrants Rows from the registrants table.
 * @param {object[]} logs        Rows from the showroom_logs table.
 * @returns {string} CSV text, BOM-prefixed so Excel reads UTF-8 correctly.
 */
function api_buildCsv(registrants, logs) {
  const byRegistrant = new Map();
  for (const log of logs) {
    if (!byRegistrant.has(log.registrant_id)) byRegistrant.set(log.registrant_id, {});
    byRegistrant.get(log.registrant_id)[log.showroom_name] = log.scanned_at;
  }

  const header = [
    'Registrant ID',
    'Full Name',
    'Firm / Company',
    'Profession',
    'Email',
    'Mobile Number',
    'City / Area',
    'Ticket Email',
    'Registered At',
    ...SHOWROOMS,
    'Showrooms Visited',
  ];

  const rows = registrants.map((r) => {
    const scans = byRegistrant.get(r.id) ?? {};
    const perShowroom = SHOWROOMS.map((room) => (scans[room] ? scans[room] : ''));
    const visited = perShowroom.filter(Boolean).length;
    return [
      r.id,
      r.full_name,
      r.firm_company,
      r.profession,
      r.email,
      r.mobile_number,
      r.city_area,
      r.email_status,
      r.created_at,
      ...perShowroom,
      String(visited),
    ];
  });

  const body = [header, ...rows].map((row) => row.map(api_csvCell).join(',')).join('\r\n');
  return `﻿${body}\r\n`;
}

/**
 * api_csvCell — escapes one CSV cell.
 * The leading-quote guard stops Excel from executing a value that starts with
 * =, +, - or @ as a formula (CSV injection).
 * @param {unknown} value Cell value.
 * @returns {string} Quoted, escaped cell.
 */
function api_csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
