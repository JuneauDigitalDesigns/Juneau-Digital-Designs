/**
 * The portal for the website-only Starter plan (24 Nov 2026).
 *
 * `website` is shown as "Starter"; `starter` is "Starter + AI Receptionist". What a website-plan
 * client sees follows decisions D5 (one upsell, to the receptionist, never to Growth; no calls),
 * D6 (the upgrade is the agreement then a prorated charge), D9 (no lead texts) and B4 (past calls
 * stay viewable, read-only), in the copy Xander approved word for word (the copy batch, C1 to C8
 * and E5).
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    addReceptionistHref,
    effectivePlan,
    planName,
    planNameOf,
    tourTierFor,
    upgradeHref,
} from "../app/portal/types.ts";
import { cancellationCardText } from "../app/lib/plan-change-copy.ts";
import { BILLING_COPY } from "../app/lib/billing-tab.ts";
import { callSource } from "../app/lib/call-source.ts";
import { sampleInbox } from "../app/components/portal/tour/sample-data.ts";
import { sampleAnswer } from "../app/components/portal/tour/sample-mode.ts";
import { TOUR_STEPS, walkFor, wordsFor } from "../app/components/portal/tour/steps.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const site = (plan, webOnly = false) => ({ plan, webOnly });

/* ── names ─────────────────────────────────────────────────────────────────── */

test("plan names come from PLAN_LABELS, never from the id", () => {
    assert.equal(planName(site("website", true)), "Starter");
    assert.equal(planName(site("starter")), "Starter + AI Receptionist");
    assert.equal(planName(site("starter"), true), "Starter + AI");
    assert.equal(planName(site("growth")), "Growth");
    assert.equal(planName(site("enterprise")), "Enterprise");
    assert.equal(planNameOf("website"), "Starter");
    assert.equal(planNameOf("starter", true), "Starter + AI");
});

test("the legacy web-only shape (starter, receptionist declined) reads as the website plan", () => {
    assert.equal(effectivePlan(site("starter", true)), "website");
    assert.equal(planName(site("starter", true)), "Starter");
    assert.equal(tourTierFor(site("starter", true)), "website");
});

test("no portal component builds a plan name from the id", () => {
    for (const f of [
        "app/components/portal/PortalChrome.tsx",
        "app/components/portal/BillingSection.tsx",
        "app/components/portal/GrowthProvisioning.tsx",
    ]) {
        const src = read(f);
        assert.doesNotMatch(src, /charAt\(0\)\.toUpperCase\(\)/, f);
        assert.doesNotMatch(src, /const planLabel: Record/, f);
    }
});

/* ── the one upsell ────────────────────────────────────────────────────────── */

test("a website client's only upgrade is the receptionist, never Growth (D5)", () => {
    assert.equal(upgradeHref("acme", site("website", true)), "/terms/accept?plan=starter&upgrade=acme");
    assert.equal(addReceptionistHref("acme"), "/terms/accept?plan=starter&upgrade=acme");
    // Starter + AI Receptionist and Growth clients keep today's way up.
    assert.equal(upgradeHref("acme", site("starter")), "/terms/accept?plan=growth&upgrade=acme");
    assert.equal(upgradeHref("acme"), "/terms/accept?plan=growth&upgrade=acme");
});

test("the website plan's Home panel and locked pages say the approved words and offer no demo", () => {
    const panel = read("app/components/portal/overview/PipelineCard.tsx");
    for (const line of [
        "Add the AI receptionist",
        "When you can&apos;t pick up",
        "Starter + AI Receptionist is $297 a month,",
        "with no new onboarding fee.",
    ]) {
        assert.ok(panel.includes(line), line);
    }
    const customers = read("app/components/portal/crm/StarterShowcase.tsx");
    assert.match(customers, /Turn the people who contact you into repeat customers/);
    // Copy batch G8 (2026-11-25): the website plan's Customers page offers Starter + AI.
    assert.match(customers, /You already see every web inquiry in your Inbox\. Starter \+ AI Receptionist adds the next step: a place to track each one until the job is won, with an AI receptionist answering the calls you miss\./);
    for (const bullet of [
        '["A simple pipeline", "move each customer from Lead to Won so nothing gets forgotten."]',
        '["Follow-ups", "set a reminder on any customer so nobody waits on you."]',
        '["An AI receptionist", "answers the calls you miss, 24/7."]',
    ]) {
        assert.ok(customers.includes(bullet), bullet);
    }
    assert.match(customers, /This is a preview of what the\s+Customers board looks like on Starter \+ AI Receptionist\./);
    assert.match(customers, /Not included on your plan/);
    assert.doesNotMatch(customers, /Not included on Starter/);
    assert.doesNotMatch(customers, /Show me what Growth does for me|<GrowthDemo/, "no demo on the website plan");
    const calendar = read("app/components/portal/calendar/CalendarStarter.tsx");
    assert.match(calendar, /Not included on your plan/);
    assert.match(calendar, /\{!webOnly && \(\s*<Link/, "no demo button on the website plan");
    const page = read("app/portal/(dash)/page.tsx");
    assert.match(page, /site\.webOnly \? \(\s*[^]*?<ReceptionistUpsellPanel/);
});

/* ── cancelling: four cards (E5, B5) ───────────────────────────────────────── */

test("the cancel card has four versions: inside or after 30 days, with or without minutes", () => {
    const periodEnd = "December 24, 2026";
    // After 30 days, with minutes: today's card, unchanged.
    assert.equal(
        cancellationCardText({ periodEnd }),
        "You can cancel at any time. There's no notice period and no fee. You won't be charged again, apart from any call-minute overage from your final month. Your service stays on until the end of the month you've already paid for, on December 24, 2026.",
    );
    // After 30 days, Starter: the same without the overage clause (B5).
    assert.equal(
        cancellationCardText({ periodEnd, hasMinutes: false }),
        "You can cancel at any time. There's no notice period and no fee. You won't be charged again. Your service stays on until the end of the month you've already paid for, on December 24, 2026.",
    );
    // Inside 30 days, with minutes (E5).
    assert.equal(
        cancellationCardText({ periodEnd, refund: { amount: "$297" } }),
        "You can cancel at any time. Because you're cancelling within 30 days of your first payment, we'll refund your first monthly fee of $297 to your card, and your service ends today. The onboarding fee isn't refunded, and any call-minute overage you've already used is still billed.",
    );
    // Inside 30 days, Starter: ends at "isn't refunded." with no overage.
    const starter = cancellationCardText({ periodEnd, hasMinutes: false, refund: { amount: "$97" } });
    assert.equal(
        starter,
        "You can cancel at any time. Because you're cancelling within 30 days of your first payment, we'll refund your first monthly fee of $97 to your card, and your service ends today. The onboarding fee isn't refunded.",
    );
    assert.doesNotMatch(starter, /overage|minute/i);
});

test("the website plan never mentions overage on the billing tab (B6)", () => {
    assert.equal(BILLING_COPY.nextPaymentNoneHint, "apart from any call-minute overage from this month");
    assert.equal(BILLING_COPY.nextPaymentNoneHintNoMinutes, undefined);
    const src = read("app/components/portal/BillingSection.tsx");
    assert.match(src, /minutes=\{!site\.webOnly\}/);
    assert.match(src, /hasMinutes: terms\?\.hasMinutes \?\? !site\.webOnly/);
});

test("the cancel card reads the live terms, promises only that, and re-reads on a 409", () => {
    const src = read("app/components/portal/BillingSection.tsx");
    assert.match(src, /fetch\(`\/api\/portal\/cancel\?site=/);
    assert.match(src, /expect: terms\?\.mode \?\? "period-end"/);
    assert.match(src, /res\.status === 409/);
    assert.match(src, /onCancelled\(typeof data\.effectiveDate === "string" \? data\.effectiveDate : null\)/);
    assert.equal(BILLING_COPY.confirmAfterRefund, "We'll email you a confirmation, and your service ends today.");
    assert.equal(BILLING_COPY.confirmAfter, "We'll email you a confirmation, and this page will show the date your service ends.");
});

/* ── the Inbox ─────────────────────────────────────────────────────────────── */

test("a website client's Inbox has no Calls or Forms chip and says only website inquiries", () => {
    const bar = read("app/components/portal/inbox/InboxToolbar.tsx");
    assert.match(bar, /webOnly \? \(\["needs", "all"\] as const\)/);
    const state = read("app/components/portal/ui/FeatureState.tsx");
    assert.match(state, /whatItDoes: "Every inquiry from your website, in one place\."/);
    assert.match(state, /whenLive: "Website inquiries will land here as they come in\."/);
    assert.match(state, /emptyBody: "When someone fills in your website form, they'll show up here straight away\."/);
    assert.doesNotMatch(state, /at no extra cost/);
});

test("past calls are read-only: the list has no actions and says only the approved words", () => {
    const src = read("app/components/portal/inbox/PastCalls.tsx");
    assert.match(src, /From when you had the AI receptionist\. This call is read-only\./);
    assert.match(src, /Recordings are deleted a year after the call\./);
    assert.doesNotMatch(src, /onDone|onPromote|onDelete|onRemind|fetch\(|method:/);
    const bar = read("app/components/portal/inbox/InboxToolbar.tsx");
    assert.match(bar, /label="Past calls"/);
});

test("calls, recording and transcript routes read live calls or the kept past calls, nothing else", () => {
    const live = { plan: "starter", airtableBaseId: "appLIVE", retellAgentId: "agent_live", status: "live" };
    assert.deepEqual(callSource(live), { kind: "live", baseId: "appLIVE", agentId: "agent_live" });

    const past = {
        plan: "website",
        status: "live",
        airtableBaseId: null,
        retellAgentId: null,
        callHistory: { airtableBaseId: "appPAST", retellAgentId: "agent_past", endedAt: 1 },
    };
    assert.deepEqual(callSource(past), { kind: "past", baseId: "appPAST", agentId: "agent_past" });

    // A website site that never had a receptionist has no history and nothing to read.
    assert.equal(callSource({ plan: "website", status: "live" }), null);
    // `callHistory` alone, on a site that still has its receptionist, is not a second source.
    assert.equal(callSource({ ...live, callHistory: past.callHistory }).kind, "live");

    for (const f of [
        "app/api/portal/calls/route.ts",
        "app/api/portal/calls/[id]/recording/route.ts",
        "app/api/portal/calls/[id]/transcript/route.ts",
    ]) {
        assert.match(read(f), /callSource\(ctx\.site\)/, f);
    }
});

/* ── the tour ──────────────────────────────────────────────────────────────── */

test("the tier comes from the plan, not from whether the CRM happens to be ready", () => {
    assert.equal(tourTierFor(site("website", true)), "website");
    assert.equal(tourTierFor(site("starter")), "starter");
    assert.equal(tourTierFor(site("growth")), "growth");
    assert.equal(tourTierFor(site("enterprise")), "growth");
});

test("the website walk drops the steps about calls, minutes and lead texts (C6)", () => {
    const ids = (tier, device) => walkFor(tier, device).map((s) => s.id);
    for (const device of ["desktop", "mobile"]) {
        const w = ids("website", device);
        for (const gone of ["tiles", "said", "settings", "alerts", "minutes", "growth-adds", "promote", "customers"]) {
            assert.ok(!w.includes(gone), `${device}: ${gone}`);
        }
        assert.ok(w.includes("receptionist-adds"), device);
        assert.ok(w.includes("further"), device);
        assert.ok(w.includes("plan"), "the separate Your plan step stays");
        // The other tiers keep theirs.
        assert.ok(ids("starter", device).includes("minutes"));
        assert.ok(ids("starter", device).includes("growth-adds"));
        assert.ok(!ids("starter", device).includes("receptionist-adds"));
        assert.ok(ids("growth", device).includes("tiles"));
    }
});

test("the website walk says the approved words", () => {
    const words = (id, device = "desktop") => {
        const step = TOUR_STEPS.find((s) => s.id === id);
        return wordsFor(step, device, "website");
    };
    assert.equal(words("week").body, "Your new leads this week, from your website.");
    assert.deepEqual(words("receptionist-adds"), {
        title: "What the AI receptionist adds",
        body: "When you can't pick up, the AI receptionist answers and puts the caller in your Inbox. Tap Add the AI receptionist to see the plan.",
    });
    assert.equal(
        words("inbox").body,
        "Every inquiry from your website lands here. Tap one to see who it was and what they wanted.",
    );
    assert.equal(
        words("find").body,
        "**Needs you** shows what's still waiting on you. Switch to **All**, or search by name, email or what they said.",
    );
    // Unchanged for the other tiers.
    const find = TOUR_STEPS.find((s) => s.id === "find");
    assert.match(wordsFor(find, "desktop", "starter").body, /\*\*Calls\*\* or \*\*Forms\*\*/);
});

test("no website step promises a call, a minute count or a lead text", () => {
    for (const device of ["desktop", "mobile"]) {
        for (const step of walkFor("website", device)) {
            const { title, body } = wordsFor(step, device, "website");
            assert.doesNotMatch(`${title} ${body}`, /minutes|text for every new lead|recording|caught after hours/i, step.id);
        }
    }
});

test("the tour's sample Inbox has no calls for a website client", () => {
    const now = new Date("2026-11-24T15:00:00Z");
    const items = sampleInbox("hvac", now, { webOnly: true });
    assert.ok(items.length > 0);
    assert.ok(items.every((i) => i.source !== "call"));
    assert.ok(items.some((i) => i.id.startsWith("tour-")), "the tour's own lead stays, as a form inquiry");
    // Other plans still see calls.
    assert.ok(sampleInbox("hvac", now).some((i) => i.source === "call"));
    const answer = sampleAnswer("/api/portal/inbox", "GET", { trade: "hvac", now, growth: false, webOnly: true });
    assert.ok(answer.body.items.every((i) => i.source !== "call"));
});

/* ── lead texts (D9) ───────────────────────────────────────────────────────── */

test("an account of only website sites has no Text alerts card; a mixed one says which sites it covers (C7)", () => {
    const page = read("app/portal/(dash)/settings/page.tsx");
    assert.match(page, /textAlertSites=/);
    const section = read("app/components/portal/SettingsSection.tsx");
    assert.match(section, /textAlertSites !== "none" && \(/);
    assert.ok(
        section.includes(
            "Lead texts cover your sites with the AI receptionist. Leads from Starter sites stay in your Inbox.",
        ),
    );
});

test("Home shows no calls row or after-hours tile for the website plan, and Billing no minutes meter", () => {
    assert.match(read("app/components/portal/overview/LeadsWeekCard.tsx"), /\{!webOnly && \(/);
    assert.match(read("app/portal/(dash)/page.tsx"), /const caught = site\.webOnly \? null :/);
    assert.match(read("app/portal/(dash)/settings/billing/page.tsx"), /site\.webOnly \? undefined/);
});
