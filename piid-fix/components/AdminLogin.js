// FILE: components/AdminLogin.js — Showroom admin sign-in screen ("ADMIN / ENTER PASSWORD").
// Depends on: lib/supabaseBrowser (Supabase Auth), components/FormFields.
// Spec reference: Section 4 (auth screen), Section 8 (Supabase Auth, one account per showroom).
//
// The admin does NOT pick their showroom here. It is read from their Supabase
// user metadata on the server after sign-in, so a scan can never be filed under
// the wrong showroom (Spec 8).

'use client';

import { useState } from 'react';
import { db_browserClient } from '@/lib/supabaseBrowser';
import { UiTextField } from './FormFields';

/**
 * UiAdminLogin — email + password sign-in for the four showroom accounts.
 * @param {{onSignedIn: Function}} props onSignedIn is called after a successful sign-in.
 * @returns {JSX.Element}
 */
export default function UiAdminLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * ui_handleSignIn — authenticates against Supabase Auth.
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function ui_handleSignIn(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const { error: authError } = await db_browserClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        // Supabase already rate-limits repeated failures on its auth endpoint.
        // "Invalid login credentials" is Supabase's answer to several very
        // different setup mistakes, so the hint names them rather than leaving
        // the operator guessing at a password they believe is correct.
        setError(
          /invalid/i.test(authError.message)
            ? 'Sign-in refused by Supabase ("invalid login credentials"). This usually means one of: the account was invited rather than created with a password; the account lives in a different Supabase project than this site is pointed at; or the password really is wrong. Open /api/health on this site to see which.'
            : authError.message
        );
        setBusy(false);
        return;
      }

      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in — check your connection.');
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-card sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[0.32em] text-piid-blue">Admin</p>
      <h1 className="mt-1 text-4xl font-extrabold leading-none tracking-tight text-slate-900">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        Use your showroom&apos;s account. Your showroom is set on the account itself — you
        will see it confirmed on the next screen before you scan.
      </p>

      <form noValidate onSubmit={ui_handleSignIn} className="mt-7 space-y-5">
        <UiTextField
          id="adminEmail"
          label="Showroom Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          disabled={busy}
        />
        <UiTextField
          id="adminPassword"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          disabled={busy}
        />

        {error ? (
          <div
            role="alert"
            className="animate-pop-in rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 ring-2 ring-rose-400"
          >
            {error}
          </div>
        ) : null}

        <button type="submit" className="ui-btn-primary" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
