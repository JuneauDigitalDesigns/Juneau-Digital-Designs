import type { ReceptionistMode } from "./model";

/**
 * The live, already-approved receptionist options (unchanged from the previous wizard). In their
 * own file so the review cards (review.ts) can name the choice without importing the screens.
 */
export const RECEPTIONIST_OPTIONS: { id: ReceptionistMode; label: string; detail: string }[] = [
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
    {
        id: "declined",
        label: "No receptionist for now, website only",
        detail: "We build the site and skip the phone side entirely. Same price, and you can switch it on later with no extra onboarding fee.",
    },
];
