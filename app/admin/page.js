// FILE: app/admin/page.js — /admin: the showroom admin screen (sign-in → scanner).
// Depends on: components/AdminLogin, components/ScannerPanel, lib/supabaseBrowser,
//             GET /api/check-in (session → showroom lookup).
// Spec reference: Section 4 (Multi-Showroom Admin Scanner), Section 8 (Supabase Auth).
//
// FLOW
//   1. On load, look for an existing Supabase session.
//   2. If there is one, ask the SERVER which showroom that session belongs to
//      (GET /api/check-in). The browser never decides this.
//   3. No session, or an account with no showroom_name → sign-in screen.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { db_browserClient } from '@/lib/supabaseBrowser';
import UiAdminLogin from '@/components/AdminLogin';
import UiScannerPanel from '@/components/ScannerPanel';

/**
 * UiAdminPage — routes between the sign-in screen and the scanner.
 * @returns {JSX.Element}
 */
export default function UiAdminPage() {
  const [phase, setPhase] = useState('loading'); // loading | signedOut | ready | blocked
  const [session, setSession] = useState(null);  // {showroom, email, totalScans}
  const [problem, setProblem] = useState('');

  // ===== SECTION: SESSION → SHOWROOM =====

  /**
   * api_loadSession — asks the server which showroom the current session owns.
   * @returns {Promise<void>}
   */
  const api_loadSession = useCallback(async () => {
    let client;
    try {
      client = db_browserClient();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Supabase is not configured.');
      setPhase('blocked');
      return;
    }

    const { data } = await client.auth.getSession();
    const accessToken = data?.session?.access_token;

    if (!accessToken) {
      setPhase('signedOut');
      return;
    }

    try {
      const response = await fetch('/api/check-in', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await client.auth.signOut();
        setPhase('signedOut');
        return;
      }

      if (!response.ok) {
        // Signed in, but the account has no showroom assigned (Spec 8 metadata step).
        setProblem(payload?.message || 'This account cannot scan for a showroom.');
        setPhase('blocked');
        return;
      }

      setSession(payload);
      setPhase('ready');
    } catch {
      setProblem('Could not reach the server. Check your connection and reload.');
      setPhase('blocked');
    }
  }, []);

  useEffect(() => {
    api_loadSession();
  }, [api_loadSession]);

  // ===== SECTION: SIGN OUT =====

  /**
   * ui_handleSignOut — clears the Supabase session and returns to the login screen.
   * @returns {Promise<void>}
   */
  async function ui_handleSignOut() {
    try {
      await db_browserClient().auth.signOut();
    } catch {
      /* already signed out */
    }
    setSession(null);
    setPhase('signedOut');
  }

  // ===== SECTION: RENDER =====
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      {phase === 'loading' ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <span
            aria-label="Loading"
            className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-piid-blue"
          />
        </div>
      ) : null}

      {phase === 'signedOut' ? (
        <div className="flex min-h-[80vh] items-center justify-center">
          <UiAdminLogin onSignedIn={api_loadSession} />
        </div>
      ) : null}

      {phase === 'blocked' ? (
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">
              Cannot start scanning
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{problem}</p>
            <button
              type="button"
              onClick={ui_handleSignOut}
              className="ui-btn-primary mt-7"
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'ready' && session ? (
        <UiScannerPanel
          showroom={session.showroom}
          email={session.email}
          initialTotal={session.totalScans}
          onSignOut={ui_handleSignOut}
        />
      ) : null}
    </main>
  );
}
