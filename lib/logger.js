// FILE: lib/logger.js — Labeled runtime tracing for Vercel function logs.
// Depends on: nothing.
// Spec reference: Section 15 (Runtime tracing). On event day these are the lines
// you will be scanning in Vercel → Deployments → Functions → Logs.
//
// Output shape:  [CHECK-IN] duplicate scan for 8f3c… at Showroom 2

/**
 * log_line — writes one labeled line to the server console.
 * @param {string} label   Short uppercase channel, e.g. "REGISTER", "CHECK-IN", "EMAIL".
 * @param {string} message Human-readable message. Never include full PII — ids only.
 * @param {object} [extra] Optional structured fields appended as JSON.
 * @returns {void}
 */
export function log_line(label, message, extra) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[${label}] ${message}${suffix}`);
}

/**
 * log_error — writes one labeled error line to the server console.
 * @param {string} label   Short uppercase channel, e.g. "REGISTER".
 * @param {string} message What failed.
 * @param {unknown} [err]  The caught error; only its message is printed.
 * @returns {void}
 */
export function log_error(label, message, err) {
  const detail = err instanceof Error ? err.message : err ? String(err) : '';
  console.error(`[${label}] ERROR ${message}${detail ? ` :: ${detail}` : ''}`);
}

/**
 * log_shortId — trims a UUID to its first segment for readable log lines.
 * @param {string} id A UUID.
 * @returns {string} The first 8 characters, or "unknown".
 */
export function log_shortId(id) {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : 'unknown';
}
