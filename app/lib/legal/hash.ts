import "server-only";
import { createHash } from "node:crypto";
import type { PlanSlug } from "../agreement-types";
import { getAddendumForPlan, getSchedule, getTermsForPlan } from "./index";
import type { Block, Section } from "./types";

/**
 * SHA-256 of the canonical terms text for a plan.
 *
 * Canonical means client-specific data is excluded — no site names, no signer
 * details — so the hash identifies *the document*, not the signing. Two clients
 * on the same plan and version produce the same hash; changing a single word of
 * the terms changes it. That's what makes it evidence of which words were
 * agreed to, years after v4.1 has shipped.
 *
 * Kept in its own module so the node:crypto import never reaches a client
 * bundle via the barrel in ./index.
 */
export function hashTermsForPlan(plan: PlanSlug): string {
  const { version, sections } = getTermsForPlan(plan);
  return hashSections(version, plan, sections);
}

/**
 * The same evidence, for the Site Addendum.
 *
 * Canonical in the same sense: the site names a client typed are excluded, so this
 * identifies the addendum *text* for a plan rather than one client's signing of it.
 * Master and addendum hashes cannot collide — the version string differs and is the first
 * line of the canonical form.
 */
export function hashAddendumForPlan(plan: PlanSlug): string {
  const { version, sections } = getAddendumForPlan(getSchedule(plan));
  return hashSections(version, plan, sections);
}

/** Shared canonical form, so the two documents can never be hashed by different rules. */
function hashSections(version: string, plan: PlanSlug, sections: Section[]): string {
  const canon = [version, plan, ...sections.flatMap(flattenSection)].join("\n");
  return createHash("sha256").update(canon, "utf8").digest("hex");
}

function flattenSection(s: Section): string[] {
  return [
    `${s.num}|${s.heading}`,
    ...s.intro.flatMap(flattenBlock),
    ...s.subsections.flatMap((sub) => [`${sub.num}|${sub.heading}`, ...sub.blocks.flatMap(flattenBlock)]),
  ];
}

function flattenBlock(b: Block): string[] {
  switch (b.kind) {
    case "para":
    case "callout":
    case "allcaps":
      return [`${b.kind}:${b.text}`];
    case "bullets":
      return b.items.map((i) => `bullet:${i}`);
    case "table":
      return b.rows.map(([k, v]) => `row:${k}=${v}`);
  }
}
