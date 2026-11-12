export interface TranscriptLine { role: "AI" | "CALLER"; text: string; }

/**
 * The receptionist film's story (`SiteToCallPanel`), first approved by Xander on 9 Nov 2026 and
 * retold on 12 Nov 2026 (storyboard approved word for word). It now plays the Starter story
 * first: Dave taps the number on the site, the owner is busy, and the receptionist answers
 * (`FILM_CALL_IN`). Growth is offered after it: the same site, the form, and the callback
 * (`FILM_CALL`). Both end in the same alert about the same lead.
 *
 * It used to rotate five made-up businesses, one per replay, each on a drawn "mock" site.
 * The film now opens on the real growth template (the same site the laptop above it shows),
 * so it tells one story that matches it: Dave fills in the estimate form on Your HVAC Co.'s
 * site, and on Growth the AI calls him back within about a minute. Dave and his number are
 * the lead the portal demo further down the page then shows (`app/data/portal-demo.ts`), so
 * the page reads as one customer from form to booked job.
 *
 * Numbers use the 555-01XX range reserved for fictional use, so nothing on this page can
 * dial a real person.
 */
export interface CallScenario {
  businessName: string;
  caller: { name: string; initials: string; color: string; };
  /** When it happens, as the owner's phone shows it. Matches the portal demo's 2:13 AM. */
  callTime: string;
  transcript: TranscriptLine[];
  /**
   * What the owner's phone receives after the call, and what the Inbox row shows.
   *
   * `reason` and `callback` fill the post-call brief, whose wording is not ours to write
   * here: it is the Make master scenario's, quoted byte for byte on /sms-terms ("A typical
   * call summary reads"). SiteToCallPanel builds the text from that one template, so the
   * film can only ever show the shape the real message has. `summary` is the Inbox row's
   * one-line description of the job.
   */
  ownerMessage: { reason: string; summary: string; callback: string; };
}

export const FILM_CALL: CallScenario = {
  businessName: "Your HVAC Co.",
  caller: { name: "Dave Kowalski", initials: "DK", color: "#4A90D9" },
  callTime: "2:13 AM",
  transcript: [
    /* The callback's opening line, approved word for word. It names the form, so the call
       reads as the reply to it. */
    /* "This call is recorded." added on 12 Nov 2026 (approved): every real agent says so first
       (MSA v5.4, jdd-ops lib/voice-consent.js), so the film does too. */
    { role: "AI",     text: "Hi Dave, it's Your HVAC Co. You just asked for an estimate on our website. This call is recorded. What's going on with your system?" },
    { role: "CALLER", text: "Furnace quit overnight and the house is down to 58. Two kids at home." },
    { role: "AI",     text: "Got it, Dave. I've marked this urgent, and the team will reach you first thing in the morning." },
  ],
  ownerMessage: { reason: "Urgent callback needed", summary: "Furnace out, house at 58°", callback: "(512) 555-0129" },
};

/**
 * The Starter story's call: Dave rings the number on the site, the owner can't pick up, and the
 * receptionist answers. Approved word for word on 12 Nov 2026. Same caller, same alert.
 */
export const FILM_CALL_IN: CallScenario = {
  ...FILM_CALL,
  transcript: [
    { role: "AI",     text: "Thanks for calling Your HVAC Co. This call is recorded. How can I help?" },
    { role: "CALLER", text: "Furnace quit overnight and the house is down to 58. Two kids at home." },
    { role: "AI",     text: "I'm sorry to hear that. Can I get your name and the best number to reach you?" },
    { role: "CALLER", text: "Dave Kowalski. This number's fine." },
    { role: "AI",     text: "Got it, Dave. I've marked this urgent, and the team will reach you first thing in the morning." },
  ],
};

/**
 * Every word the film puts on screen besides the transcripts and the alert. Approved by Xander
 * word for word on 12 Nov 2026; no dashes. The arrows after "Skip to…" and "Show me" are icons.
 */
export const FILM_COPY = {
  customerSees: "What your customer sees",
  everyPlan: "Every plan",
  onGrowth: "On Growth",
  calling: "Calling…",
  meanwhile: "Meanwhile, on your phone",
  busy: "You're busy and can't pick up.",
  voicemail: "Normally, that call goes to voicemail",
  instead: "Instead, your receptionist answers",
  backOnYours: "Back on your phone",
  aMinuteLater: "About a minute later",
  callNumber: "Customers can still call your number. They reach you or your AI receptionist.",
  fillForm: "Your customers can also fill out this form, and your AI receptionist calls them back to get their details.",
  starterEnd: "On Growth, your receptionist also calls back every web form lead.",
  seeGrowth: "See how it works on Growth",
  skipToPortal: "Skip to how we capture this lead",
  growthEnd: "Next, see how we capture this lead",
  showMe: "Show me",
  replay: "Replay",
};

/**
 * The growth site on the customer's phone: a full-page capture of e2etestgrowth at a 390px
 * viewport (`public/film-site.webp`, 600px wide), and where its form lives on that page.
 *
 * Every position is the live page's own, in CSS px at 390px wide, measured from the DOM on
 * 9 Nov 2026, so the film's typing, tick and clicks land exactly on the screenshot's fields.
 * Recapture and re-measure together: if the template moves the form, these move with it.
 */
export const FILM_SITE = {
  src: "/film-site.webp",
  width: 390,
  height: 9720,
  /** The hero's call button, "(207) 569-3204", which the Starter story taps. Measured from the
   *  capture on 12 Nov 2026. */
  heroCall: { x: 20, y: 402, w: 350, h: 58 },
  /** The hero's "Book a Free Estimate" link, which jumps to the form. */
  heroEstimate: { x: 20, y: 475, w: 350, h: 56 },
  /** How far the page scrolls to bring the form up. */
  formScroll: 640,
  name: { x: 44, y: 859, w: 302, h: 52 },
  phone: { x: 44, y: 944, w: 302, h: 52 },
  consent: { x: 44, y: 1087, w: 16, h: 16 },
  submit: { x: 44, y: 1208, w: 302, h: 50 },
  /** The form's fields and button, from the "Your name" label to the button's foot: what the
   *  Growth story's second callout points at. */
  formFields: { x: 34, y: 830, w: 322, h: 436 },
  /** Where the page sits for that callout: 40px above `formScroll`, so the box clears the
   *  phone's notch at both phone sizes and the button still shows below. */
  formCalloutScroll: 600,
};
