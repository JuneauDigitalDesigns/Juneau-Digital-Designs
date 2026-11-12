/**
 * The note under a field we filled in for the client (Xander, 2026-11-12, approved word for word,
 * mockup https://claude.ai/artifact/1jN9RQefsjuVy5sx65ZPVA items E1 and E2): one line, whichever
 * source it came from (the sales call or the agreement). It replaced "From your call with us.
 * Check it's right.", "From your agreement. Check it's right." and, under Business email, "From
 * your agreement. Change it if leads should go somewhere else." (leads never go to email).
 *
 * Xander: it shows only when the field really was pre-filled, and still holds what we filled in.
 * An edited, cleared or never-filled field shows no note.
 */

export const PREFILL_LINE = "We pre-filled this. Check it's right."; // E1, E2

/** The note for a field, or null. `email` compares without case or surrounding spaces. */
export function prefillLine(current: string | null | undefined, prefilled: string | null | undefined, opts: { email?: boolean } = {}): string | null {
    const norm = (v: string | null | undefined) => {
        const t = String(v ?? "").trim();
        return opts.email ? t.toLowerCase() : t;
    };
    const was = norm(prefilled);
    if (!was) return null;
    return norm(current) === was ? PREFILL_LINE : null;
}
