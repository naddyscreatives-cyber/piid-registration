// FILE: lib/professions.js — The Profession / Position dropdown options.
// Depends on: nothing. Shared by the form component and the server validator so
// the two lists can never drift apart.
// Spec reference: Section 3, field 3.

/** @type {string[]} Dropdown options, in display order. */
export const PROFESSIONS = [
  'Interior Designer',
  'Architect',
  'Contractor',
  'Developer',
  'Student',
  'Others',
];

/** The option that reveals the conditional free-text field. */
export const PROFESSION_OTHER = 'Others';
