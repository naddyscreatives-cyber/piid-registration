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
        setError(
          /invalid/i.test(authError.message)
            ? 'That email and password combination was not recognised.'
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
      <p className="ui-eyebrow text-piid-blue">Admin</p>
      <h1 className="ui-h1 mt-1">
        Sign in
      </h1>
      <p className="ui-body mt-3">
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
