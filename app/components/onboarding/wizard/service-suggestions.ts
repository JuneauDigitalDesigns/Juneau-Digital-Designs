/**
 * Suggestion chips for a service's details: what's included, the jobs customers call about, and
 * the questions they ask. A client taps only what's true; nothing here is ever sent unless
 * picked, and the copywriter may tidy a picked item but never adds one.
 *
 * ── PENDING APPROVAL ─────────────────────────────────────────────────────────
 * Xander, 2026-11-10: "Yes, one trade per batch", each batch approved word for word, live
 * clients' trades first. Only the HVAC sample from the copy deck is drafted so far, for two
 * services. Every other service shows "add your own" with no chips until its trade's batch is
 * approved. When a batch lands, it may move to @jdd/schema's industry menu so the console intake
 * offers the same chips (intake-wizard asked for them).
 */

export type ServiceSuggestions = { included: string[]; jobs: string[]; questions: string[] };

const NONE: ServiceSuggestions = { included: [], jobs: [], questions: [] };

/** Keyed by trade id, then by the service's menu label (industry-menu.ts). */
const SUGGESTIONS: Record<string, Record<string, ServiceSuggestions>> = {
    hvac: {
        "AC Installation & Service": {
            included: [
                "Sizing for your home", "Removal of the old unit", "Permit and inspection", "New thermostat",
                "Refrigerant line set", "Startup and testing", "Warranty registration", "Repairs on all brands", "Diagnostic visit",
            ],
            jobs: [
                "AC blowing warm air", "AC won't turn on", "Water leaking from the unit", "Ice on the lines",
                "Loud or strange noises", "High electric bills", "Some rooms too hot", "System over 10 years old",
            ],
            questions: [
                "Should I repair or replace my AC?", "How long does a new AC take to put in?", "What size AC does my home need?",
                "Do you service all brands?", "How soon can you come out?", "Do you offer financing?",
            ],
        },
        "Furnace Repair & Replacement": {
            included: [
                "Safety inspection", "Carbon monoxide check", "Repairs on all brands", "Igniter and flame sensor", "Blower motor repair",
                "Removal of the old furnace", "Permit and inspection", "Heat exchanger check", "Thermostat check", "Filter change", "Startup and testing",
            ],
            jobs: [
                "No heat", "Furnace won't turn on", "Burning smell", "Strange noises", "Turns on and off a lot",
                "High gas bills", "Pilot light keeps going out", "Carbon monoxide alarm", "Furnace over 15 years old",
            ],
            questions: [],
        },
    },
};

export function suggestionsFor(trade: string, service: string): ServiceSuggestions {
    return SUGGESTIONS[trade]?.[service] ?? NONE;
}
