// FILE: lib/supabaseBrowser.js — Browser Supabase client, used ONLY for admin sign-in.
// Depends on: @supabase/supabase-js, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Spec reference: Section 5 (RLS), Section 8 (Supabase Auth).
//
// This client holds the ANON key, which under RLS has zero permissions on
// registrants and showroom_logs. It can do exactly one thing: authenticate a
// showroom admin and hold their session. Every read and write to guest data
// happens server-side with the service_role key.

import { createClient } from '@supabase/supabase-js';

let _browserClient = null;

/**
 * db_browserClient — lazily creates the singleton browser auth client.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {Error} When the NEXT_PUBLIC_* variables are missing from the build.
 */
export function db_browserClient() {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Add both in Vercel → Settings → Environment Variables, then redeploy.'
    );
  }

  _browserClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return _browserClient;
}
