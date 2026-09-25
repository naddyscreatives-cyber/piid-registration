// FILE: app/page.js — The welcome page ("/"): event intro, partner logos, showroom route, Get Pass.
// Depends on: components/Brand, lib/brand. "Get Pass" leads to the registration form at /register.

import Link from 'next/link';
import { UiBackdrop, UiMasthead, UiLogoRow } from '@/components/Brand';
import { PARTNER_LOGOS, SHOWROOM_ROUTE } from '@/lib/brand';

/**
 * UiWelcomePage — centred card on the light canvas, matching the registration page.
 * @returns {JSX.Element}
 */
export default function UiWelcomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      <UiBackdrop />

      <div className="relative z-10 w-full max-w-xl">
        <UiMasthead />

        <section className="w-full animate-pop-in rounded-3xl bg-white px-6 py-9 text-center shadow-card sm:px-10 sm:py-11">
          <h1 className="ui-h1">
            A Journey Through Design
          </h1>

          {/* ===== SECTION: PARTNER LOGOS ===== */}
          <UiLogoRow logos={PARTNER_LOGOS} scale={0.55} gapClass="gap-x-3" className="mt-7 sm:hidden" />
          <UiLogoRow logos={PARTNER_LOGOS} scale={0.85} className="mt-8 hidden sm:flex" />

          {/* ===== SECTION: SHOWROOM ROUTE ===== */}
          <UiShowroomRoute />

          {/* ===== SECTION: WELCOME COPY ===== */}
          <div className="ui-body mx-auto mt-9 max-w-md space-y-3">
            <p>
              We&apos;re delighted to welcome you to the worlds of Poliform, Flexform, and Metrotiles.
            </p>
            <p>Register to receive your QR pass, then present it as you visit each showroom.</p>
          </div>

          <Link href="/register" className="ui-btn-primary mt-8 block text-center">
            Get Pass
          </Link>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Questions? Contact the event organisers before the day.
        </p>
      </div>
    </main>
  );
}

/**
 * UiShowroomRoute — the four N. Garcia stops on one line, with a walker between each.
 * @returns {JSX.Element}
 */
function UiShowroomRoute() {
  const last = SHOWROOM_ROUTE.length - 1;
  return (
    <ol className="mt-10 grid grid-cols-4" aria-label="Showroom route along N. Garcia">
      {SHOWROOM_ROUTE.map((stop, i) => (
        <li key={stop.number} className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-900 sm:text-sm">{stop.number}</span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[9px]">
            {stop.street}
          </span>

          {/* dot on the street line; a walker sits on the line between stops */}
          <span className="relative mt-1.5 flex h-4 w-full items-center justify-center">
            {i > 0 ? <span aria-hidden="true" className="absolute left-0 right-1/2 top-1/2 h-px bg-slate-300" /> : null}
            {i < last ? <span aria-hidden="true" className="absolute left-1/2 right-0 top-1/2 h-px bg-slate-300" /> : null}
            <span
              aria-hidden="true"
              className="relative h-3 w-3 rounded-full ring-4 ring-white"
              style={{ backgroundColor: stop.color }}
            />
            {i < last ? (
              <span
                aria-hidden="true"
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 bg-white px-1 text-slate-700"
              >
                <UiWalkerIcon />
              </span>
            ) : null}
          </span>

          <span
            className="mt-2.5 text-[9px] font-bold uppercase leading-snug tracking-[0.06em] sm:text-[11px] sm:tracking-[0.14em]"
            style={{ color: stop.color }}
          >
            {stop.label.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * UiWalkerIcon — a small walking figure between showroom stops.
 * @returns {JSX.Element}
 */
function UiWalkerIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
      <circle cx="6.5" cy="2" r="1.8" />
      <path d="M5.2 4.6c.4-.3 1-.4 1.5-.2l1.4.6c.4.2.7.5.8.9l.6 2.2 1.5.8a.8.8 0 0 1-.7 1.4l-1.8-.9a.9.9 0 0 1-.4-.5l-.3-1-.6 2.6 1.6 1.7c.2.2.3.4.3.6l.4 2.7a.8.8 0 0 1-1.6.2l-.4-2.4-1.9-1.9-.7 2.6a.9.9 0 0 1-.3.4L2.4 15.7a.8.8 0 0 1-1-1.2l2-1.9 1.2-5.1-.9.6-.6 1.8a.8.8 0 0 1-1.5-.5l.7-2.1c.1-.2.2-.4.4-.5z" />
    </svg>
  );
}
