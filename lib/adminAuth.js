// FILE: lib/adminAuth.js — Resolves a showroom admin from their Supabase Auth session.
// Depends on: lib/supabaseServer (anon client), lib/showrooms, lib/logger.
// Spec reference: Section 8 (Showroom Admin Authentication — Supabase Auth path).
//
// THE RULE THIS ENFORCES: the showroom name comes from the signed-in user's
// metadata on the server, never from a field the browser sends. An admin
// therefore cannot log scans under another showroom, by accident or on purpose.

import { db_clientForAccessToken } from './supabaseServer';
import { val_isKnownShowroom } from './showrooms';
import { log_error } from './logger';

// ===== SECTION: SESSION VERIFICATION =====

/**
 * api_resolveShowroomAdmin — verifies the Bearer token and returns the admin's showroom.
 * @param {Request} request The incoming API request.
 * @returns {Promise<{ok: true, userId: string, email: string, showroom: string}
 *                 | {ok: false, status: number, message: string}>}
 */
export async function api_resolveShowroomAdmin(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return { ok: false, status: 401, message: 'Your session has expired — please sign in again.' };
  }

  let user;
  try {
    const { data, error } = await db_clientForAccessToken(token).auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, status: 401, message: 'Your session has expired — please sign in again.' };
    }
    user = data.user;
  } catch (err) {
    log_error('AUTH', 'could not verify admin session', err);
    return { ok: false, status: 401, message: 'Your session has expired — please sign in again.' };
  }

  // ===== SECTION: SHOWROOM METADATA =====
  const showroom =
    user.user_metadata?.showroom_name ?? user.app_metadata?.showroom_name ?? null;

  if (!val_isKnownShowroom(showroom)) {
    return {
      ok: false,
      status: 403,
      message:
        'This account has no showroom assigned. Set "showroom_name" in the user metadata in Supabase (see supabase/schema.sql).',
    };
  }

  return { ok: true, userId: user.id, email: user.email ?? '', showroom };
}
