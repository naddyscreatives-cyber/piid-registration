// FILE: components/FormFields.js — Reusable floating-label form controls.
// Depends on: app/globals.css (.ui-field / .ui-input / .ui-label / .ui-error).
// Spec reference: Section 2 (floating label animation, accessibility), Section 10 (inline errors).
//
// NAMING NOTE (applies to every component in this project): React only treats a
// JSX tag as a component when its name starts with a capital letter — <ui_TextField />
// would silently render as an unknown HTML element. So React components use the
// "Ui" prefix (UiTextField), while non-component UI helpers keep the spec's
// ui_ prefix (ui_setField, ui_handleSubmit). Searching "ui" still finds both.
//
// ACCESSIBILITY NOTE: the "floating label" is a real <label htmlFor>, not a
// decorative span. It stays in the accessibility tree, so a screen reader and a
// tabbing admin both get the field name. Errors are wired with aria-describedby
// and aria-invalid, and announced with role="alert".

'use client';

/**
 * UiFieldError — the inline message shown directly under a field.
 * @param {{id: string, message?: string|null}} props
 * @returns {JSX.Element|null} The message, or null when the field is valid.
 */
export function UiFieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="ui-error">
      <span aria-hidden="true" className="mt-px leading-none">
        &#9888;
      </span>
      <span>{message}</span>
    </p>
  );
}

/**
 * UiTextField — a single-line input with a floating label and inline error.
 * @param {object}   props
 * @param {string}   props.id           DOM id, also the label's htmlFor target.
 * @param {string}   props.label        Visible field name.
 * @param {string}   props.value        Controlled value.
 * @param {Function} props.onChange     Receives the new string value.
 * @param {Function} [props.onBlur]     Called on blur, for validate-on-blur.
 * @param {string}   [props.type]       HTML input type. Default "text".
 * @param {string}   [props.inputMode]  Mobile keyboard hint.
 * @param {string}   [props.autoComplete]
 * @param {string|null} [props.error]   Inline error message.
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.hint]       Small helper text under the field.
 * @returns {JSX.Element}
 */
export function UiTextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  inputMode,
  autoComplete,
  error,
  disabled = false,
  hint,
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="ui-field">
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={`peer ui-input ${error ? 'ui-input--error' : ''}`}
        placeholder=" "
        value={value}
        disabled={disabled}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <label htmlFor={id} className="ui-label">
        {label}
      </label>
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 pl-1 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
      <UiFieldError id={errorId} message={error} />
    </div>
  );
}

/**
 * UiSelectField — a dropdown with a permanently raised label.
 * @param {object}   props
 * @param {string}   props.id
 * @param {string}   props.label
 * @param {string}   props.value
 * @param {Function} props.onChange   Receives the new string value.
 * @param {string[]} props.options    Option values, used as both value and text.
 * @param {string}   [props.placeholder] Text for the empty option.
 * @param {string|null} [props.error]
 * @param {boolean}  [props.disabled]
 * @returns {JSX.Element}
 */
export function UiSelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select one…',
  error,
  disabled = false,
}) {
  const errorId = `${id}-error`;
  return (
    <div className="ui-field">
      <select
        id={id}
        name={id}
        className={`ui-input appearance-none bg-no-repeat pr-12 ${
          error ? 'ui-input--error' : ''
        } ${value ? 'text-slate-900' : 'text-slate-400'}`}
        // The chevron is set in inline style, not utility classes: Tailwind's
        // arbitrary background-position syntax is easy to get subtly wrong, and
        // a mis-parsed value drops the arrow on top of the floating label.
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5' stroke='%2394a3b8' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 1rem center',
          backgroundSize: '18px 18px',
        }}
        value={value}
        disabled={disabled}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option} className="text-slate-900">
            {option}
          </option>
        ))}
      </select>
      <label htmlFor={id} className="ui-label--static">
        {label}
      </label>
      <UiFieldError id={errorId} message={error} />
    </div>
  );
}

/**
 * UiConsentCheckbox — the required data-privacy consent control.
 * @param {object}   props
 * @param {boolean}  props.checked
 * @param {Function} props.onChange  Receives the new boolean.
 * @param {string|null} [props.error]
 * @param {boolean}  [props.disabled]
 * @returns {JSX.Element}
 */
export function UiConsentCheckbox({ checked, onChange, error, disabled = false }) {
  return (
    <div>
      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-slate-300 text-piid-blue accent-piid-blue transition-all duration-300"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'consent-error' : 'consent-notice'}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div>
          <label htmlFor="consent" className="cursor-pointer text-sm font-medium leading-snug text-slate-700">
            I agree to the collection of my information for event registration and check-in purposes.
          </label>
          {/* Privacy notice — Build Spec Section 11 */}
          <p id="consent-notice" className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Your details are used only for registration, showroom check-in and event
            communication. They are not shared beyond the event organisers.
          </p>
        </div>
      </div>
      <UiFieldError id="consent-error" message={error} />
    </div>
  );
}
