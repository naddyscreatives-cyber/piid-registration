// FILE: lib/env.js — Single place that reads process.env, so a missing key fails
// loudly at the top of a request instead of as a confusing "undefined" deep inside a call.
// Depends on: the Vercel environment variables listed in Build Spec Section 12.

/**
 * env_require — reads a required server-side environment variable.
 * @param {string} name The variable name, e.g. "QR_SECRET".
 * @returns {string} The value.
 * @throws {Error} If the variable is missing or blank.
 */
export function env_require(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing environment variable ${name}. Add it in Vercel → Settings → Environment Variables (and in .env.local for local dev).`
    );
  }
  return String(value);
}

/**
 * env_optional — reads an optional environment variable.
 * @param {string} name         The variable name.
 * @param {string} [fallback''] Value to use when unset.
 * @returns {string} The value or the fallback.
 */
export function env_optional(name, fallback = '') {
  const value = process.env[name];
  return value && String(value).trim() ? String(value) : fallback;
}

/**
 * env_eventDetails — the human-facing event copy used in the ticket email.
 * @returns {{name: string, date: string, venue: string, siteUrl: string}}
 */
export function env_eventDetails() {
  return {
    name: env_optional('EVENT_NAME', 'Manila Interior Design Summit'),
    date: env_optional('EVENT_DATE', 'See your invitation for the schedule'),
    venue: env_optional('EVENT_VENUE', 'See your invitation for the venue'),
    siteUrl: env_optional('NEXT_PUBLIC_SITE_URL', ''),
  };
}
