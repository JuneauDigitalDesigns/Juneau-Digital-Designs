import type { PlanSlug } from "../agreement-types";
import { getSchedule } from "./schedules";
import { buildSections, TERMS_VERSION } from "./terms-v4";
import type { Block, PlanSchedule, ResolvedTerms, Section, SectionDef } from "./types";

export { TERMS_VERSION, PROVIDER } from "./terms-v4";
export { getSchedule, SCHEDULES } from "./schedules";
// The short instrument a returning client signs for their second site and every one after.
// Built from the same Section/Block vocabulary as the master, so `TermsReader` and
// `pdf-renderer` consume it without knowing which document they were handed.
export { getAddendumForPlan, ADDENDUM_VERSION } from "./addendum-v1";
export type { Block, PlanSchedule, ResolvedTerms, Section, Subsection } from "./types";

const TOKEN = /\{§([a-z]+)\}/g;

interface Options {
  /** Enterprise site names captured at signing. Omit for the canonical text. */
  siteNames?: string[];
}

/**
 * Resolves the shared body for one plan: drops sections and subsections that
 * don't apply, numbers what remains so there are no gaps, replaces every
 * {§id} cross-reference with its final number, and appends Schedule A.
 */
export function getTermsForPlan(plan: PlanSlug, opts: Options = {}): ResolvedTerms {
  const schedule = getSchedule(plan);
  const defs = buildSections(schedule).filter((d) => applies(d.plans, plan));

  const numById = new Map<string, number>();
  defs.forEach((d, i) => numById.set(d.id, i + 1));

  const deref = (text: string) =>
    text.replace(TOKEN, (_, id: string) => String(numById.get(id) ?? "[?]"));

  const sections: Section[] = defs.map((def, i) => {
    const num = i + 1;
    return {
      num,
      heading: def.heading,
      intro: (def.intro ?? []).map((b) => mapBlock(b, deref)),
      subsections: def.subsections
        .filter((sub) => applies(sub.plans, plan))
        .map((sub, j) => ({
          num: `${num}.${j + 1}`,
          heading: sub.heading,
          blocks: sub.blocks.map((b) => mapBlock(b, deref)),
        })),
    };
  });

  sections.push(buildScheduleA(schedule, opts.siteNames));

  return { version: TERMS_VERSION, plan, sections, schedule };
}

function applies(plans: PlanSlug[] | undefined, plan: PlanSlug): boolean {
  return !plans || plans.includes(plan);
}

/** Applies a text transform across every string a block carries. */
function mapBlock(block: Block, fn: (t: string) => string): Block {
  switch (block.kind) {
    case "para":
      return { kind: "para", text: fn(block.text) };
    case "callout":
      return { kind: "callout", text: fn(block.text) };
    case "allcaps":
      return { kind: "allcaps", text: fn(block.text) };
    case "bullets":
      return { kind: "bullets", items: block.items.map(fn) };
    case "table":
      return { kind: "table", rows: block.rows.map(([k, v]) => [fn(k), fn(v)] as [string, string]) };
  }
}

/**
 * Schedule A renders as a trailing section with `num: 0`, which both renderers
 * treat as "print the heading without a number" — contracts don't number their
 * schedules, and it keeps Schedule A inside the single scroll container so
 * reaching the bottom means the client saw the plan terms too.
 */
function buildScheduleA(s: PlanSchedule, siteNames?: string[]): Section {
  const subsections: Section["subsections"] = [
    {
      num: "",
      heading: "What's Included",
      blocks: [{ kind: "bullets", items: s.included }],
    },
    {
      num: "",
      heading: "Plan Fees",
      blocks: [{ kind: "table", rows: s.feeTable }],
    },
  ];

  if (s.slug === "enterprise") {
    const names = (siteNames ?? []).filter((n) => n.trim().length > 0);
    subsections.push({
      num: "",
      heading: "Sites Covered Under This Agreement",
      blocks: [
        {
          kind: "para",
          text: "The Enterprise plan covers up to three (3) sites. Sites may be multiple locations of the same business, multiple separate businesses owned by Client, or multiple brands of a single parent business owned by Client. If signing with fewer than three sites, an additional site may be added later under the site list terms of this Agreement.",
        },
        names.length > 0
          ? { kind: "bullets", items: names.map((n, i) => `Site ${i + 1}: ${n}`) }
          : {
              kind: "bullets",
              items: ["Site 1: ____________________", "Site 2: ____________________", "Site 3: ____________________ (optional)"],
            },
      ],
    });
  }

  return {
    num: 0,
    heading: `SCHEDULE A — ${s.name.toUpperCase()} PLAN DETAILS`,
    intro: [
      {
        kind: "para",
        text: `Plan: ${s.name} — $${s.monthlyPrice.toLocaleString("en-US")} per month.`,
      },
    ],
    subsections,
  };
}
