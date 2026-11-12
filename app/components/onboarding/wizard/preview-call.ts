import { formatPhoneDisplay } from "@jdd/schema";

/**
 * The Call button on the wizard's site preview (Xander, 2026-11-12, approved word for word,
 * mockup https://claude.ai/artifact/1jN9RQefsjuVy5sx65ZPVA item N1): "If you choose use business
 * number in place of the phone number, it'll just say new number because we don't know what the
 * new number is going to be yet. Otherwise ... their phone number that they provided."
 *
 * It changes as soon as an option is tapped on "How will calls reach your receptionist?", and the
 * nav, page and footer buttons all use it.
 */

export const CALL_NEW_NUMBER = "Call · New number"; // N1

type CallState = { phone: string; receptionistMode: string };

export function previewCallLabel(state: CallState): string {
    if (state.receptionistMode === "published") return CALL_NEW_NUMBER;
    const phone = state.phone.trim();
    return `Call ${phone ? formatPhoneDisplay(phone) : "now"}`;
}
