import { formatPhoneDisplay } from "@jdd/schema";

/**
 * Tidies what a client typed (Xander, 2026-11-12): "We don't want to stop anyone from typing in
 * what they wish to the form, but we do want to make sure that if that information comes
 * through, it's formatted correctly."
 *
 * Every rule runs when the field loses focus (screens.tsx) and again in buildPayload, so a value
 * is formatted even if the client never left the field. Typing is never blocked, and anything a
 * rule can't read is returned as typed (trimmed), never guessed at. Tested in
 * test/onboarding-formatting.test.mjs.
 */

/** Trimmed, single spaces, one line. */
export function fmtText(raw: string): string {
    return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** "(407) 555-0142", through the shared @jdd/schema formatter the sites use. */
export function fmtPhone(raw: string): string {
    return formatPhoneDisplay(fmtText(raw));
}

/** No spaces, lowercase. */
export function fmtEmail(raw: string): string {
    return (raw ?? "").replace(/\s+/g, "").toLowerCase();
}

const MONEY = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

function money(token: string): string | null {
    const m = MONEY.exec(token.trim());
    if (!m) return null;
    const whole = Number(m[1].replace(/,/g, ""));
    const cents = m[2] && Number(m[2]) !== 0 ? `.${m[2].padEnd(2, "0")}` : "";
    return `$${whole.toLocaleString("en-US")}${cents}`;
}

/**
 * A starting price: "1500" → "$1,500", "150-200" → "$150 to $200". Words ("Free quote", "from
 * 99") are left as typed, so a client can still say what they mean.
 */
export function fmtPrice(raw: string): string {
    const t = fmtText(raw);
    if (!t) return "";
    const one = money(t);
    if (one) return one;
    const range = /^(.+?)\s*(?:-|–|—|\bto\b)\s*(.+)$/i.exec(t);
    if (range) {
        const a = money(range[1]);
        const b = money(range[2]);
        if (a && b) return `${a} to ${b}`;
    }
    return t;
}

/** The client's current site: bare lowercase host and path, no scheme, www or trailing slash. */
export function fmtWebsite(raw: string): string {
    const t = (raw ?? "").replace(/\s+/g, "");
    if (!t) return "";
    const noScheme = t.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    const slash = noScheme.indexOf("/");
    const host = (slash < 0 ? noScheme : noScheme.slice(0, slash)).toLowerCase();
    const path = slash < 0 ? "" : noScheme.slice(slash);
    return (host + path).replace(/\/+$/, "");
}

/** A profile or review link: spaces removed, https added when no scheme was typed. */
export function fmtProfileUrl(raw: string): string {
    const t = (raw ?? "").replace(/\s+/g, "");
    if (!t) return "";
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

/** The four-digit year in what was typed ("since 2009" → "2009"). */
export function fmtYear(raw: string): string {
    const t = fmtText(raw);
    const m = /\b(1[89]\d{2}|20\d{2})\b/.exec(t);
    return m ? m[1] : t;
}

/** A license number: uppercase, single spaces. */
export function fmtLicense(raw: string): string {
    return fmtText(raw).toUpperCase();
}

/** A star rating from 0 to 5, one decimal ("4,90 stars" → "4.9"). Out of range stays as typed. */
export function fmtRating(raw: string): string {
    const t = fmtText(raw);
    const m = /(\d+(?:[.,]\d+)?)/.exec(t);
    if (!m) return t;
    const n = Number(m[1].replace(",", "."));
    if (!(n >= 0 && n <= 5)) return t;
    return String(Math.round(n * 10) / 10);
}

/** Digits only ("212 reviews" → "212", "1,200" → "1200"). No digits: as typed. */
export function fmtWholeNumber(raw: string): string {
    const t = fmtText(raw);
    const m = /\d[\d,]*/.exec(t);
    return m ? m[0].replace(/,/g, "") : t;
}
