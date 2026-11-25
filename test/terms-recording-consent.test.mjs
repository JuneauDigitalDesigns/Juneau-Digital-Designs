/**
 * What the Terms of Service say about recording calls, read against what the product does.
 *
 * v5.3 told every client that Florida was a one-party consent state, which it is not, and that the
 * AI agent could be the consenting party. It also said a disclosure was configured only on
 * request, when every agent already opens with one (jdd-ops lib/voice-consent.js), and that the
 * portal does not surface recordings, when it plays them. v5.4 fixed all of it, and Terms of
 * Service v6.0 (2026-11-16) keeps every fix in plain words: §4.3 and §4.4, §7.6, §11 and §12.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
const { getTermsForPlan } = await import("../app/lib/legal/index.ts");

const PLANS = ["starter", "growth", "enterprise"];

/** Every word of one plan's document, as one string. */
const textOf = (plan, opts) => JSON.stringify(getTermsForPlan(plan, { campaign: "v1", ...opts }).sections);

/** One clause's words, by heading, from the AI receptionist section (Section 4). */
function clause(plan, heading) {
  const s = getTermsForPlan(plan, { campaign: "v1" }).sections.find((x) => x.heading === "THE AI RECEPTIONIST");
  assert.ok(s, `${plan} has the AI receptionist section`);
  assert.equal(s.num, 4, "the receptionist is Section 4 on every plan");
  const found = s.subsections.find((x) => x.heading === heading);
  assert.ok(found, `${plan} has "${heading}"`);
  return found.blocks.flatMap((b) => (b.kind === "bullets" ? b.items : [b.text])).join(" ");
}

for (const plan of PLANS) {
  test(`${plan}: Florida is stated as an all-party consent state`, () => {
    assert.doesNotMatch(textOf(plan), /one-party/i);
    assert.match(clause(plan, "Call recording"), /Florida is an all-party consent state \(Fla\. Stat\. § 934\.03\)/);
  });

  test(`${plan}: the AI agent is not the consenting party; the client is`, () => {
    assert.doesNotMatch(textOf(plan), /serves as the consenting party/i);
    assert.match(clause(plan, "Call recording"), /As the business each call is for, you consent to those calls being recorded and summarized\./);
  });

  test(`${plan}: the disclosure is always on, and we won't remove it`, () => {
    assert.match(clause(plan, "Call recording"), /the receptionist's first words say that the call is recorded, and we will not remove that/);
  });

  test(`${plan}: a call the client answers is not recorded by us, and the client owns its own recording`, () => {
    const c = clause(plan, "Call recording");
    assert.match(c, /We do not record calls you answer yourself\./);
    assert.match(c, /If you record any call by your own means, getting any consent the law requires is your responsibility\./);
  });

  test(`${plan}: the agent is described as it behaves on AI disclosure`, () => {
    assert.match(clause(plan, "Saying it is an AI"), /If a caller asks, the receptionist says it is a virtual assistant\./);
  });

  test(`${plan}: recordings play in the portal while a client, and nothing promises transcripts`, () => {
    const text = textOf(plan);
    assert.match(text, /you can play them from your portal while you are a client/);
    assert.doesNotMatch(text, /full call transcripts/i);
  });

  test(`${plan}: the indemnity and breach clauses point at the recording clause`, () => {
    const text = textOf(plan);
    assert.doesNotMatch(text, /\{§|\[\?\]/, "every cross-reference resolved");
    assert.ok(text.includes("unless it results from our failing to set up the disclosure in Section 4.3"));
    assert.ok(text.includes("you cause the recording disclosure or the callback consent box to be removed or disabled"));
  });
}

test("the website-only document says the receptionist section does not apply to it", () => {
  const { sections } = getTermsForPlan("starter", { webOnly: true, campaign: "v1" });
  const s = sections.find((x) => x.heading === "THE AI RECEPTIONIST");
  assert.equal(s.intro[0].text, "This section does not apply to the Starter plan, which does not include the AI receptionist.");
});

test("the pricing page does not sell transcripts the portal does not have", () => {
  const page = readFileSync(new URL("../app/components/pricing/pricingpageclient.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /call transcripts/i);
});
