// FILE: app/api/health/route.js — GET /api/health
// Setup diagnostics: says exactly which piece of configuration is missing or wrong,
// instead of leaving you with a generic "Something went wrong".
// Depends on: @supabase/supabase-js, the environment variables in Section 12.
//
// VISIT: https://your-app.vercel.app/api/health
//
// SAFETY: this route NEVER returns a key's value — only whether it is set, its
// length, and a 4-character prefix, which is enough to spot a pasted-wrong key
// without exposing it. Delete this file once the event is set up if you prefer.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ===== SECTION: ENV INSPECTION =====

/**
 * api_describeVar — reports on one environment variable without revealing it.
 * @param {string} name The variable name.
 * @returns {{set: boolean, length: number, startsWith: string}}
 */
function api_describeVar(name) {
  const value = process.env[name];
  const text = value ? String(value).trim() : '';
  return {
    set: text.length > 0,
    length: text.length,
    startsWith: text ? `${text.slice(0, 4)}…` : '',
  };
}

/**
 * api_health — GET handler for /api/health.
 * @returns {Promise<Response>} JSON report of configuration and live connectivity.
 */
export async function GET() {
  const names = [
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'QR_SECRET',
    'RESEND_API_KEY',
    'RESEND_FROM',
    'ADMIN_EXPORT_TOKEN',
  ];

  const env = {};
  for (const name of names) env[name] = api_describeVar(name);

  const problems = [];
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url) problems.push('No Supabase URL set (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL).');
  if (!serviceKey) problems.push('SUPABASE_SERVICE_ROLE_KEY is not set — registration cannot write to the database.');
  if (!anonKey) problems.push('No anon key set — admin sign-in cannot be verified.');
  if (!process.env.QR_SECRET) problems.push('QR_SECRET is not set — QR tickets cannot be signed.');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    problems.push(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must BOTH be set — the browser needs them to sign admins in. These are baked in at build time, so redeploy after adding them.'
    );
  }

  // ===== SECTION: PROJECT MATCH =====
  // The single most common setup mistake: the server keys and the browser keys
  // come from two different Supabase projects, so guests register into project A
  // while admins try to sign in against project B.
  const serverUrl = process.env.SUPABASE_URL || '';
  const browserUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (serverUrl && browserUrl && serverUrl.trim() !== browserUrl.trim()) {
    problems.push(
      'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL point at DIFFERENT projects. They must be identical.'
    );
  }

  // ===== SECTION: LIVE DATABASE CHECK =====
  let database = { reachable: false, detail: 'not attempted' };
  if (url && serviceKey) {
    try {
      const client = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { error, count } = await client
        .from('registrants')
        .select('id', { count: 'exact', head: true });
      database = error
        ? { reachable: false, detail: `${error.message} (code ${error.code || 'none'})` }
        : { reachable: true, detail: `registrants table OK, ${count ?? 0} rows` };
    } catch (err) {
      database = { reachable: false, detail: err instanceof Error ? err.message : 'unknown error' };
    }
  }

  // ===== SECTION: ADMIN ACCOUNT CHECK =====
  // Lists the auth users and whether each carries a valid showroom_name.
  // Emails are shown because you are the project owner running your own setup check.
  let adminAccounts = { checked: false, detail: 'not attempted', users: [] };
  if (url && serviceKey) {
    try {
      const client = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 50 });
      if (error) {
        adminAccounts = { checked: false, detail: error.message, users: [] };
      } else {
        adminAccounts = {
          checked: true,
          detail: `${data.users.length} auth user(s) found`,
          users: data.users.map((u) => ({
            email: u.email,
            showroom_name: u.user_metadata?.showroom_name ?? null,
            email_confirmed: Boolean(u.email_confirmed_at),
            has_password: Boolean(u.encrypted_password) || u.identities?.some((i) => i.provider === 'email') || null,
            created_at: u.created_at,
          })),
        };
        if (data.users.length === 0) {
          problems.push('No Supabase Auth users exist in this project — the four showroom accounts were created somewhere else, or not at all.');
        }
        for (const u of data.users) {
          if (!u.user_metadata?.showroom_name) {
            problems.push(`Auth user ${u.email} has no showroom_name in user metadata — they can sign in but cannot scan.`);
          }
          if (!u.email_confirmed_at) {
            problems.push(`Auth user ${u.email} is NOT confirmed — Supabase will refuse the login. Confirm them in Authentication → Users.`);
          }
        }
      }
    } catch (err) {
      adminAccounts = { checked: false, detail: err instanceof Error ? err.message : 'unknown error', users: [] };
    }
  }

  return Response.json(
    {
      ok: problems.length === 0 && database.reachable,
      checkedAt: new Date().toISOString(),
      problems,
      env,
      database,
      adminAccounts,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
