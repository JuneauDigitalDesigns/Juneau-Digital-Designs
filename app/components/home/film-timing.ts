/**
 * How long the receptionist film holds each subtitle line.
 *
 * Until 12 Nov 2026 every line had a flat 2s, which Xander found too fast to read: the opening
 * line is 21 words. Approved: 0.9s plus 0.23s a word, which is about 260 words a minute, with the
 * old 2s kept as a floor so a short reply is not gone before it has faded in.
 */

const BASE_MS = 900;
const PER_WORD_MS = 230;
const FLOOR_MS = 2000;

export function lineMs(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(FLOOR_MS, BASE_MS + words * PER_WORD_MS);
}

/** The whole call beat: every line in turn, then `restMs` on the last before the film moves on. */
export function callMs(lines: string[], restMs: number): number {
    return lines.reduce((t, l) => t + lineMs(l), 0) + restMs;
}
