// FILE: components/ScanStatusCard.js — The big status card under the scanner viewport.
// Depends on: app/globals.css (.ui-status--*).
// Spec reference: Section 4 (Scan Outcomes table), Section 10 (checking state, amber retry).
//
// ONE CARD, FIVE STATES — the whole point of this component is that an offline
// moment must never look like a rejected guest:
//   idle      neutral   "Ready to scan"
//   checking  neutral   "Checking…"          (previous result is cleared first)
//   valid     emerald   "WELCOME, {name}!"
//   duplicate rose      "ALREADY CHECKED IN" + original scan time
//   invalid   rose      "TICKET NOT RECOGNIZED" — no guest PII shown
//   error     amber     "COULD NOT VERIFY — RETRY" + a retry button

'use client';

/**
 * ui_formatScanTime — renders a timestamp in Manila local time.
 * @param {string|null} iso ISO timestamp from the database.
 * @returns {string} e.g. "2:41 PM" or '' when absent.
 */
function ui_formatScanTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * UiScanStatusCard — the high-contrast validation card.
 * @param {object}   props
 * @param {'idle'|'checking'|'valid'|'duplicate'|'invalid'|'error'} props.state Current outcome.
 * @param {string}   [props.firstName]  Guest's first name (valid / duplicate only).
 * @param {string}   [props.scannedAt]  ISO time of the original scan (duplicate only).
 * @param {string}   [props.message]    Extra copy, mainly for the error state.
 * @param {Function} [props.onRetry]    Called by the amber state's retry button.
 * @returns {JSX.Element}
 */
export default function UiScanStatusCard({ state, firstName, scannedAt, message, onRetry }) {
  // ===== SECTION: IDLE =====
  if (state === 'idle') {
    return (
      <div className="ui-status ui-status--idle" aria-live="polite">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Ready</p>
        <p className="mt-3 text-2xl font-bold text-slate-500">Point the camera at a QR ticket</p>
      </div>
    );
  }

  // ===== SECTION: CHECKING =====
  // The previous result is cleared before this renders, so an admin can never
  // act on stale feedback (Spec 10).
  if (state === 'checking') {
    return (
      <div className="ui-status ui-status--idle" aria-live="polite" aria-busy="true">
        <div className="flex items-center justify-center gap-3">
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500"
          />
          <p className="text-2xl font-bold text-slate-500">Checking…</p>
        </div>
      </div>
    );
  }

  // ===== SECTION: VALID =====
  if (state === 'valid') {
    return (
      <div className="ui-status ui-status--valid" role="status" aria-live="assertive">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white">
          &#10003;
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-emerald-700">
          Cleared for entry
        </p>
        <p className="mt-2 break-words text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-6xl">
          Welcome, {firstName}!
        </p>
      </div>
    );
  }

  // ===== SECTION: DUPLICATE (ALREADY SCANNED HERE) =====
  if (state === 'duplicate') {
    const time = ui_formatScanTime(scannedAt);
    return (
      <div className="ui-status ui-status--rejected" role="status" aria-live="assertive">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-3xl font-bold text-white">
          !
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-rose-700">
          {firstName ? `${firstName} is already in` : 'Already in'}
        </p>
        <p className="mt-2 text-3xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">
          Already checked in
        </p>
        {time ? (
          <p className="mt-4 text-base font-semibold text-rose-700">First scanned at {time}</p>
        ) : null}
      </div>
    );
  }

  // ===== SECTION: INVALID =====
  // Deliberately shows nothing about any guest — an unrecognised code must not
  // become a way to probe the guest list (Spec 4).
  if (state === 'invalid') {
    return (
      <div className="ui-status ui-status--rejected" role="status" aria-live="assertive">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-3xl font-bold text-white">
          &times;
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-rose-700">
          Not on the list
        </p>
        <p className="mt-2 text-3xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">
          Ticket not recognized
        </p>
        <p className="mt-4 text-sm font-medium text-rose-700">
          Send the guest to the registration desk.
        </p>
      </div>
    );
  }

  // ===== SECTION: ERROR / RETRY (AMBER) =====
  return (
    <div className="ui-status ui-status--retry" role="alert" aria-live="assertive">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-3xl font-bold text-white">
        ?
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
        Connection problem
      </p>
      <p className="mt-2 text-3xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">
        Could not verify — retry
      </p>
      <p className="mt-3 text-sm font-medium text-amber-800">
        {message || 'This is a network issue, not a rejected guest. Try the same code again.'}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-amber-600"
        >
          Retry scan
        </button>
      ) : null}
    </div>
  );
}
