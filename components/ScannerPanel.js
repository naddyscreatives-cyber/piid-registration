// FILE: components/ScannerPanel.js — Live camera scanner + check-in result for one showroom.
// Depends on: html5-qrcode (dynamically imported, browser-only), lib/supabaseBrowser,
//             components/ScanStatusCard, POST /api/check-in.
// Spec reference: Section 4 (layout + scan outcomes), Section 10 (checking / amber retry).
//
// LIFECYCLE NOTES
//  - html5-qrcode touches window/navigator, so it is imported inside useEffect,
//    never at module scope (that would break the server render).
//  - After a decode the camera is paused, not stopped: resuming is instant, and
//    pausing stops the same ticket firing twenty times a second.
//  - Every scan sends the guest's token plus the admin's Supabase access token.
//    The showroom itself is never sent from here — the server reads it from the
//    session, so this UI cannot mis-file a scan (Spec 8).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { db_browserClient } from '@/lib/supabaseBrowser';
import UiScanStatusCard from './ScanStatusCard';

/** DOM id html5-qrcode renders the video element into. */
const SCANNER_REGION_ID = 'piid-scanner-region';

/** How long a result stays on screen before the scanner re-arms itself. */
const RESULT_HOLD_MS = 3200;

/**
 * UiScannerPanel — the admin's working screen.
 * @param {object} props
 * @param {string} props.showroom   Showroom name confirmed by the server.
 * @param {string} props.email      Signed-in admin's email, shown in the header.
 * @param {number} props.initialTotal Running check-in count for this showroom.
 * @param {Function} props.onSignOut Called when the admin signs out.
 * @returns {JSX.Element}
 */
export default function UiScannerPanel({ showroom, email, initialTotal, onSignOut }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState({ state: 'idle' });
  const [total, setTotal] = useState(initialTotal ?? 0);

  const scannerRef = useRef(null);      // Html5Qrcode instance
  const busyRef = useRef(false);        // guards against overlapping check-ins
  const lastTokenRef = useRef(null);    // last token sent, for the retry button
  const holdTimerRef = useRef(null);    // re-arm timer

  // ===== SECTION: CHECK-IN REQUEST =====

  /**
   * api_submitScan — sends one scanned token to /api/check-in and maps the
   * answer onto the status card states.
   * @param {string} qrToken The decoded QR string.
   * @returns {Promise<void>}
   */
  const api_submitScan = useCallback(
    async (qrToken) => {
      if (busyRef.current) return;
      busyRef.current = true;
      lastTokenRef.current = qrToken;

      // Clear the previous result first — never leave stale feedback on screen.
      setResult({ state: 'checking' });

      try {
        const { data } = await db_browserClient().auth.getSession();
        const accessToken = data?.session?.access_token;
        if (!accessToken) {
          onSignOut?.();
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        const response = await fetch('/api/check-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ qrToken }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          onSignOut?.();
          return;
        }

        if (!response.ok) {
          // A server or network problem is amber, never rose (Spec 10).
          setResult({ state: 'error', message: payload?.message });
          return;
        }

        if (payload.status === 'valid') {
          setResult({ state: 'valid', firstName: payload.firstName });
          if (typeof payload.totalScans === 'number') setTotal(payload.totalScans);
        } else if (payload.status === 'duplicate') {
          setResult({
            state: 'duplicate',
            firstName: payload.firstName,
            scannedAt: payload.scannedAt,
          });
          if (typeof payload.totalScans === 'number') setTotal(payload.totalScans);
        } else {
          setResult({ state: 'invalid' });
        }
      } catch {
        setResult({ state: 'error' });
      } finally {
        busyRef.current = false;

        // Re-arm the camera after the result has been on screen long enough to read.
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
          setResult({ state: 'idle' });
          try {
            scannerRef.current?.resume?.();
          } catch {
            /* camera already stopped — nothing to resume */
          }
        }, RESULT_HOLD_MS);
      }
    },
    [onSignOut]
  );

  // ===== SECTION: CAMERA LIFECYCLE =====

  useEffect(() => {
    if (!cameraOn) return undefined;

    let cancelled = false;
    let instance = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        instance = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (decodedText) => {
            try {
              instance.pause(true);
            } catch {
              /* already paused */
            }
            api_submitScan(decodedText);
          },
          () => {
            /* per-frame "no QR found" — deliberately ignored, it fires constantly */
          }
        );
        if (cancelled) {
          await instance.stop().catch(() => {});
        }
      } catch (err) {
        if (cancelled) return;
        setCameraOn(false);
        setCameraError(
          err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access for this site in your browser settings, then start the scanner again.'
            : 'Could not start the camera. Check that no other app is using it, then try again.'
        );
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(holdTimerRef.current);
      const active = scannerRef.current;
      scannerRef.current = null;
      if (active) {
        active
          .stop()
          .then(() => active.clear())
          .catch(() => {});
      }
    };
  }, [cameraOn, api_submitScan]);

  // ===== SECTION: RENDER =====
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* ----- header: which showroom am I? ----- */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-card">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-piid-blue">Scanning for</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-none tracking-tight text-slate-900">
            {showroom}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">{email}</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Checked in</p>
            <p className="text-3xl font-extrabold tabular-nums text-piid-emerald">{total}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 transition-all duration-300 hover:border-slate-300 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ----- upper / left viewport: the camera ----- */}
        <section className="rounded-3xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
              Live camera scanner
            </p>
            <span
              className={`h-2.5 w-2.5 rounded-full ${cameraOn ? 'animate-pulse bg-piid-emerald' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-slate-900">
            <div id={SCANNER_REGION_ID} className="min-h-[260px] w-full" />

            {!cameraOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center">
                <p className="text-sm font-medium text-slate-400">Camera is off</p>
                <button
                  type="button"
                  onClick={() => {
                    setCameraError('');
                    setCameraOn(true);
                  }}
                  aria-label="Start the camera scanner"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-piid-blue text-4xl font-light text-white shadow-card transition-all duration-300 hover:scale-105 hover:bg-blue-600"
                >
                  +
                </button>
                <p className="text-xs text-slate-500">Tap to activate</p>
              </div>
            ) : null}
          </div>

          {cameraOn ? (
            <button
              type="button"
              onClick={() => setCameraOn(false)}
              className="mt-4 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 transition-all duration-300 hover:border-slate-300 hover:text-slate-700"
            >
              Stop camera
            </button>
          ) : null}

          {cameraError ? (
            <p role="alert" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-2 ring-amber-400">
              {cameraError}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Camera access needs HTTPS — it works on your Vercel URL and on localhost, but not
            over a plain http:// address.
          </p>
        </section>

        {/* ----- lower / right viewport: the verdict ----- */}
        <section className="flex flex-col justify-center">
          <UiScanStatusCard
            state={result.state}
            firstName={result.firstName}
            scannedAt={result.scannedAt}
            message={result.message}
            onRetry={() => {
              if (lastTokenRef.current) api_submitScan(lastTokenRef.current);
            }}
          />
        </section>
      </div>
    </div>
  );
}
