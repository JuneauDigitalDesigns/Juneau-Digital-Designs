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
 * CHANGING THE WORDING: bump SMS_CONSENT_TEXT_VERSION in the same commit. Old events keep
 * their own hash and version, so they stay provable against the words they were shown,
 * not against whatever the text says today.
 */

export const SMS_CONSENT_TEXT_VERSION = "sms-consent-v1";

export const SMS_CONSENT_TEXT =
  "Yes, text me call summaries and service alerts from Juneau Digital Designs at the mobile " +
  "number above. Consent is not a condition of purchase. Message and data rates may apply. " +
  "Message frequency varies based on call volume. Reply STOP to opt out, HELP for help. " +
  "See SMS Terms and Privacy Policy.";

/** Phrases inside SMS_CONSENT_TEXT that render as links. */
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
 */
export function splitConsentText(text: string = SMS_CONSENT_TEXT): ConsentTextSegment[] {
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
