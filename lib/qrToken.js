// FILE: lib/qrToken.js — Signed QR token creation, verification and PNG rendering.
// Depends on: node:crypto, qrcode (npm), QR_SECRET.
// Spec reference: Section 7 (QR Code Generation & Security).
//
// WHY SIGNED: a raw UUID in a QR code is guessable and copyable — anyone who
// sees one ticket learns the format. Here the QR encodes "<uuid>.<hmac>", so a
// forged code fails the signature check before the database is ever touched.

import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { env_require } from './env';

/** Token version prefix — lets a future format change be detected, not silently mis-parsed. */
const TOKEN_VERSION = 'v1';

// ===== SECTION: TOKEN CREATION =====

/**
 * qr_sign — HMAC-SHA256 signature for one registrant id.
 * @param {string} registrantId The registrant UUID.
 * @returns {string} base64url signature.
 */
function qr_sign(registrantId) {
  return crypto
    .createHmac('sha256', env_require('QR_SECRET'))
    .update(`${TOKEN_VERSION}:${registrantId}`)
    .digest('base64url');
}

/**
 * qr_createToken — builds the signed token stored in registrants.qr_token and
 * encoded into the guest's QR image.
 * @param {string} registrantId The registrant UUID.
 * @returns {string} A token of the form "v1.<uuid>.<signature>".
 */
export function qr_createToken(registrantId) {
  return `${TOKEN_VERSION}.${registrantId}.${qr_sign(registrantId)}`;
}

// ===== SECTION: QR TOKEN VERIFICATION =====

/**
 * qr_verifyToken — checks a scanned string's shape and signature.
 * Runs before any database lookup, so garbage and forged codes cost nothing.
 * @param {unknown} token The raw string decoded from the camera.
 * @returns {{valid: boolean, registrantId: string|null}}
 */
export function qr_verifyToken(token) {
  if (typeof token !== 'string') return { valid: false, registrantId: null };

  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return { valid: false, registrantId: null };

  const [version, registrantId, signature] = parts;
  if (version !== TOKEN_VERSION) return { valid: false, registrantId: null };

  const expected = qr_sign(registrantId);

  // Constant-time compare — a plain === leaks timing information about the secret.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { valid: false, registrantId: null };
  if (!crypto.timingSafeEqual(a, b)) return { valid: false, registrantId: null };

  return { valid: true, registrantId };
}

// ===== SECTION: QR IMAGE RENDERING =====

/**
 * qr_renderPngBuffer — renders a token as a PNG for the ticket email attachment.
 * @param {string} token The signed token.
 * @returns {Promise<Buffer>} PNG image bytes.
 */
export async function qr_renderPngBuffer(token) {
  return QRCode.toBuffer(token, {
    type: 'png',
    errorCorrectionLevel: 'M',   // survives a phone screen photographed off a laptop
    margin: 2,
    width: 640,                  // large enough to scan from a dimmed phone screen
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/**
 * qr_renderDataUrl — renders a token as a data: URL for on-screen display
 * on the registration success card.
 * @param {string} token The signed token.
 * @returns {Promise<string>} "data:image/png;base64,…"
 */
export async function qr_renderDataUrl(token) {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 720,                  // crisp when downloaded or shown full-width
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}
