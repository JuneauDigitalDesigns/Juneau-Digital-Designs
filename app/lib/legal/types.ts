import type { PlanSlug } from "../agreement-types";

/**
 * The block vocabulary shared by the on-page reader and the PDF generator.
 * Deliberately small — every kind added here has to be implemented twice
 * (React in TermsReader, pdf-lib in pdf-renderer), so resist growing it.
 */
export type Block =
  | { kind: "para"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; rows: [string, string][] }
  /** Boxed emphasis — used for the arbitration warning. */
  | { kind: "callout"; text: string }
  /** Legally conspicuous all-caps text — disclaimers and the liability cap. */
  | { kind: "allcaps"; text: string };

/* ── Authored shape ───────────────────────────────────────────
 * Sections carry an `id`, not a number. Numbers are assigned after
 * plan filtering so a Starter agreement reads 1..15 with no gaps
 * even though it drops three sections.
 *
 * `plans` is how one shared body serves three plans: omit it and the
 * content applies to everyone, set it and the content is dropped for
 * any plan not listed.
 */

export interface SubsectionDef {
  heading: string;
  blocks: Block[];
  plans?: PlanSlug[];
}

export interface SectionDef {
  id: string;
  heading: string;
  /** Content before the first subsection. */
  intro?: Block[];
  subsections: SubsectionDef[];
  plans?: PlanSlug[];
}

/* ── Resolved shape ───────────────────────────────────────────
 * What the reader and PDF renderer actually consume: filtered to one
 * plan, numbered, with every {§id} cross-reference token replaced by
 * the section number it resolves to.
 */

export interface Subsection {
  /** e.g. "3.4" */
  num: string;
  heading: string;
  blocks: Block[];
}

export interface Section {
  num: number;
  heading: string;
  intro: Block[];
  subsections: Subsection[];
}

export interface PlanSchedule {
  slug: PlanSlug;
  name: string;
  monthlyPrice: number;
  onboardingFee: number;
  /** Prose form used inside the terms, e.g. "up to three (3) websites". */
  siteLabel: string;
  maxSites: number;
  /**
   * **Do not inline this, even though every sold plan sets it to `true`.**
   *
   * Since the 2026-10-12 reprice all three tiers include the AI receptionist, which makes the
   * roughly fifteen `s.hasVoiceAgent` branches in the terms look like dead code. They are not:
   * `WEB_ONLY_SCHEDULE` sets this `false`, and it is the only schedule where those branches
   * render. Flattening them to the has-agent text would quietly destroy the ability to issue a
   * receptionist-free agreement, which is the one document a client who refuses AI can sign.
   */
  hasVoiceAgent: boolean;
  /** Null when the plan includes no voice agent, i.e. web-only only. */
  callMinutes: number | null;
  overagePerMinute: number | null;
  /** How the monthly edit allowance reads for this plan. */
  editAllowance: string;
  supportResponse: string;
  /**
   * Days of written notice required to cancel. **`0` on every plan since 2026-10-12**, which
   * is month-to-month with no minimum term and no early-termination fee.
   *
   * Kept as a field rather than deleted because `app/api/portal/cancel/route.ts` reads it and
   * the arithmetic degenerates correctly: at `0` the cancel target is now, and
   * `firstBoundaryAtOrAfter` returns the end of the period the client already paid for. That
   * is exactly the intended behaviour, so there was nothing to restructure. It also leaves one
   * obvious place to express a future change.
   */
  cancellationNoticeDays: number;
  included: string[];
  feeTable: [string, string][];
}

export interface ResolvedTerms {
  version: string;
  plan: PlanSlug;
  sections: Section[];
  schedule: PlanSchedule;
}

/**
 * Cross-reference token. Write `Section ${ref("accessibility")}` in prose and
 * it resolves to the section's final number for the plan being rendered.
 * An unknown id resolves to "[?]" rather than throwing, so a typo shows up in
 * review instead of taking down the signing page.
 */
export function ref(id: string): string {
  return `{§${id}}`;
}
