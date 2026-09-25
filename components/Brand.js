// FILE: components/Brand.js — Shared brand pieces: page backdrop, event masthead, linked logo rows.
// Depends on: lib/brand.js, public/logos/*.

import { EVENT_NAME } from '@/lib/brand';

/**
 * UiBackdrop — the soft blue / magenta / orange wash behind every guest page.
 * @returns {JSX.Element}
 */
export function UiBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-piid-blue/20 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-piid-magenta/15 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-piid-orange/15 blur-3xl" />
    </div>
  );
}

/**
 * UiMasthead — the four brand dots stacked above the event name.
 * @returns {JSX.Element}
 */
export function UiMasthead() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
      <div aria-hidden="true" className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-piid-blue" />
        <span className="h-2 w-2 rounded-full bg-piid-magenta" />
        <span className="h-2 w-2 rounded-full bg-piid-orange" />
        <span className="h-2 w-2 rounded-full bg-piid-emerald" />
      </div>
      <p className="ui-eyebrow text-slate-500">{EVENT_NAME}</p>
    </div>
  );
}

/**
 * UiLogoRow — a centred row of logos, each opening its link in a new tab.
 * @param {{logos: Array, className?: string, scale?: number, gapClass?: string}} props
 * @returns {JSX.Element}
 */
export function UiLogoRow({ logos, className = '', scale = 1, gapClass = 'gap-x-6 sm:gap-x-8' }) {
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-y-4 ${gapClass} ${className}`}>
      {logos.map((logo) => {
        const h = Math.round(logo.height * scale);
        return (
          <li key={logo.key}>
            <a
              href={logo.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${logo.name} (opens in a new tab)`}
              className="block rounded-md opacity-90 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo.src}
                alt={logo.name}
                width={Math.round(h * logo.ratio)}
                height={h}
                style={{ height: h, width: 'auto' }}
                className="block"
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
