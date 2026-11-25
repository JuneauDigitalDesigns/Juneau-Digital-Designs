/**
 * Which plan gets which part of the portal (Xander, 2026-11-25; schema v1.47.0).
 *
 * - Customers (customers, notes, jobs, follow-ups, Promote, the Home pipeline with dollars):
 *   Starter + AI Receptionist, Growth and Enterprise. Not the website plan.
 * - Calendar (appointments): Growth and Enterprise only.
 * - Customer texting, review requests and the Review message setting: Growth and Enterprise only.
 *
 * The UI hides what a plan doesn't have, and that is not a security boundary, so every route is
 * held here as itself: real routes, real stores against an in-memory Upstash, the real plan gate
 * (`siteFeature`); only the session lookup is stubbed (`portal-crm-hook.mjs`).
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./portal-crm-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => (redis.owns(input) ? redis.handle(input, init) : realFetch(input, init));

const { siteFeatures } = await import("@jdd/schema");
const crm = await import("../app/lib/portal-crm.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");
const customersRoute = await import("../app/api/portal/customers/route.ts");
const detailRoute = await import("../app/api/portal/customers/[id]/route.ts");
const jobsRoute = await import("../app/api/portal/jobs/route.ts");
const notesRoute = await import("../app/api/portal/notes/route.ts");
const tasksRoute = await import("../app/api/portal/tasks/route.ts");
const apptRoute = await import("../app/api/portal/appointments/route.ts");
const reviewMessageRoute = await import("../app/api/portal/review-message/route.ts");
const { PORTAL_TABS, tabAvailability } = await import("../app/portal/types.ts");

const OWNER = "owner@yourhvac.test";
const BASE = { slug: "your-hvac", name: "Your HVAC Co.", status: "live" };
const SITES = {
    website: { ...BASE, plan: "website" },
    // The legacy web-only shape: still read, and still a website client.
    legacyWebOnly: { ...BASE, plan: "starter", receptionistMode: "declined" },
    starter: { ...BASE, plan: "starter" },
    growth: { ...BASE, plan: "growth" },
    enterprise: { ...BASE, plan: "enterprise" },
};
const as = (site) => {
    globalThis.__portalCrm = { email: OWNER, site };
};

const req = (method, body) =>
    new Request("https://portal.test/api?site=your-hvac", {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
const status = async (route, method, body) => (await route[method](req(method, body))).status;
const detail = async (id) => {
    const res = await detailRoute.GET(new Request(`https://portal.test/api/portal/customers/${id}?site=your-hvac`), {
        params: Promise.resolve({ id }),
    });
    return { status: res.status, json: await res.json() };
};

let dave;
beforeEach(async () => {
    redis.reset();
    const made = await crm.createCustomer(
        accountScope(OWNER),
        BASE.slug,
        { name: "Dave Kowalski", phone: null, address: "2210 Wren Hollow Rd", source: "manual" },
        "user_test",
    );
    dave = made.customer;
});

/* ── the gate itself ─────────────────────────────────────────────────────── */

test("the schema's split: Customers on Starter + AI and up, Calendar and messaging Growth and up", () => {
    const f = (site) => siteFeatures(site);
    assert.equal(f(SITES.website).crm.state, "not-on-plan");
    assert.equal(f(SITES.legacyWebOnly).crm.state, "not-on-plan");
    assert.equal(f(SITES.starter).crm.state, "ready");
    assert.equal(f(SITES.growth).crm.state, "ready");
    assert.equal(f(SITES.enterprise).crm.state, "ready");

    for (const plan of ["website", "legacyWebOnly", "starter"]) {
        assert.equal(f(SITES[plan]).calendar.state, "not-on-plan", plan);
        assert.equal(f(SITES[plan]).messaging.state, "not-on-plan", plan);
    }
    assert.equal(f(SITES.growth).calendar.state, "ready");
    assert.equal(f(SITES.enterprise).calendar.state, "ready");
});

test("the tabs: Customers follows `crm`, Calendar follows `calendar`", () => {
    const tab = (id) => PORTAL_TABS.find((t) => t.id === id);
    assert.equal(tab("customers").feature, "crm");
    assert.equal(tab("calendar").feature, "calendar");
    const starter = siteFeatures(SITES.starter);
    assert.equal(tabAvailability(tab("customers").feature, starter).state, "ready");
    assert.equal(tabAvailability(tab("calendar").feature, starter).state, "not-on-plan");
    const website = siteFeatures(SITES.website);
    assert.equal(tabAvailability(tab("customers").feature, website).state, "not-on-plan");
    assert.equal(tabAvailability(tab("calendar").feature, website).state, "not-on-plan");
});

/* ── Starter + AI Receptionist ───────────────────────────────────────────── */

test("Starter + AI: the Customers board, its records, jobs, notes and follow-ups all work", async () => {
    as(SITES.starter);
    const list = await customersRoute.GET(req("GET"));
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.equal(body.customers.length, 1);
    assert.equal(body.messagingState, "not-on-plan", "the board knows texting isn't on the plan");

    assert.equal(await status(jobsRoute, "POST", { customerId: dave.customerId, service: "Furnace repair", amount: 450 }), 201);
    assert.equal(await status(notesRoute, "POST", { customerId: dave.customerId, body: "Side gate sticks." }), 201);
    assert.equal(await status(tasksRoute, "POST", { customerId: dave.customerId, title: "Send the quote Friday" }), 201);

    const rec = await detail(dave.customerId);
    assert.equal(rec.status, 200);
    assert.equal(rec.json.jobs.length, 1);
    assert.equal(rec.json.calendarReady, false, "the record offers no booking");
    assert.deepEqual(rec.json.appointments, []);
    assert.equal(rec.json.messagingState, "not-on-plan");
});

test("Starter + AI: the calendar and its appointments are refused", async () => {
    as(SITES.starter);
    assert.equal(await status(apptRoute, "GET"), 403);
    assert.equal(await status(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-30" }), 403);
});

test("Starter + AI: the Review message setting is refused, read and write", async () => {
    as(SITES.starter);
    assert.equal(await status(reviewMessageRoute, "GET"), 403);
    assert.equal(await status(reviewMessageRoute, "PUT", { template: "Thanks!" }), 403);
});

test("a growth → starter downgrade keeps the bookings stored but shows none on the record", async () => {
    as(SITES.growth);
    assert.equal(await status(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-30" }), 201);
    assert.equal((await detail(dave.customerId)).json.appointments.length, 1);
    as(SITES.starter);
    assert.deepEqual((await detail(dave.customerId)).json.appointments, []);
    as(SITES.growth);
    assert.equal((await detail(dave.customerId)).json.appointments.length, 1, "nothing was deleted");
});

/* ── the website plan ────────────────────────────────────────────────────── */

for (const shape of ["website", "legacyWebOnly"]) {
    test(`${shape}: Customers, its records, jobs, notes, follow-ups, calendar and review message are all refused`, async () => {
        as(SITES[shape]);
        assert.equal((await customersRoute.GET(req("GET"))).status, 403);
        assert.equal((await detail(dave.customerId)).status, 403);
        assert.equal(await status(jobsRoute, "POST", { customerId: dave.customerId, service: "x" }), 403);
        assert.equal(await status(notesRoute, "POST", { customerId: dave.customerId, body: "x" }), 403);
        assert.equal(await status(tasksRoute, "POST", { customerId: dave.customerId, title: "x" }), 403);
        assert.equal(await status(apptRoute, "GET"), 403);
        assert.equal(await status(reviewMessageRoute, "GET"), 403);
    });
}

/* ── Growth and Enterprise ───────────────────────────────────────────────── */

for (const plan of ["growth", "enterprise"]) {
    test(`${plan}: Customers, Calendar and the Review message setting are all ready`, async () => {
        as(SITES[plan]);
        assert.equal((await customersRoute.GET(req("GET"))).status, 200);
        assert.equal(await status(apptRoute, "GET"), 200);
        assert.equal(await status(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-30" }), 201);
        const rec = await detail(dave.customerId);
        assert.equal(rec.json.calendarReady, true);
        assert.equal(rec.json.appointments.length, 1);
        assert.equal(await status(reviewMessageRoute, "GET"), 200);
        assert.equal(await status(reviewMessageRoute, "PUT", { template: "Thanks for choosing us!" }), 200);
    });
}

test("Growth before the carriers clear: the Review message setting still works (a setting, not a send)", async () => {
    // A live Growth site whose texting is still `connecting` (no A2P campaign verified).
    const waiting = { ...SITES.growth };
    assert.notEqual(siteFeatures(waiting).messaging.state, "not-on-plan");
    as(waiting);
    assert.equal(await status(reviewMessageRoute, "GET"), 200);
});

/* ── the screens, at source level ────────────────────────────────────────── */

function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

test("the Review message row shows only where messaging is on the plan, in More and in Settings", () => {
    assert.match(code("app/components/portal/MoreScreen.tsx"), /selected\.features\.messaging\.state !== "not-on-plan" && \(/);
    assert.match(code("app/components/portal/SettingsSection.tsx"), /site\.features\.messaging\.state === "not-on-plan"\) return null;/);
    assert.match(code("app/components/portal/ReviewMessageScreen.tsx"), /const onPlan = selected\.features\.messaging\.state !== "not-on-plan";/);
    for (const f of ["MoreScreen", "SettingsSection", "ReviewMessageScreen"]) {
        assert.doesNotMatch(code(`app/components/portal/${f}.tsx`), /features\??\.crm\??\.state/, f);
    }
});

test("the record leaves out Text and Review where messaging isn't on the plan, and keeps the approved line", () => {
    const record = code("app/components/portal/crm/CustomerRecord.tsx");
    assert.match(record, /return review\.messagingState !== "not-on-plan";/);
    assert.equal(record.match(/canMessage\(review\) && <ReviewAnchor/g)?.length, 2, "both headers");
    assert.equal(record.match(/customer\.phone && canMessage\(review\) && \(/g)?.length, 2, "both Text buttons");
    assert.ok(record.includes("Texting your customers comes with Growth."));
    // No calendar on the plan: no booking, no visits, no way to the locked page.
    assert.match(record, /calendarLink=\{calendarOn \? calendarHref\(siteSlug\) : undefined\}/);
    assert.match(record, /renderActions=\{!calendarOn \? undefined :/);
});

test("Home: the pipeline on every Customers plan, Growth's panel beneath it on Starter + AI, the receptionist on the website plan", () => {
    const page = code("app/portal/(dash)/page.tsx");
    assert.match(page, /site\.features\.crm\.state === "ready" && \(\s*<Suspense[\s\S]{0,80}?<PipelineBlock/);
    assert.match(page, /site\.webOnly \? \([\s\S]{0,120}?<ReceptionistUpsellPanel/);
    assert.match(page, /site\.features\.calendar\.state === "not-on-plan" \? \([\s\S]{0,40}?<GrowthLockedPanel/);
});

test("?demo=growth still opens the Growth demo for Starter + AI, now on its own board", () => {
    const section = code("app/components/portal/crm/CustomersSection.tsx");
    assert.match(section, /<GrowthDemoOnArrival site=\{site\} \/>/);
    const arrival = code("app/components/portal/crm/GrowthDemoOnArrival.tsx");
    assert.match(arrival, /const eligible = !site\.webOnly && site\.features\.calendar\.state === "not-on-plan";/);
    assert.match(arrival, /searchParams\.delete\(DEMO_PARAM\)/);
    assert.match(arrival, /<GrowthDemo upgradeUrl=\{upgradeHref\(site\.slug, site\)\}[^>]*trade=\{site\.sampleTrade\}/);
    // The website plan's page has no demo at all (D5).
    assert.doesNotMatch(code("app/components/portal/crm/StarterShowcase.tsx"), /GrowthDemo|demo=growth|DEMO_PARAM/);
});

/* ── copy batch G, approved word for word (2026-11-25) ───────────────────── */

test("G1 and G2: the Terms schedules move the pipeline to Starter + AI and give Growth the calendar", async () => {
    const { SCHEDULES } = await import("../app/lib/legal/schedules.ts");
    const PIPELINE =
        "A customer relationship management (CRM) pipeline in the client portal, for tracking each lead from first contact to a won or lost job, with notes, follow-up reminders, job value, and tags";
    const CALENDAR =
        "A scheduling calendar in the client portal, for booking job visits, estimates, and follow-up calls with each customer";
    const starter = SCHEDULES.starter.included;
    const at = starter.indexOf("Website contact form submissions recorded as leads in the client portal");
    assert.ok(at >= 0);
    assert.equal(starter[at + 1], PIPELINE, "G1 sits right after the web-form line");
    const growth = SCHEDULES.growth.included;
    assert.ok(growth.includes(CALENDAR));
    assert.ok(!growth.some((l) => l.startsWith("A customer relationship management (CRM) pipeline")), "G2 replaced it");
    assert.ok(!SCHEDULES.website.included.some((l) => /CRM|calendar/.test(l)), "the website plan gets neither");
});

test("G3, G4: the pricing cards", () => {
    const src = readFileSync("app/components/pricing/pricingpageclient.tsx", "utf8");
    assert.ok(src.includes(`{ text: "A customer pipeline in your portal: move every lead from Lead to Won, with notes, follow-ups, job value and tags" }`));
    assert.ok(!src.includes("A guided walkthrough of Growth's pipeline"));
    assert.ok(src.includes(`{ strong: "A calendar for every job.", text: "Book job visits, estimates and follow-up calls against each customer, in one month view." }`));
    assert.ok(!src.includes(`strong: "Customer pipeline."`));
    // G4 stays first among Growth's items.
    const growthItems = src.slice(src.indexOf(`key: "growth"`));
    assert.ok(growthItems.indexOf("A calendar for every job.") < growthItems.indexOf("Customer texts and Google reviews."));
});

test("G9: the Growth panel on Starter + AI's Home", () => {
    const src = readFileSync("app/components/portal/overview/PipelineCard.tsx", "utf8").replace(/\s+/g, " ");
    assert.ok(src.includes("Book every job, then ask for the review"));
    assert.ok(src.includes("Growth adds a calendar, texting from your business number and one-tap review requests. See it working with sample customers."));
    assert.ok(src.includes(`data-tour="ov-locked"`), "the tour's growth-adds step keeps its anchor");
});

test("G10: the Calendar's not-ready words, and no invented empty state", () => {
    const src = readFileSync("app/components/portal/ui/FeatureState.tsx", "utf8").replace(/\s+/g, " ");
    assert.ok(src.includes(`calendar: { noun: "Calendar", whatItDoes: "Book job visits, estimates and follow-up calls against each customer, and see them in one month view.", whenLive: "Your bookings and follow-ups will appear here.", },`));
    assert.match(src, /type NoEmptyState = "calendar";/);
});
