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

/** Apply Brazilian CEP mask: XXXXX-XXX */
export function applyCepMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Extract only digits from masked CEP */
export function cepDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Validate Brazilian CEP: exactly 8 digits */
export function isValidCep(value: string): boolean {
  return cepDigits(value).length === 8;
}

/** Fetch address from ViaCEP API */
export async function fetchAddressByCep(cep: string): Promise<{
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
} | null> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}
