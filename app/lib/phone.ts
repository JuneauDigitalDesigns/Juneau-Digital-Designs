/**
 * Phone normalization to E.164.
 *
 * Deliberately client-safe (no server-only, no node builtins): the agreement form
 * validates with this before submitting, and the API validates with the same function
 * afterwards. One implementation means the browser can never accept a number the server
 * would reject, or vice versa.
 */

/**
 * Normalize a typed phone number to E.164, or null if it isn't one.
 *
 * Assumes North America when no country code is given, which is what every JDD client
 * is. An explicit `+` is honoured as-is so an international number isn't mangled into
 * a +1 that was never entered.
 */
export function normalizeE164(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    // E.164 caps at 15 digits and no country code is shorter than one digit, but a
    // 7-digit "international" number is a typo, not a country we don't serve.
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Display form for a +1 number, e.g. +19305551234 → (930) 555-1234. */
export function formatUsPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
