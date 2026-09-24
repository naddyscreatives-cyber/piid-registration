// FILE: app/page.js — The public registration page ("/"), the guest-facing entry point.
// Depends on: components/RegistrationForm.
// Spec reference: Section 3 (Registrant Interface), Section 2 (centered card layout).

import RegistrationForm from '@/components/RegistrationForm';

/**
 * UiRegisterPage — centered card layout on the light neutral canvas.
 * @returns {JSX.Element}
 */
export default function UiRegisterPage() {
  const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || 'PIID Summit';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      {/* ===== SECTION: BACKGROUND WASH ("New Worlds" accents) ===== */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-piid-blue/20 blur-3xl" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-piid-magenta/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-piid-orange/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* ===== SECTION: EVENT MASTHEAD ===== */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="h-2 w-2 rounded-full bg-piid-blue" />
          <span className="h-2 w-2 rounded-full bg-piid-magenta" />
          <span className="h-2 w-2 rounded-full bg-piid-orange" />
          <span className="h-2 w-2 rounded-full bg-piid-emerald" />
          <p className="ml-1 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
            {eventName}
          </p>
        </div>

        <RegistrationForm />

        <p className="mt-6 text-center text-xs text-slate-400">
          Questions? Contact the event organisers before the day.
        </p>
      </div>
    </main>
  );
}
