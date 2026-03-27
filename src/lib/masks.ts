/**
 * Phone mask & validation utilities (Brazilian format)
 */

/** Apply Brazilian phone mask: (XX) XXXXX-XXXX or (XX) XXXX-XXXX */
export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Extract only digits from masked phone */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Validate Brazilian phone: 10 or 11 digits */
export function isValidPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}

/** Validate email format */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Normalize email: trim whitespace */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
