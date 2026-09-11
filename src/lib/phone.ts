// Phone number handling for Healvo's India-first launch.
//
// Storage format: patient/visit phone fields always hold a normalized,
// country-coded string with no spaces, e.g. "+919876543210" — the same
// shape E.164 numbers use for any country. Normalization happens once,
// at the point a patient record is created or updated (see
// state/clinicData.tsx). Every screen that *displays* a phone number
// formats this stored value on the fly via formatPhoneDisplay — no
// screen should hand-roll its own "+91" prefixing.
//
// Only India is supported today, so the country code is fixed. Adding
// other countries later only means teaching normalizePhone/formatPhoneDisplay
// about another prefix — the storage format and every call site stay the same.

export const DEFAULT_COUNTRY_CODE = "+91";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalizes raw user input (with or without +91, spaces, dashes) into the
 * canonical storage form "+91XXXXXXXXXX". Returns "" for empty input.
 */
export function normalizePhone(
  input: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string {
  const digits = digitsOnly(input);
  if (!digits) return "";

  const countryDigits = digitsOnly(countryCode);
  if (digits.startsWith(countryDigits) && digits.length > 10) {
    return `+${digits}`;
  }
  return `+${countryDigits}${digits}`;
}

/**
 * Formats a stored (or raw) phone number for display as "+91 XXXXX XXXXX".
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = digitsOnly(phone);
  if (!digits) return "";

  const countryDigits = digitsOnly(DEFAULT_COUNTRY_CODE);
  const local = digits.startsWith(countryDigits) && digits.length > 10
    ? digits.slice(countryDigits.length)
    : digits;

  if (local.length === 10) {
    return `+${countryDigits} ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return `+${countryDigits} ${local}`;
}

/**
 * True when `query` (a name or a phone number, in any formatting) refers to
 * the same phone number as `storedPhone`, ignoring spaces/dashes and an
 * optional leading country code on either side.
 */
export function phoneMatches(storedPhone: string, query: string): boolean {
  const queryDigits = digitsOnly(query);
  if (!queryDigits) return false;

  const countryDigits = digitsOnly(DEFAULT_COUNTRY_CODE);
  const storedDigits = digitsOnly(storedPhone);
  const storedLocal = storedDigits.startsWith(countryDigits)
    ? storedDigits.slice(countryDigits.length)
    : storedDigits;
  const queryLocal = queryDigits.startsWith(countryDigits)
    ? queryDigits.slice(countryDigits.length)
    : queryDigits;

  return storedLocal.includes(queryLocal) || storedDigits.includes(queryDigits);
}

/** Prototype-level validation for a 10-digit Indian mobile number. */
export function isValidIndianMobile(localNumber: string): boolean {
  return /^[6-9]\d{9}$/.test(digitsOnly(localNumber));
}
