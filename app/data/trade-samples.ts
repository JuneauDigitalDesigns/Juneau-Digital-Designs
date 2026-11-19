import { isVerticalId, type VerticalId } from "@jdd/schema";
import { DEMO_BOARD, DEMO_BUSINESS, DEMO_INBOX, DEMO_LEAD, type DemoCard, type DemoInboxRow, type WorkingStage } from "./portal-demo";

/**
 * Sample data for each trade, for the portal tour and the Growth preview (Xander, 19 Nov 2026):
 * "If it is a HVAC client, then the dummy data in the portal that's shown during the tour is HVAC
 * customers, and so on and so forth for all the other industry verticals as well."
 *
 * One small business per trade, in the same shape as the homepage demo's (`portal-demo.ts`), so
 * the HVAC set *is* the homepage's and the rest follow it line for line: Dave and his 2:13 AM
 * call, three more Inbox rows, four customers on the board, the job Dave books and the texts
 * either side of it. `other` is for a client whose trade is none of these.
 *
 * Everything is fictional. Every number is in the 555-01XX range reserved for fiction. Sample
 * content is not client-facing copy in the approval sense (Xander approves the words around it).
 */

export type SampleTrade = VerticalId | "other";

export interface TradeSample {
    trade: SampleTrade;
    business: { name: string; host: string };
    /** Dave, the lead every walk-through starts from. Same person in every trade. */
    lead: typeof DEMO_LEAD;
    /** The receptionist's call with Dave, turn by turn. */
    transcript: { speaker: "agent" | "caller"; text: string }[];
    inbox: DemoInboxRow[];
    board: Record<WorkingStage, DemoCard[]>;
    /** The job Dave books, and what it is worth. */
    job: { service: string; amount: number };
    /** The owner's text to Dave, and his answer. */
    sms: string;
    reply: string;
    /** A note on Dave's file. */
    note: string;
}

const DAVE = { name: DEMO_LEAD.name, initials: DEMO_LEAD.initials, phone: DEMO_LEAD.phone, address: DEMO_LEAD.address, duration: DEMO_LEAD.duration, recording: DEMO_LEAD.recording, receivedAt: DEMO_LEAD.receivedAt };
const REPLY = "Perfect, see you at 8. Thank you!";
const PHONES = ["(512) 555-0144", "(512) 555-0186", "(512) 555-0152", "(512) 555-0117"];

/** The board's four people are the same in every trade; only their jobs change. */
function board(jobs: [string, string?][], quoted: string, scheduled = "Thu 9:00 AM"): Record<WorkingStage, DemoCard[]> {
    return {
        lead: [{ id: "luis", name: "Luis Arredondo", phone: PHONES[0], tags: [jobs[0][0]], note: jobs[0][1] ?? "Getting two other quotes first" }],
        contacted: [{ id: "kyle", name: "Kyle Dunbar", phone: PHONES[1], tags: [jobs[1][0]], stale: true }],
        quoted: [{ id: "brenda", name: "Brenda Huff", phone: PHONES[2], tags: [jobs[2][0]], note: quoted }],
        scheduled: [{ id: "gary", name: "Gary Novak", phone: PHONES[3], tags: [jobs[3][0]], note: scheduled }],
    };
}
function inbox(carol: string, jim: string, tammy: string): DemoInboxRow[] {
    return [
        { id: "carol", name: "Carol Ostrander", web: true, unread: true, preview: carol, tag: "Web form", time: "3 hours" },
        { id: "jim", name: "Jim Petrakis", count: 2, preview: jim, time: "Yesterday" },
        { id: "tammy", name: "Tammy Reynolds", preview: tammy, tag: "Call · 48s", time: "2 days" },
    ];
}
function talk(...turns: string[]): TradeSample["transcript"] {
    return turns.map((text, i) => ({ speaker: i % 2 === 0 ? "agent" : "caller", text }));
}

export const TRADE_SAMPLES: Record<SampleTrade, TradeSample> = {
    hvac: {
        trade: "hvac",
        business: DEMO_BUSINESS,
        lead: DEMO_LEAD,
        transcript: talk(
            `Thanks for calling ${DEMO_BUSINESS.name}. How can I help?`,
            "Hi, our furnace quit overnight and the house is down to 58 degrees.",
            "Sorry to hear that. Is anyone at home who might be at risk from the cold?",
            "Two kids. We have space heaters going, but we'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: DEMO_INBOX,
        board: DEMO_BOARD,
        job: { service: "Furnace repair", amount: 450 },
        sms: "Hi Dave, it's Mike from Your HVAC Co. I can be there by 8 to get the heat back on.",
        reply: REPLY,
        note: "Side gate code 4471. Dog is friendly.",
    },
    plumbing: {
        trade: "plumbing",
        business: { name: "Your Plumbing Co.", host: "yourplumbingco.com" },
        lead: {
            ...DAVE,
            preview: "Water heater is leaking from the bottom and there's no hot water. Two kids at home. Wants someone out first thing.",
            summary: "Dave asked for an estimate on the website at 2:13 AM, and the receptionist called him straight back. His water heater is leaking from the bottom and there's no hot water, with two kids at home. He's at 2210 Wren Hollow Rd and wants someone out first thing, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Plumbing Co. How can I help?",
            "Hi, our water heater is leaking from the bottom and there's no hot water.",
            "Sorry to hear that. Were you able to turn off the water to the heater?",
            "Yes, the valve's off. We'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "We'd like a quote to replace a kitchen faucet and the garbage disposal. Mornings are best.",
            "Toilet keeps running and won't stop filling. Any day but Friday works.",
            "Low water pressure in the upstairs shower since last week. Asked what it might be.",
        ),
        board: board([["Sewer camera"], ["Drain cleaning"], ["Bathroom repipe"], ["Water heater flush"]], "$3,900 quote sent Monday"),
        job: { service: "Water heater repair", amount: 450 },
        sms: "Hi Dave, it's Mike from Your Plumbing Co. I can be there by 8 to get the hot water back on.",
        reply: REPLY,
        note: "Shut-off valve is in the garage, left of the door.",
    },
    roofing: {
        trade: "roofing",
        business: { name: "Your Roofing Co.", host: "yourroofingco.com" },
        lead: {
            ...DAVE,
            preview: "Water is coming through the bedroom ceiling after last night's storm. Wants someone out first thing.",
            summary: "Dave asked for an estimate on the website at 2:13 AM, and the receptionist called him straight back. Water is coming through the upstairs bedroom ceiling after last night's storm. He's at 2210 Wren Hollow Rd and wants someone out first thing, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Roofing Co. How can I help?",
            "Hi, we have water coming through the bedroom ceiling since the storm last night.",
            "Sorry to hear that. Is water still coming in right now?",
            "A little. We've got a bucket under it, but we'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "We'd like a quote on a full roof replacement. Ranch house, about 1,800 sq ft.",
            "Wind took a few shingles off the back slope. Any day but Friday works.",
            "Gutters are pulling away from the fascia over the porch. Asked if that's a repair or a replacement.",
        ),
        board: board([["Gutters"], ["Shingle repair"], ["Roof replacement"], ["Roof inspection"]], "$14,800 quote sent Monday"),
        job: { service: "Emergency leak repair", amount: 450 },
        sms: "Hi Dave, it's Mike from Your Roofing Co. I can be there by 8 to get that leak covered.",
        reply: REPLY,
        note: "Ladder access is easiest from the driveway side.",
    },
    "lawn-care": {
        trade: "lawn-care",
        business: { name: "Your Lawn Care Co.", host: "yourlawncareco.com" },
        lead: {
            ...DAVE,
            preview: "Lawn is overgrown and they're hosting a party on Saturday. Wants someone out first thing.",
            summary: "Dave asked for an estimate on the website at 2:13 AM, and the receptionist called him straight back. His lawn is overgrown and he's hosting a party on Saturday. He's at 2210 Wren Hollow Rd and wants someone out first thing, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Lawn Care Co. How can I help?",
            "Hi, our lawn's overgrown and we're hosting a party on Saturday.",
            "Happy to help. Roughly how big is the yard, front and back?",
            "About a quarter acre. We'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "We'd like a quote on spring cleanup and fresh mulch for a corner lot. Mornings are best.",
            "Wants weekly mowing started this month. Any day but Friday works.",
            "Brown patches spreading across the front lawn. Asked if it's grubs.",
        ),
        board: board([["Sprinkler install"], ["Aeration"], ["Season mowing plan"], ["Spring cleanup"]], "$1,850 quote sent Monday"),
        job: { service: "Overgrown lawn cleanup", amount: 450 },
        sms: "Hi Dave, it's Mike from Your Lawn Care Co. I can be there by 8 to get the yard ready for Saturday.",
        reply: REPLY,
        note: "Back gate code 4471. Dog is friendly.",
    },
    "car-detailing": {
        trade: "car-detailing",
        business: { name: "Your Detailing Co.", host: "yourdetailingco.com" },
        lead: {
            ...DAVE,
            preview: "Spilled coffee and a milkshake all over the back seat of his truck. Wants someone out first thing.",
            summary: "Dave asked for an estimate on the website at 2:13 AM, and the receptionist called him straight back. He spilled coffee and a milkshake all over the back seat of his truck. He's at 2210 Wren Hollow Rd and wants someone out first thing, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Detailing Co. How can I help?",
            "Hi, I spilled coffee and a milkshake all over the back seat of my truck.",
            "Sorry to hear that. Are the seats cloth or leather?",
            "Cloth. It's in my driveway, and I'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "We'd like a quote on a ceramic coating for a new SUV. Mornings are best.",
            "Wants a full detail on two cars this month. Any day but Friday works.",
            "Light scratches on the hood of a black sedan. Asked if polishing would take them out.",
        ),
        board: board([["Paint correction"], ["Interior detail"], ["Ceramic coating"], ["Full detail"]], "$1,850 quote sent Monday"),
        job: { service: "Interior deep clean", amount: 450 },
        sms: "Hi Dave, it's Mike from Your Detailing Co. I can be there by 8 to get that back seat clean.",
        reply: REPLY,
        note: "Truck is in the driveway. Water spigot on the left of the garage.",
    },
    "pressure-washing": {
        trade: "pressure-washing",
        business: { name: "Your Pressure Washing Co.", host: "yourpressurewashingco.com" },
        lead: {
            ...DAVE,
            preview: "Green mildew all over the back deck and they're hosting on Saturday. Wants someone out first thing.",
            summary: "Dave asked for an estimate on the website at 2:13 AM, and the receptionist called him straight back. His back deck is covered in green mildew and he's hosting on Saturday. He's at 2210 Wren Hollow Rd and wants someone out first thing, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Pressure Washing Co. How can I help?",
            "Hi, our back deck is covered in green mildew and we're hosting on Saturday.",
            "Happy to help. Is the deck wood or composite, and roughly how big is it?",
            "Wood, about 300 square feet. We'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "We'd like a quote to wash the siding on a two-storey house. Mornings are best.",
            "Wants the driveway and front walk cleaned this month. Any day but Friday works.",
            "Black streaks on the roof. Asked if a soft wash is safe for shingles.",
        ),
        board: board([["Roof soft wash"], ["Fence wash"], ["House wash"], ["Driveway wash"]], "$1,850 quote sent Monday"),
        job: { service: "Deck mildew wash", amount: 450 },
        sms: "Hi Dave, it's Mike from Your Pressure Washing Co. I can be there by 8 to get the deck ready for Saturday.",
        reply: REPLY,
        note: "Outdoor tap is behind the hedge on the right side.",
    },
    health: {
        trade: "health",
        business: { name: "Your Health Clinic", host: "yourhealthclinic.com" },
        lead: {
            ...DAVE,
            preview: "Threw his back out lifting a box last night and can barely stand. Wants the first appointment today.",
            summary: "Dave asked for an appointment on the website at 2:13 AM, and the receptionist called him straight back. He threw his back out lifting a box last night and can barely stand. He wants the first appointment this morning, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Health Clinic. How can I help?",
            "Hi, I threw my back out lifting a box last night and I can barely stand.",
            "Sorry to hear that. Is the pain going down either leg, or is it just in your back?",
            "Just my lower back. I'd like the first appointment this morning.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "Asking whether you take new patients for knee rehab after surgery. Mornings are best.",
            "Wants to book a follow-up visit this month. Any day but Friday works.",
            "Asked if a doctor's referral is needed for a first visit.",
        ),
        board: board([["Knee rehab"], ["Follow-up visit"], ["Treatment plan"], ["Initial assessment"]], "6-visit plan sent Monday"),
        job: { service: "Initial assessment", amount: 120 },
        sms: "Hi Dave, it's Mike from Your Health Clinic. We can see you at 8 this morning.",
        reply: REPLY,
        note: "Prefers morning appointments. Parks in the back lot.",
    },
    other: {
        trade: "other",
        business: { name: "Your Business Co.", host: "yourbusinessco.com" },
        lead: {
            ...DAVE,
            preview: "Wants a quote and asked for someone to come out first thing.",
            summary: "Dave asked for an estimate on the website at 2:13 AM, and the receptionist called him straight back. He'd like a quote and someone out first thing. He's at 2210 Wren Hollow Rd, so it's marked urgent.",
            tag: "Urgent",
        },
        transcript: talk(
            "Thanks for calling Your Business Co. How can I help?",
            "Hi, I'd like a quote, and someone to come out as soon as possible.",
            "Happy to help. What's the address, and what would you like done?",
            "2210 Wren Hollow Rd. We'd like someone out first thing.",
            "Understood. I've marked it urgent and someone will call you back first thing this morning.",
            "Great, thank you.",
        ),
        inbox: inbox(
            "We'd like a quote for a job at our house. Mornings are best.",
            "Wants to book a visit this month. Any day but Friday works.",
            "Asked about your prices and whether you cover our area.",
        ),
        board: board([["Quote request"], ["Repeat customer"], ["Large job"], ["Service visit"]], "$1,850 quote sent Monday"),
        job: { service: "Service visit", amount: 450 },
        sms: "Hi Dave, it's Mike from Your Business Co. I can be there by 8 this morning.",
        reply: REPLY,
        note: "Call before arriving. Parking on the street.",
    },
};

/** Words in a business name that give its trade away, for sites whose trade was never stored. */
const NAME_HINTS: [RegExp, VerticalId][] = [
    [/\b(hvac|heating|cooling|air|furnace|comfort)\b/i, "hvac"],
    [/\b(plumb\w*|drain|rooter|pipe)\b/i, "plumbing"],
    [/\b(roof\w*|gutter)\b/i, "roofing"],
    [/\b(lawn|landscap\w*|mow\w*|turf|yard)\b/i, "lawn-care"],
    [/\b(detail\w*|auto|car|ceramic)\b/i, "car-detailing"],
    [/\b(pressure|power ?wash\w*|soft ?wash\w*|wash\w*)\b/i, "pressure-washing"],
    [/\b(health|clinic|physio\w*|chiro\w*|therapy|dental|medical|wellness)\b/i, "health"],
];

/**
 * The trade a site's samples come from: the trade it was set up with when that is known
 * (stored at onboarding from 19 Nov 2026), else a hint in its business name, else `other`.
 */
export function sampleTradeFor(stored: string | null | undefined, siteName?: string | null): SampleTrade {
    if (stored && isVerticalId(stored)) return stored;
    if (stored === "other") return "other";
    for (const [re, trade] of NAME_HINTS) if (siteName && re.test(siteName)) return trade;
    return "other";
}

export function tradeSample(trade: SampleTrade): TradeSample {
    return TRADE_SAMPLES[trade] ?? TRADE_SAMPLES.other;
}
