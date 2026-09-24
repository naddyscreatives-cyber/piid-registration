// FILE: lib/validation.js — Every registration field rule, in one place.
// Depends on: nothing (pure functions, safe to import from BOTH the browser
// component and the serverless route — the same rules run twice, so the client
// gives instant feedback and the server never trusts it).
// Spec reference: Section 3 (Validation Rules), Section 10 (error copy).

import { PROFESSIONS } from './professions';

// ===== SECTION: PRIMITIVES =====

/** Standard, deliberately permissive email shape. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** A value that is nothing but digits/punctuation is not a real name or city. */
const BARE_NUMERIC_RE = /^[\d\s.,\-_/]+$/;

/**
 * val_text — shared rule for Full Name, Firm/Company, City and the "Others" text.
 * @param {unknown} value Raw input.
 * @param {string} label  Field name used in the message, e.g. "Full name".
 * @returns {string|null} An error message, or null when valid.
 */
export function val_text(value, label) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return `${label} is required`;
  if (v.length < 2) return `${label} must be at least 2 characters`;
  if (v.length > 80) return `${label} must be 80 characters or fewer`;
  if (BARE_NUMERIC_RE.test(v)) return `Enter a valid ${label.toLowerCase()}`;
  return null;
}

/**
 * val_email — required, standard email shape.
 * @param {unknown} value Raw input.
 * @returns {string|null} An error message, or null when valid.
 */
export function val_email(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return 'Email address is required';
  if (v.length > 254) return 'That email address is too long';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  return null;
}

// ===== SECTION: PH MOBILE NUMBER =====

/**
 * val_normalizeMobile — reduces any PH mobile spelling to 11 digits: 09XXXXXXXXX.
 * Accepts 09xxxxxxxxx, +639xxxxxxxxx, 639xxxxxxxxx, 9xxxxxxxxx and any
 * spacing/dashes/parentheses in between.
 * @param {unknown} value Raw input.
 * @returns {string} Normalised number, or '' when it cannot be normalised.
 */
export function val_normalizeMobile(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;   // 639171234567
  if (/^09\d{9}$/.test(digits)) return digits;                   // 09171234567
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;              // 9171234567
  return '';
}

/**
 * val_mobile — required, must normalise to a valid PH mobile number.
 * @param {unknown} value Raw input.
 * @returns {string|null} An error message, or null when valid.
 */
export function val_mobile(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Mobile number is required';
  if (!val_normalizeMobile(raw)) return 'Enter a valid mobile number (e.g. 0917 123 4567)';
  return null;
}

/**
 * ui_formatMobileAsTyped — cosmetic grouping applied while the guest types.
 * Never used for storage; val_normalizeMobile handles that.
 * @param {string} value Current input value.
 * @returns {string} Display value, e.g. "0917 123 4567" or "+63 917 123 4567".
 */
export function ui_formatMobileAsTyped(value) {
  const raw = String(value ?? '');
  const plus = raw.trim().startsWith('+');
  let digits = raw.replace(/\D/g, '');

  if (plus || digits.startsWith('63')) {
    digits = digits.replace(/^63/, '').slice(0, 10);
    const g = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
    return `+63${g.length ? ` ${g.join(' ')}` : ''}`;
  }

  digits = digits.slice(0, 11);
  const g = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean);
  return g.join(' ');
}

// ===== SECTION: WHOLE-FORM VALIDATION =====

/**
 * val_registrationForm — runs every Section 3 rule over a form payload.
 * @param {object}  form                 The raw form values.
 * @param {string}  form.fullName
 * @param {string}  form.firmCompany
 * @param {string}  form.profession      One of PROFESSIONS.
 * @param {string}  form.professionOther Custom text, required when profession === "Others".
 * @param {string}  form.email
 * @param {string}  form.mobileNumber
 * @param {string}  form.cityArea
 * @param {boolean} form.consent
 * @returns {Record<string,string>} Map of fieldName → message. Empty object means valid.
 */
export function val_registrationForm(form) {
  const errors = {};

  const fullName = val_text(form.fullName, 'Full name');
  if (fullName) errors.fullName = fullName;

  const firm = val_text(form.firmCompany, 'Firm or company');
  if (firm) errors.firmCompany = firm;

  if (!form.profession) {
    errors.profession = 'Select your profession';
  } else if (!PROFESSIONS.includes(form.profession)) {
    errors.profession = 'Select a profession from the list';
  } else if (form.profession === 'Others') {
    const other = val_text(form.professionOther, 'Profession');
    if (other) errors.professionOther = other;
  }

  const email = val_email(form.email);
  if (email) errors.email = email;

  const mobile = val_mobile(form.mobileNumber);
  if (mobile) errors.mobileNumber = mobile;

  const city = val_text(form.cityArea, 'City or area');
  if (city) errors.cityArea = city;

  // Consent is a hard gate: no row is inserted without it (Spec 11).
  if (!form.consent) errors.consent = 'Please agree to continue';

  return errors;
}

/**
 * val_resolveProfession — collapses the dropdown + "Others" text into the single
 * string stored in registrants.profession.
 * @param {string} profession      Dropdown value.
 * @param {string} professionOther Custom text.
 * @returns {string} The value to store.
 */
export function val_resolveProfession(profession, professionOther) {
  return profession === 'Others' ? String(professionOther).trim() : profession;
}
