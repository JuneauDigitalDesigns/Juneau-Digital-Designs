/**
 * What the Service Agreement says about recording calls, read against what the product does.
 *
 * v5.3 told every client that Florida was a one-party consent state, which it is not, and that the
 * AI agent could be the consenting party. It also said a disclosure was configured only on
 * request, when every agent already opens with one (jdd-ops lib/voice-consent.js), and that the
 * portal does not surface recordings, when it plays them. Each test here fails on that text.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTermsForPlan, TERMS_VERSION } from "../app/lib/legal/index.ts";

const VOICE_PLANS = ["starter", "growth", "enterprise"];

/** Every word of one plan's agreement, as one string. */
const textOf = (plan, opts) => JSON.stringify(getTermsForPlan(plan, opts).sections);

/** One subsection's words, by heading, from the AI Receptionist section. */
function subsection(plan, heading) {
  const agents = getTermsForPlan(plan).sections.find((s) => s.heading === "AI RECEPTIONIST");
  assert.ok(agents, `${plan} has the AI Receptionist section`);
  const found = agents.subsections.find((x) => x.heading === heading);
  assert.ok(found, `${plan} has "${heading}"`);
  return found.blocks.flatMap((b) => (b.kind === "bullets" ? b.items : [b.text])).join(" ");
}

for (const plan of VOICE_PLANS) {
  test(`${plan}: Florida is stated as an all-party consent state`, () => {
    const text = textOf(plan);
    assert.doesNotMatch(text, /Florida operates under one-party/i);
    assert.doesNotMatch(text, /one-party consent for telephone/i);
    assert.match(
      subsection(plan, "Call Recording and Consent"),
      /Some states, including Florida \(Fla\. Stat\. Section 934\.03\) and California, require the consent of all parties/,
    );
  });

  test(`${plan}: the AI agent is not the consenting party; Client is`, () => {
    assert.doesNotMatch(textOf(plan), /serves as the consenting party/i);
    assert.match(subsection(plan, "Call Recording and Consent"), /Client consents to the recording and transcription of those calls/);
  });

  test(`${plan}: the disclosure is always on, not configured on request`, () => {
    const clause = subsection(plan, "Call Recording and Consent");
    assert.doesNotMatch(clause, /must inform Provider during onboarding/);
    assert.match(clause, /first thing it says on every call it handles/);
    assert.match(clause, /Provider will not remove this disclosure/);
  });

  test(`${plan}: a call Client answers is not recorded by Provider, and Client owns its own recording`, () => {
    const clause = subsection(plan, "Call Recording and Consent");
    assert.match(clause, /does not record or transcribe a call that Client answers/);
    assert.match(clause, /Client alone is responsible for obtaining any consent/);
  });

  test(`${plan}: the agent is described as it behaves on AI disclosure`, () => {
    assert.match(subsection(plan, "AI Caller Disclosure"), /does not state that it is an AI without being asked/);
  });

  test(`${plan}: recordings play in the portal, transcripts do not`, () => {
    const retention = subsection(plan, "Call Data Retention");
    assert.doesNotMatch(retention, /recordings and verbatim transcripts are not surfaced/);
    assert.match(retention, /can play a call's audio recording from the client portal/);
    assert.match(retention, /Verbatim transcripts are not surfaced/);
    assert.doesNotMatch(textOf(plan), /full call transcripts/i);
  });

  test(`${plan}: the indemnity and breach clauses cite the section that holds these terms`, () => {
    const { sections } = getTermsForPlan(plan);
    const { num } = sections.find((s) => s.heading === "AI RECEPTIONIST");
    const text = JSON.stringify(sections);
    assert.doesNotMatch(text, /\{§/, "every cross-reference resolved");
    assert.ok(text.includes(`Causing the recording disclosure described in Section ${num} to be removed`));
    assert.ok(text.includes(`configure the recording disclosure as described in Section ${num}`));
    assert.doesNotMatch(text, /jurisdictional disclosure or recording consent/);
  });
}

test("the website-only agreement carries none of the recording terms", () => {
  const text = textOf("starter", { webOnly: true });
  assert.doesNotMatch(text, /Call Recording and Consent/);
  assert.doesNotMatch(text, /Fla\. Stat\. Section 934\.03/);
});

test("the corrected text does not ship under the version that said otherwise", () => {
  assert.notEqual(TERMS_VERSION, "v5.3");
});

test("the pricing page does not sell transcripts the portal does not have", () => {
  const page = readFileSync(new URL("../app/components/pricing/pricingpageclient.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /call transcripts/i);
});
