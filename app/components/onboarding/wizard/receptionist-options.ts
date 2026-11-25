import type { ReceptionistMode } from "./model";

/**
 * The live, already-approved receptionist options. In their own file so the review cards
 * (review.ts) can name the choice without importing the screens.
 *
 * Only the two ways a call can reach the receptionist (B3, 2026-11-24). Website only is no longer
 * an option here: it is the `website` plan (shown as Starter), chosen at checkout, and a site on
 * it never sees the Phone setup screen at all.
 */
export const RECEPTIONIST_OPTIONS: { id: Exclude<ReceptionistMode, "declined">; label: string; detail: string }[] = [
    {
        id: "forwarded",
        label: "Forward my existing number",
        detail: "You keep the number you already advertise. We give you a number to forward to, and calls you do not pick up roll to your receptionist instead of voicemail.",
    },
    {
        id: "published",
        label: "Use the new number as my business number",
        detail: "We give you a number and you start using it: cards, truck, Google listing. Calls come straight in, ring your phone first, and reach the receptionist if you miss them.",
    },
];
