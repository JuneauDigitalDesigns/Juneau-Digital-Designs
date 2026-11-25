import type { OwnerTextCampaign } from "@/app/lib/owner-text-campaign";

/**
 * Program One's wording on /sms-terms, per owner-text campaign (Xander, 2026-11-18).
 *
 * The page follows `OWNER_TEXT_CAMPAIGN`, exactly as Terms v6.0/v6.2 and the consent sentence do:
 * under v1 (live today) it describes what v1 registered and sends; under v2 it describes the
 * replacement campaign. So it is true at every moment and flips with the cutover deploy. Every
 * line here was approved by Xander word for word on 2026-11-18, except the three v2 lead-ins marked
 * PENDING below. `test/sms-terms-sample.test.mjs` renders both versions and holds every sample a
 * builder exists for to that builder, so the page cannot drift from the texts.
 */

/** The v1 call summary: exactly what `callBriefBody` sends today (approved 2026-11-18, #159). */
export const CALL_SUMMARY_SAMPLE = [
    "Juneau Digital Designs call alert",
    "Name: Maria Alvarez",
    "Status: Callback",
    "Phone: (930) 555-0117",
    "About: Water heater leaking in the garage",
    "Reply STOP to opt out, HELP for help",
].join("\n");

/** v1's service alert: registered and consented under v1, not sent by any code yet. v1's STOP line. */
export const SERVICE_ALERT_SAMPLE_V1 =
    "Juneau Digital Designs service alert: you have used 90% of your included minutes this billing period. Reply STOP to opt out, HELP for help.";

/** The replacement campaign's samples 1 to 5, as submitted (TWILIO-NEW-CAMPAIGN-SUBMISSION.md §2). */
export const V2_SAMPLES = {
    newLead: [
        "New lead in your portal",
        "From: [Customer Name]",
        "View it: https://www.juneaudigitaldesigns.com/portal/l/7Kq2Xw9P",
        "Juneau Digital Designs: Reply STOP to opt out, HELP for help",
    ].join("\n"),
    callCallback: [
        "New call lead in your portal",
        "Name: [Caller Name]",
        "Priority: Callback",
        "View it: https://www.juneaudigitaldesigns.com/portal/l/rB4mT8sZ",
        "Juneau Digital Designs: Reply STOP to opt out, HELP for help",
    ].join("\n"),
    callEmergency: [
        "New call lead in your portal",
        "Name: [Caller Name]",
        "Priority: Emergency",
        "View it: https://www.juneaudigitaldesigns.com/portal/l/Hc3Vn6Lq",
        "Juneau Digital Designs: Reply STOP to opt out, HELP for help",
    ].join("\n"),
    customerReplied: [
        "New message in your portal",
        "From: [Customer Name]",
        "View it: https://www.juneaudigitaldesigns.com/portal/customers",
        "Juneau Digital Designs: Reply STOP to opt out, HELP for help",
    ].join("\n"),
    serviceAlert: [
        "Service alert for your account",
        "You have used 90% of your included minutes this billing period.",
        "Details: https://www.juneaudigitaldesigns.com/portal",
        "Juneau Digital Designs: Reply STOP to opt out, HELP for help",
    ].join("\n"),
};

export interface ProgramOneCopy {
    /** The sentence before the list of kinds, after the program's name. */
    kindsIntro: string;
    kinds: { term: string; text: string }[];
    samples: { leadIn: string; texts: string[] }[];
    /** "Message frequency", the whole paragraph. */
    frequency: string;
}

const KIND = {
    calls: {
        term: "Call summaries.",
        text: "When the receptionist handles a call for your business, a short text tells you who called, what they wanted, and how urgent it is.",
    },
    leads: {
        term: "New-lead alerts.",
        text: "When someone fills in the contact form on your website, a short text tells you a new lead arrived so you can open your portal and follow up.",
    },
    service: {
        term: "Service alerts.",
        text: "Occasional notices about your own account, such as your receptionist being unreachable, your included minutes running low, or planned maintenance that affects call handling.",
    },
    replies: {
        term: "Customer replies.",
        text: "When one of your customers sends a message to your portal, a short text tells you so you can reply.",
    },
};

const FREQUENCY_REST =
    "Service alerts are infrequent and only sent when something about your own account needs your attention. We do not send scheduled or recurring messages of any other kind.";

export const PROGRAM_ONE_COPY: Record<OwnerTextCampaign, ProgramOneCopy> = {
    v1: {
        kindsIntro: "It sends two kinds of message:",
        kinds: [KIND.calls, KIND.service],
        samples: [
            { leadIn: "A typical call summary reads:", texts: [CALL_SUMMARY_SAMPLE] },
            { leadIn: "A typical service alert reads:", texts: [SERVICE_ALERT_SAMPLE_V1] },
        ],
        frequency: `Message frequency varies based on call volume. You receive at most one message per handled call, so a quiet week may produce none and a busy day may produce several. ${FREQUENCY_REST}`,
    },
    v2: {
        kindsIntro: "It sends four kinds of message:",
        kinds: [KIND.calls, KIND.leads, KIND.service, KIND.replies],
        samples: [
            { leadIn: "A typical call summary reads:", texts: [V2_SAMPLES.callCallback, V2_SAMPLES.callEmergency] },
            // PENDING Xander's word-for-word approval (v2 only, so not shown in production until the switch).
            { leadIn: "A typical new-lead alert reads:", texts: [V2_SAMPLES.newLead] },
            // PENDING, as above.
            { leadIn: "A typical customer-reply alert reads:", texts: [V2_SAMPLES.customerReplied] },
            { leadIn: "A typical service alert reads:", texts: [V2_SAMPLES.serviceAlert] },
        ],
        frequency: `Message frequency varies based on call and lead volume. You receive at most one message per handled call, one per new lead and one per customer message, so a quiet week may produce none and a busy day may produce several. ${FREQUENCY_REST}`,
    },
};
