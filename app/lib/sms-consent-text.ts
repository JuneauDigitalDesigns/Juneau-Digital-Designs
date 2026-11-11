import { ownerTextCampaign, type OwnerTextCampaign } from "./owner-text-campaign";

/**
 * The exact words shown beside the SMS consent checkbox.
 *
 * This is the single source of truth for three things that must never disagree: what the
 * client reads on the agreement page, what gets hashed into the consent record, and what
 * is submitted to Twilio as the campaign's opt-in language. A carrier reviewing a
 * complaint asks "what did they actually see?" and the answer has to be provable.
 *
 * Client-safe by design (no server-only, no node:crypto) so the form can render it. The
 * hashing lives next door in sms-consent.ts, mirroring the split in lib/legal/hash.ts.
 *
 * WHICH WORDING IS SHOWN follows the same switch as the owner texts, `OWNER_TEXT_CAMPAIGN`
 * (owner-text-campaign.ts). The checkbox is part of what a campaign registers, so it changes
 * with the campaign and with nothing else:
 *
 *   v1 (unset, the approved campaign) → `SMS_CONSENT_V1`, the checkbox text registered in the
 *     campaign's message flow, word for word (read live from Twilio 2026-11-11). It is the same
 *     text, version id and hash this file shipped with on 2026-08-13, so it reuses them.
 *   v2 (the replacement campaign)     → `SMS_CONSENT_V2`, unchanged since 2026-10-31.
 *
 * `smsConsentCopy()` reads the env, so call it on the server and hand the result to a client
 * component as a prop. A browser has no OWNER_TEXT_CAMPAIGN and would always read v1.
 *
 * CHANGING THE WORDING: add a new version, never edit one. Old events keep their own hash and
 * version, so they stay provable against the words they were shown, not against whatever the
 * text says today. Both versions here have records stored against them.
 */

export interface SmsConsentCopy {
  /** Stored on every consent event as `consentTextVersion`. */
  version: string;
  /** Shown beside the box, and hashed into `consentTextHash`. */
  text: string;
}

/**
 * v1 (2026-08-13) — the text the approved campaign registered (Xander, 2026-11-11: under v1,
 * fall back to exactly what is registered). Covers call summaries and service alerts only, which
 * is all the v1 campaign sends.
 */
export const SMS_CONSENT_V1: SmsConsentCopy = {
  version: "sms-consent-v1",
  text:
    "Yes, text me call summaries and service alerts from Juneau Digital Designs at the mobile " +
    "number above. Consent is not a condition of purchase. Message and data rates may apply. " +
    "Message frequency varies based on call volume. Reply STOP to opt out, HELP for help. " +
    "See SMS Terms and Privacy Policy.",
};

/**
 * v2 (2026-10-31) — scoped to the **account lane**, for the replacement campaign.
 *
 * "about my own Juneau Digital Designs account" is doing real work, not padding. Once a client's
 * portal can text that client's *own customers* (lead replies, review requests), there are two
 * messaging programs with two registrants: JDD → the owner, under JDD's `ACCOUNT_NOTIFICATION`
 * campaign, and the business → its customers, under the client's own `CUSTOMER_CARE`. This
 * sentence must never be readable as consent for the second one — the client cannot grant consent
 * on their customers' behalf, and JDD is not the registrant there. See `/sms-terms`, which this
 * links to, for the full split.
 *
 * "new-lead alerts" is listed before anything sends them, deliberately. Consent has to predate the
 * first message, so naming it now avoids a second bump and a re-consent run later.
 */
export const SMS_CONSENT_V2: SmsConsentCopy = {
  version: "sms-consent-v2",
  text:
    "Yes, text me call summaries, new-lead alerts, and service alerts about my own Juneau " +
    "Digital Designs account at the mobile number above. Consent is not a condition of " +
    "purchase. Message and data rates may apply. Message frequency varies based on call and " +
    "lead volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.",
};

export const SMS_CONSENT_COPY: Record<OwnerTextCampaign, SmsConsentCopy> = {
  v1: SMS_CONSENT_V1,
  v2: SMS_CONSENT_V2,
};

type Env = Record<string, string | undefined>;

/** The wording the live campaign registers. Server-side only: see the note at the top. */
export function smsConsentCopy(env: Env = process.env): SmsConsentCopy {
  return SMS_CONSENT_COPY[ownerTextCampaign(env)];
}

/**
 * The wording a submission says it showed, or null for a version this file does not know.
 *
 * A form names the version it rendered, so the record is the words on that screen even if the
 * campaign switched between loading the page and pressing the button. A page loaded before forms
 * named it showed v2, the only text then, so absent means v2.
 */
export function smsConsentCopyForVersion(version: unknown): SmsConsentCopy | null {
  if (version === undefined || version === null || version === "") return SMS_CONSENT_V2;
  return Object.values(SMS_CONSENT_COPY).find((c) => c.version === version) ?? null;
}

/** Phrases inside the consent text that render as links. */
export const SMS_CONSENT_LINKS = [
  { label: "SMS Terms", href: "/sms-terms" },
  { label: "Privacy Policy", href: "/privacy-policy" },
] as const;

export type ConsentTextSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string; href: string };

/**
 * Split the canonical text into renderable segments.
 *
 * The alternative — writing the sentence out again as JSX with <Link>s in the middle —
 * lets the rendered copy drift from the hashed copy one careless edit at a time. Deriving
 * the markup from the string makes that drift impossible: whatever is rendered is exactly
 * what is hashed.
 *
 * The text is required: which wording applies is the campaign's call, made on the server.
 */
export function splitConsentText(text: string): ConsentTextSegment[] {
  const segments: ConsentTextSegment[] = [];
  let rest = text;

  while (rest.length > 0) {
    // Find whichever link phrase appears earliest in what's left.
    let next: { index: number; label: string; href: string } | null = null;
    for (const { label, href } of SMS_CONSENT_LINKS) {
      const index = rest.indexOf(label);
      if (index !== -1 && (next === null || index < next.index)) {
        next = { index, label, href };
      }
    }

    if (!next) {
      segments.push({ kind: "text", value: rest });
      break;
    }

    if (next.index > 0) {
      segments.push({ kind: "text", value: rest.slice(0, next.index) });
    }
    segments.push({ kind: "link", value: next.label, href: next.href });
    rest = rest.slice(next.index + next.label.length);
  }

  return segments;
}
