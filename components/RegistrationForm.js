// FILE: components/RegistrationForm.js — The guest-facing registration card and every one of its states.
// Depends on: components/FormFields, lib/validation, lib/professions, POST /api/register.
// Spec reference: Section 3 (fields + rules), Section 10 (Registration Form States table), Section 11 (consent).
//
// STATE MACHINE
//   editing  → the form. Field errors appear inline, under the field that failed.
//   sending  → Submit disabled + spinner; entered data is never cleared.
//   success  → the success card, with a note when the ticket email did not send.
// A network/server failure returns to "editing" with an amber banner above Submit
// and every value still in place.

'use client';

import { useMemo, useState } from 'react';
import { UiTextField, UiSelectField, UiConsentCheckbox } from './FormFields';
import { PROFESSIONS, PROFESSION_OTHER } from '@/lib/professions';
import { val_registrationForm, ui_formatMobileAsTyped } from '@/lib/validation';
import { UiLogoRow } from './Brand';
import { PARTNER_LOGOS, SOCIAL_LOGOS, EVENT_NAME } from '@/lib/brand';

/** The empty form. Kept at module scope so a reset is one assignment. */
const EMPTY_FORM = {
  fullName: '',
  firmCompany: '',
  profession: '',
  professionOther: '',
  email: '',
  mobileNumber: '',
  cityArea: '',
  consent: false,
  website: '', // honeypot — hidden from humans, filled only by bots (Spec 9)
};

/**
 * UiRegistrationForm — the whole registration experience.
 * @returns {JSX.Element}
 */
export default function UiRegistrationForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [phase, setPhase] = useState('editing');   // editing | sending | success
  const [banner, setBanner] = useState('');        // amber network/server message
  const [result, setResult] = useState(null);      // {firstName, emailSent, qrDataUrl}

  const isOthers = form.profession === PROFESSION_OTHER;
  const isSending = phase === 'sending';

  // Submit stays disabled until every rule passes (Spec 10 — field validation row).
  const liveErrors = useMemo(() => val_registrationForm(form), [form]);
  const isComplete = Object.keys(liveErrors).length === 0;

  // ===== SECTION: FIELD HANDLERS =====

  /**
   * ui_setField — updates one field and clears its error as the guest fixes it.
   * @param {string} name  Field key.
   * @param {any}    value New value.
   * @returns {void}
   */
  function ui_setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    if (banner) setBanner('');
  }

  /**
   * ui_handleBlur — validates a single field when the guest leaves it.
   * @param {string} name Field key.
   * @returns {void}
   */
  function ui_handleBlur(name) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const all = val_registrationForm(form);
    setErrors((prev) => ({ ...prev, [name]: all[name] }));
  }

  /**
   * ui_errorFor — shows a field's error only once it has been touched or submitted.
   * @param {string} name Field key.
   * @returns {string|null} Message to display.
   */
  function ui_errorFor(name) {
    return errors[name] ?? null;
  }

  // ===== SECTION: SUBMIT =====

  /**
   * ui_handleSubmit — validates, posts to /api/register and routes the response
   * into the matching state from the Spec 10 table.
   * @param {React.FormEvent} event The form submit event.
   * @returns {Promise<void>}
   */
  async function ui_handleSubmit(event) {
    event.preventDefault();
    if (isSending) return;

    const found = val_registrationForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));
      // Move focus to the first problem so keyboard users are not stranded.
      const first = document.getElementById(Object.keys(found)[0]);
      first?.focus();
      return;
    }

    setPhase('sending');
    setBanner('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      // ----- duplicate email, or server-side validation disagreement -----
      if (!response.ok) {
        if (data?.fieldErrors) {
          setErrors(data.fieldErrors);
          const first = document.getElementById(Object.keys(data.fieldErrors)[0]);
          first?.focus();
        } else {
          setBanner(data?.message || 'Something went wrong — please try again.');
        }
        setPhase('editing');
        return;
      }

      // ----- success (email may or may not have gone out) -----
      setResult({
        firstName: data.firstName,
        emailSent: Boolean(data.emailSent),
        qrDataUrl: data.qrDataUrl ?? null,
      });
      setPhase('success');
    } catch {
      // Network failure: keep every value, re-enable Submit (Spec 10).
      setBanner('Something went wrong — please try again.');
      setPhase('editing');
    }
  }

  // ===== SECTION: SUCCESS CARD =====
  if (phase === 'success' && result) {
    return <UiSuccessCard result={result} />;
  }

  // ===== SECTION: FORM =====
  return (
    <form
      noValidate
      onSubmit={ui_handleSubmit}
      className="w-full rounded-3xl bg-white p-6 shadow-card sm:p-9"
    >
      {/* ===== SECTION: PARTNER LOGOS ===== */}
      <UiLogoRow logos={PARTNER_LOGOS} scale={0.55} gapClass="gap-x-3" className="mb-7 border-b border-slate-100 pb-6 sm:hidden" />
      <UiLogoRow logos={PARTNER_LOGOS} scale={0.85} className="mb-8 hidden border-b border-slate-100 pb-7 sm:flex" />

      <div className="mb-7">
        <p className="ui-eyebrow text-piid-blue">Welcome</p>
        <h1 className="ui-h1 mt-1">
          Register now
        </h1>
        <p className="ui-body mt-3">
          Please register to receive your digital QR pass and present it for check-in at each showroom.
        </p>
      </div>

      <div className="space-y-5">
        <UiTextField
          id="fullName"
          label="Full Name"
          autoComplete="name"
          value={form.fullName}
          onChange={(v) => ui_setField('fullName', v)}
          onBlur={() => ui_handleBlur('fullName')}
          error={ui_errorFor('fullName')}
          disabled={isSending}
        />

        <UiTextField
          id="firmCompany"
          label="Interior Design Firm / Company"
          autoComplete="organization"
          value={form.firmCompany}
          onChange={(v) => ui_setField('firmCompany', v)}
          onBlur={() => ui_handleBlur('firmCompany')}
          error={ui_errorFor('firmCompany')}
          disabled={isSending}
        />

        <UiSelectField
          id="profession"
          label="Profession / Position"
          options={PROFESSIONS}
          value={form.profession}
          onChange={(v) => ui_setField('profession', v)}
          error={ui_errorFor('profession')}
          disabled={isSending}
        />

        {/* Conditional field — renders immediately below the dropdown (Spec 3, field 4) */}
        {isOthers ? (
          <div className="animate-pop-in">
            <UiTextField
              id="professionOther"
              label="Please specify your profession"
              value={form.professionOther}
              onChange={(v) => ui_setField('professionOther', v)}
              onBlur={() => ui_handleBlur('professionOther')}
              error={ui_errorFor('professionOther')}
              disabled={isSending}
            />
          </div>
        ) : null}

        <UiTextField
          id="email"
          label="Email Address"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={(v) => ui_setField('email', v)}
          onBlur={() => ui_handleBlur('email')}
          error={ui_errorFor('email')}
          disabled={isSending}
          hint="Your QR ticket is sent here."
        />

        <UiTextField
          id="mobileNumber"
          label="Mobile Number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.mobileNumber}
          onChange={(v) => ui_setField('mobileNumber', ui_formatMobileAsTyped(v))}
          onBlur={() => ui_handleBlur('mobileNumber')}
          error={ui_errorFor('mobileNumber')}
          disabled={isSending}
          hint="Philippine mobile, e.g. 0917 123 4567"
        />

        <UiTextField
          id="cityArea"
          label="City or Area of Practice"
          autoComplete="address-level2"
          value={form.cityArea}
          onChange={(v) => ui_setField('cityArea', v)}
          onBlur={() => ui_handleBlur('cityArea')}
          error={ui_errorFor('cityArea')}
          disabled={isSending}
        />

        <UiConsentCheckbox
          checked={form.consent}
          onChange={(v) => ui_setField('consent', v)}
          error={ui_errorFor('consent')}
          disabled={isSending}
        />

        {/* ===== SECTION: HONEYPOT =====
            Off-screen and hidden from assistive tech. A human never fills this in;
            a naive bot fills every field it finds (Spec 9). */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
          <label htmlFor="website">Leave this field empty</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => ui_setField('website', e.target.value)}
          />
        </div>
      </div>

      {/* ===== SECTION: NETWORK / SERVER BANNER (amber) ===== */}
      {banner ? (
        <div
          role="alert"
          className="mt-6 animate-pop-in rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-2 ring-amber-400"
        >
          {banner}
        </div>
      ) : null}

      <div className="mt-7">
        <button type="submit" className="ui-btn-primary" disabled={isSending || !isComplete}>
          {isSending ? (
            <span className="flex items-center justify-center gap-3">
              <UiSpinner />
              Submitting
            </span>
          ) : (
            'Submit'
          )}
        </button>
        {!isComplete && Object.keys(touched).length > 0 ? (
          <p className="mt-3 text-center text-xs text-slate-400">
            Complete every field above to enable Submit.
          </p>
        ) : null}
      </div>
    </form>
  );
}

// ===== SECTION: SUB-COMPONENTS =====

/**
 * UiSpinner — small inline loading indicator for the Submit button.
 * @returns {JSX.Element}
 */
function UiSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

/**
 * UiSuccessCard — shown after a successful registration.
 * Success is NEVER blocked on email delivery; when the send failed the copy
 * changes and the on-screen QR becomes the guest's ticket (Spec 6, Spec 10).
 * @param {{result: {firstName: string, emailSent: boolean, qrDataUrl: string|null}}} props
 * @returns {JSX.Element}
 */
function UiSuccessCard({ result }) {
  return (
    <div className="w-full animate-pop-in rounded-3xl bg-white p-7 text-center shadow-card sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
        &#10003;
      </div>

      <p className="ui-eyebrow mt-6 text-emerald-600">
        You&apos;re registered
      </p>
      <h1 className="ui-h1 mt-2">
        Welcome, {result.firstName}!
      </h1>

      {result.emailSent ? (
        <p className="ui-body mx-auto mt-4 max-w-sm">
          Your QR ticket is on its way to your inbox. Screenshot it now — venue signal
          can be unreliable on the day.
        </p>
      ) : (
        <div
          role="alert"
          className="mx-auto mt-5 max-w-sm rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-900 ring-2 ring-amber-400"
        >
          You&apos;re registered! We couldn&apos;t send your ticket email — please save the QR
          code below, or check with the registration desk.
        </div>
      )}

      {result.qrDataUrl ? (
        <div className="mt-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.qrDataUrl}
            alt={`Your ${EVENT_NAME} QR pass`}
            className="mx-auto h-56 w-56 rounded-2xl border-2 border-slate-200 bg-white p-3 sm:h-64 sm:w-64"
          />
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Screenshot this code — it is your ticket for every showroom.
          </p>
        </div>
      ) : null}

      {/* ===== SECTION: FOLLOW US ===== */}
      <div className="mx-auto mt-7 max-w-[17rem] rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
        <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
          <UiInstagramIcon />
          Follow us
        </p>
        <ul className="mt-3 grid grid-cols-2 divide-x divide-slate-200">
          {SOCIAL_LOGOS.map((logo) => (
            <li key={logo.key}>
              <a
                href={logo.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow ${logo.name} on Instagram (opens in a new tab)`}
                className="group flex flex-col items-center gap-1.5 px-2 transition-all duration-300 ease-in-out hover:-translate-y-0.5"
              >
                <span className="flex h-6 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.src}
                    alt={logo.name}
                    width={Math.round(logo.height * 0.7 * logo.ratio)}
                    height={Math.round(logo.height * 0.7)}
                    style={{ height: Math.round(logo.height * 0.7), width: 'auto' }}
                  />
                </span>
                <span className="text-[11px] font-medium text-slate-500 transition-colors duration-300 group-hover:text-slate-700">{logo.handle}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6">
        <p className="text-xs leading-relaxed text-slate-400">
          Registering someone else?{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-semibold text-piid-blue underline underline-offset-2 transition-all duration-300 hover:text-blue-700"
          >
            Start a new registration
          </button>
        </p>
      </div>
    </div>
  );
}

/**
 * UiInstagramIcon — small outline Instagram glyph for the follow box.
 * @returns {JSX.Element}
 */
function UiInstagramIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
