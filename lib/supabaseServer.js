// FILE: lib/supabaseServer.js — Server-only Supabase clients and every database call.
// Depends on: @supabase/supabase-js, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
//
// IMPORTANT: this module must never be imported from a "use client" component.
// The service_role key bypasses Row Level Security; if it reached the browser
// bundle, anyone could read the whole registrants table (Build Spec Section 5).
//
// All calls go over Supabase's REST API (PostgREST), not a direct Postgres
// connection, so concurrent serverless invocations cannot exhaust the
// database connection limit (Build Spec Section 13).

import { createClient } from '@supabase/supabase-js';
import { env_require } from './env';
import { log_line, log_shortId } from './logger';

let _serviceClient = null;

// ===== SECTION: CLIENT FACTORIES =====

/**
 * db_serviceClient — lazily creates the privileged Supabase client.
 * @returns {import('@supabase/supabase-js').SupabaseClient} A service_role client.
 */
export function db_serviceClient() {
  if (_serviceClient) return _serviceClient;
  _serviceClient = createClient(
    env_require('SUPABASE_URL'),
    env_require('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _serviceClient;
}

/**
 * db_clientForAccessToken — builds an anon-key client bound to one admin's JWT.
 * Used only to resolve "who is this token?"; it has no table permissions.
 * @param {string} accessToken The Supabase Auth access token sent by /admin.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function db_clientForAccessToken(accessToken) {
  return createClient(env_require('SUPABASE_URL'), env_require('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ===== SECTION: REGISTRANT READS =====

/**
 * db_findRegistrantByEmail — duplicate check before insert (Build Spec Section 9).
 * @param {string} email Lower-cased email address.
 * @returns {Promise<{id: string, full_name: string} | null>} The existing row, or null.
 */
export async function db_findRegistrantByEmail(email) {
  const { data, error } = await db_serviceClient()
    .from('registrants')
    .select('id, full_name')
    .ilike('email', email)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * db_findRegistrantByToken — looks a guest up by their signed QR token.
 * @param {string} qrToken The full signed token scanned from the QR code.
 * @returns {Promise<{id: string, full_name: string} | null>} The guest, or null.
 */
export async function db_findRegistrantByToken(qrToken) {
  const { data, error } = await db_serviceClient()
    .from('registrants')
    .select('id, full_name')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

// ===== SECTION: REGISTRANT WRITES =====

/**
 * db_insertRegistrant — writes one validated registration.
 * @param {object} row                Cleaned field values.
 * @param {string} row.id             UUID minted server-side so the row can be
 *                                    written once, already carrying its signed token.
 * @param {string} row.full_name
 * @param {string} row.firm_company
 * @param {string} row.profession
 * @param {string} row.email
 * @param {string} row.mobile_number
 * @param {string} row.city_area
 * @param {string} row.qr_token
 * @returns {Promise<{id: string, full_name: string, email: string}>} The inserted row.
 * @throws {Error & {code?: string}} Postgres error; code "23505" means duplicate email.
 */
export async function db_insertRegistrant(row) {
  const { data, error } = await db_serviceClient()
    .from('registrants')
    .insert(row)
    .select('id, full_name, email')
    .single();

  if (error) throw error;
  log_line('REGISTER', `inserted registrant ${log_shortId(data.id)}`);
  return data;
}

/**
 * db_updateEmailStatus — records whether the ticket email actually went out,
 * so the front desk can find and re-send failures (Build Spec Section 6).
 * @param {string} registrantId The registrant UUID.
 * @param {'sent'|'failed'} status Delivery outcome.
 * @returns {Promise<void>}
 */
export async function db_updateEmailStatus(registrantId, status) {
  const { error } = await db_serviceClient()
    .from('registrants')
    .update({ email_status: status })
    .eq('id', registrantId);

  // A failed status update must never fail the registration itself.
  if (error) log_line('EMAIL', `could not record status for ${log_shortId(registrantId)}`);
}

// ===== SECTION: SHOWROOM CHECK-IN =====

/**
 * db_logShowroomScan — attempts to record one check-in.
 * Relies on the unique index on (registrant_id, showroom_name): a 23505
 * violation IS the "already checked in" answer, which keeps the result correct
 * even when two tablets scan the same ticket simultaneously (Build Spec Section 5).
 * @param {string} registrantId The guest's UUID.
 * @param {string} showroomName The showroom taken from the admin's session.
 * @returns {Promise<{duplicate: boolean, scannedAt: string}>}
 *          duplicate=false on a fresh scan; duplicate=true with the ORIGINAL scan time.
 */
export async function db_logShowroomScan(registrantId, showroomName) {
  const { data, error } = await db_serviceClient()
    .from('showroom_logs')
    .insert({ registrant_id: registrantId, showroom_name: showroomName })
    .select('scanned_at')
    .single();

  if (!error) {
    log_line('CHECK-IN', `logged ${log_shortId(registrantId)} at ${showroomName}`);
    return { duplicate: false, scannedAt: data.scanned_at };
  }

  if (error.code === '23505') {
    const original = await db_findExistingScan(registrantId, showroomName);
    log_line('CHECK-IN', `duplicate scan for ${log_shortId(registrantId)} at ${showroomName}`);
    return { duplicate: true, scannedAt: original };
  }

  throw error;
}

/**
 * db_findExistingScan — fetches the time of a guest's original scan at a showroom.
 * @param {string} registrantId The guest's UUID.
 * @param {string} showroomName The showroom.
 * @returns {Promise<string|null>} ISO timestamp, or null if it cannot be read.
 */
export async function db_findExistingScan(registrantId, showroomName) {
  const { data, error } = await db_serviceClient()
    .from('showroom_logs')
    .select('scanned_at')
    .eq('registrant_id', registrantId)
    .eq('showroom_name', showroomName)
    .maybeSingle();

  if (error || !data) return null;
  return data.scanned_at;
}

/**
 * db_countScansForShowroom — running total shown on the admin header.
 * @param {string} showroomName The showroom.
 * @returns {Promise<number>} Number of guests checked into that showroom.
 */
export async function db_countScansForShowroom(showroomName) {
  const { count, error } = await db_serviceClient()
    .from('showroom_logs')
    .select('id', { count: 'exact', head: true })
    .eq('showroom_name', showroomName);

  if (error) return 0;
  return count ?? 0;
}

// ===== SECTION: EXPORT =====

/**
 * db_fetchAllForExport — pulls every registrant and every scan for the CSV export.
 * Paginated at 1000 rows so a 500+ guest event is never truncated by PostgREST limits.
 * @returns {Promise<{registrants: object[], logs: object[]}>}
 */
export async function db_fetchAllForExport() {
  const client = db_serviceClient();
  const registrants = await db_pageThrough(client, 'registrants',
    'id, full_name, firm_company, profession, email, mobile_number, city_area, email_status, created_at',
    'created_at');
  const logs = await db_pageThrough(client, 'showroom_logs',
    'registrant_id, showroom_name, scanned_at', 'scanned_at');
  return { registrants, logs };
}

/**
 * db_pageThrough — reads a whole table in 1000-row pages.
 * @param {import('@supabase/supabase-js').SupabaseClient} client Service client.
 * @param {string} table   Table name.
 * @param {string} columns Column list.
 * @param {string} orderBy Column to sort by, ascending.
 * @returns {Promise<object[]>} Every row.
 */
async function db_pageThrough(client, table, columns, orderBy) {
  const pageSize = 1000;
  const rows = [];
  for (let page = 0; ; page += 1) {
    const from = page * pageSize;
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
