export interface TranscriptLine { role: "AI" | "CALLER"; text: string; }

/**
 * The stylized site shown on the customer's phone in Act 1.
 *
 * Deliberately abstract — blocks, a trade tag, a business name and an unmistakable
 * call bar. No body copy. The point of the beat is "a real person was on a real
 * site and tapped the button", not "read this website".
 */
export interface MockSite {
  /** Brand colour for the mock. Fixed hex, not a token — this is someone else's site. */
  accent: string;
  /** Text on the sticky call bar. The one string on the mock that has to be readable. */
  ctaLabel: string;
  /** Block arrangement, so consecutive replays don't produce the same silhouette. */
  variant: 1 | 2 | 3;
}

export interface CallScenario {
  id: string;
  tradeTag: string;
  businessName: string;
  /** Shown on the outgoing-call screen — the number the customer is dialling. */
  businessPhone: string;
  caller: { name: string; initials: string; color: string; };
  callTime: string;
  site: MockSite;
  transcript: TranscriptLine[];
  ownerMessage: { headline: string; lines: string[]; };
}

/* Caller and business numbers use the 555-01XX range reserved for fictional use, so
   nothing on this page can dial a real person. */
export const SCENARIOS: CallScenario[] = [
  {
    id: "plumbing",
    tradeTag: "PLUMBING",
    businessName: "Clearwater Plumbing Co.",
    businessPhone: "(207) 555-0118",
    caller: { name: "Dana Kim", initials: "DK", color: "#4A90D9" },
    callTime: "2:47 PM",
    site: { accent: "#2C6FA8", ctaLabel: "Call Now", variant: 1 },
    transcript: [
      { role: "CALLER", text: "Hi, my kitchen sink is leaking pretty bad — is there someone who can come take a look?" },
      { role: "AI",     text: "Oh no, that's no fun. We can definitely get someone out there. Can I grab your name and best callback number?" },
      { role: "CALLER", text: "Dana Kim — this number works fine." },
      { role: "AI",     text: "Got it, Dana. I'll pass this along right now and someone will reach out to get you on the schedule." },
    ],
    ownerMessage: {
      headline: "New service request",
      lines: ["Name: Dana Kim", "Issue: Kitchen sink leak", "Status: Needs scheduling", "Phone: (207) 555-0143"],
    },
  },
  {
    id: "hvac",
    tradeTag: "HVAC",
    businessName: "Peak Comfort HVAC",
    businessPhone: "(512) 555-0177",
    caller: { name: "Robert Ochoa", initials: "RO", color: "#E8704A" },
    callTime: "2:13 AM",
    site: { accent: "#B4472B", ctaLabel: "24/7 Emergency", variant: 2 },
    transcript: [
      { role: "CALLER", text: "It's 2am and our heat just went out. I've got kids in the house, it's getting cold." },
      { role: "AI",     text: "Oh man — that's a priority, I'm sorry. Let me get your info so the team can reach you right away." },
      { role: "CALLER", text: "Robert Ochoa, 847 Elm Street. Reach me at this number." },
      { role: "AI",     text: "Got it, Robert. I'm flagging this as urgent — someone will be calling you back very shortly." },
    ],
    ownerMessage: {
      headline: "URGENT — no heat, kids home",
      lines: ["Name: Robert Ochoa", "Address: 847 Elm Street", "Status: Urgent callback needed", "Phone: (512) 555-0129"],
    },
  },
  {
    id: "landscape",
    tradeTag: "LANDSCAPE",
    businessName: "Greenfield Outdoor",
    businessPhone: "(603) 555-0164",
    caller: { name: "Sarah Mills", initials: "SM", color: "#5BAD72" },
    callTime: "4:22 PM",
    site: { accent: "#3E8C5A", ctaLabel: "Get a Quote", variant: 3 },
    transcript: [
      { role: "CALLER", text: "Hey, I'm looking to get a quote for a fall cleanup on my property. About a quarter acre." },
      { role: "AI",     text: "Sure, we can help with that. What's the best name and number to have someone reach out to you?" },
      { role: "CALLER", text: "Sarah Mills — this number's fine. Property's at 412 Cedar Lane." },
      { role: "AI",     text: "Perfect, Sarah. I've got all of that. Someone will be in touch soon to go over the details." },
    ],
    ownerMessage: {
      headline: "Quote request — follow up needed",
      lines: ["Name: Sarah Mills", "Request: Fall cleanup, ~¼ acre", "Address: 412 Cedar Lane", "Phone: (603) 555-0192"],
    },
  },
  {
    id: "roofing",
    tradeTag: "ROOFING",
    businessName: "Summit Roofing",
    businessPhone: "(816) 555-0136",
    caller: { name: "Tom Benitez", initials: "TB", color: "#C0392B" },
    callTime: "7:58 PM",
    site: { accent: "#9E3428", ctaLabel: "Free Inspection", variant: 1 },
    transcript: [
      { role: "CALLER", text: "We had a bad storm last night — think there might be some roof damage. Shingles look off." },
      { role: "AI",     text: "Yikes, alright — let's get the team out to take a look. Can I get your name and number?" },
      { role: "CALLER", text: "Tom Benitez. Best number is this one — I'm at 29 Maple Drive." },
      { role: "AI",     text: "Got it, Tom. I'll get this to the guys now and someone will reach out to get you scheduled." },
    ],
    ownerMessage: {
      headline: "Storm damage — inspection needed",
      lines: ["Name: Tom Benitez", "Issue: Missing shingles, possible leak", "Address: 29 Maple Drive", "Phone: (816) 555-0158"],
    },
  },
  {
    id: "electric",
    tradeTag: "ELECTRIC",
    businessName: "Bright Line Electric",
    businessPhone: "(414) 555-0109",
    caller: { name: "Mika Chen", initials: "MC", color: "#8E44AD" },
    callTime: "8:12 AM",
    site: { accent: "#6B3E9E", ctaLabel: "Book a Visit", variant: 2 },
    transcript: [
      { role: "CALLER", text: "I've been looking into upgrading my electrical panel. Is that something you all handle?" },
      { role: "AI",     text: "We do, yeah — good timing to get that looked at. Can I grab your name and a good number for you?" },
      { role: "CALLER", text: "Mika Chen. This number's the best way to reach me." },
      { role: "AI",     text: "Great, Mika. I'll pass that along and someone will give you a call to talk through next steps." },
    ],
    ownerMessage: {
      headline: "Panel upgrade inquiry",
      lines: ["Name: Mika Chen", "Service: Electrical panel upgrade", "Status: Needs estimate call", "Phone: (414) 555-0171"],
    },
  },
];
