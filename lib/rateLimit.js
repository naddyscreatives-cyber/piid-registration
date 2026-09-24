// FILE: lib/rateLimit.js — In-memory token bucket for abuse prevention.
// Depends on: nothing.
// Spec reference: Section 9 (rate limiting on /api/register).
//
// SCOPE AND LIMITS: this bucket lives in one serverless instance's memory, so a
// determined attacker hitting many cold instances gets more attempts than the
// nominal limit. That is fine for its actual job — stopping casual bot floods
// and accidental double-submits without adding a paid dependency. If you see
// real, sustained bot traffic during testing, swap the store for Upstash Redis
// (drop-in: replace the Map reads/writes in rl_check) or add Cloudflare
// Turnstile to the form, per Spec 9.

/** @type {Map<string, {count: number, resetAt: number}>} key → window state */
const buckets = new Map();

/** Housekeeping: never let the map grow unbounded on a long-lived instance. */
const MAX_KEYS = 5000;

/**
 * rl_check — records a hit and reports whether it is allowed.
 * @param {string} key        Bucket identity, e.g. `register:${ip}`.
 * @param {number} limit      Maximum hits allowed inside the window.
 * @param {number} windowMs   Window length in milliseconds.
 * @returns {{allowed: boolean, remaining: number, retryAfterSeconds: number}}
 */
export function rl_check(key, limit, windowMs) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size > MAX_KEYS) rl_sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const allowed = existing.count <= limit;

  return {
    allowed,
    remaining,
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * rl_sweep — drops expired buckets.
 * @param {number} now Current epoch milliseconds.
 * @returns {void}
 */
function rl_sweep(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * rl_clientIp — best-effort client IP from the Vercel proxy headers.
 * @param {Request} request The incoming request.
 * @returns {string} An IP string, or "unknown".
 */
export function rl_clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
