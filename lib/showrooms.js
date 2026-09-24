// FILE: lib/showrooms.js — The canonical list of showroom names.
// Depends on: nothing. Imported by both server routes and client components,
// so the string stored in showroom_logs.showroom_name can never drift from the UI.

/** @type {string[]} The four showrooms, exactly as they are written to the database. */
export const SHOWROOMS = ['Showroom 1', 'Showroom 2', 'Showroom 3', 'Showroom 4'];

/**
 * val_isKnownShowroom — checks a showroom name against the canonical list.
 * @param {unknown} name Candidate showroom name.
 * @returns {boolean} True when the name is one of the four showrooms.
 */
export function val_isKnownShowroom(name) {
  return typeof name === 'string' && SHOWROOMS.includes(name);
}
