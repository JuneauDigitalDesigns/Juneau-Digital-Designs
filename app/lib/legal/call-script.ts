import "server-only";
import { createHash } from "node:crypto";
import type { PlanSlug } from "../agreement-types";
import type { BillingPeriod } from "../plans";
import { getSchedule, TERMS_VERSION, WEB_ONLY_SCHEDULE } from "./index";
import { ANNUAL } from "./schedules";

/**
 * The lines an operator reads aloud on a sales call before ticking "Client verbally agreed".
 *
 * Built from Schedule A at runtime — prices, onboarding fee, included minutes — never typed
 * here, so it cannot quote a price the contract has moved past. The terms text itself is owned
 * elsewhere and is not touched by this file: when it changes, `TERMS_VERSION` and the schedule
 * change with it, and this script simply becomes a new version with a new hash.
 *
 * The hash is stored on the agreement as the record of exactly which words were read. The
 * console sends back the hash it displayed, and acceptance is refused if it no longer matches,
 * so a price change between showing the script and accepting it cannot slip through.
 *
 * No em-dashes in any line: these are spoken (house rule for copy a client hears).
 */
export interface CallScript {
  version: string;
  hash: string;
  /** Spoken before the recording starts. */
  recordingNotice: string;
  /** The first thing said once it is running, so the consent is on the recording itself. */
  recordingOpener: string;
  lines: string[];
}

// Approved word for word by Xander, 2026-11-09. Part of the hash below: an acceptance has to
// prove the client was told, not only that the terms were read.
const RECORDING_NOTICE = "This part of our call is recorded to keep a record of these terms. Is that okay with you?";
const RECORDING_OPENER = "We're now recording. You're okay with that?";

/**
 * Bump whenever the fixed wording changes, including the lines above. The version is how a stored
 * acceptance names the words that were read, so the same version must never mean two scripts.
 * Versions with no revision are the first script, which had no recording lines.
 */
const SCRIPT_REVISION = "r2";

export function buildCallScript(
  plan: PlanSlug,
  period: BillingPeriod,
  opts: { webOnly?: boolean } = {},
): CallScript {
  const s = opts.webOnly ? WEB_ONLY_SCHEDULE : getSchedule(plan);
  const annual = period === "annual";
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  const recurring = annual ? s.annualPrice : s.monthlyPrice;
  const today = recurring + s.onboardingFee;

  const billed = annual
    ? `yearly at ${money(s.annualPrice)} a year, which is ${ANNUAL.monthsCharged} months of ${money(s.monthlyPrice)}`
    : `monthly at ${money(s.monthlyPrice)} a month`;

  const lines = [
    `You are signing up for ${s.name}, billed ${billed}.`,
    `There is a one-time onboarding fee of ${money(s.onboardingFee)}, charged today with your first ${annual ? "year" : "month"}. That makes ${money(today)} today.`,
    annual
      ? `It renews automatically every year, and you are charged ${money(s.annualPrice)} on this date each year until you cancel.`
      : `It renews automatically every month, and you are charged ${money(s.monthlyPrice)} on this date each month until you cancel. There is no minimum term.`,
    // Annual prepay is non-refundable and runs to the end of the paid year (Xander, 2026-11-03).
    "You can cancel any time from your portal or by emailing us. It stops at the end of the period you have already paid for, and there are no refunds for partial periods.",
    ...(s.callMinutes != null
      ? [
          `Your plan includes ${s.callMinutes.toLocaleString("en-US")} call-minutes a month. Extra minutes are $${(s.overagePerMinute ?? 0).toFixed(2)} each.`,
        ]
      : []),
    "Disputes are handled individually through arbitration, not in court, and the terms limit our liability.",
    "By saying yes, you accept these terms and the full agreement we'll email you. Do you agree?",
  ];

  const version = `${TERMS_VERSION}-${opts.webOnly ? "web-only" : plan}-${period}-${SCRIPT_REVISION}`;
  const hash = createHash("sha256")
    .update([version, RECORDING_NOTICE, RECORDING_OPENER, ...lines].join("\n"), "utf8")
    .digest("hex");
  return { version, hash, recordingNotice: RECORDING_NOTICE, recordingOpener: RECORDING_OPENER, lines };
}
