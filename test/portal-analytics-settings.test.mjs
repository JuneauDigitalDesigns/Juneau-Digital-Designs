/**
 * Portal nav, Analytics and Settings (portal UX rework, 2026-11-09).
 *
 * On the code before this change these fail:
 *   - The nav had seven tabs, with Traffic, Performance and Billing each on their own; Analytics
 *     and Settings › Plan & billing did not exist.
 *   - Nothing combined two feature gates, so a single Analytics tab could only have been gated
 *     on one of `traffic` / `performance` and padlocked a site that has the other.
 *   - /portal/traffic, /portal/performance and /portal/billing were the pages themselves, so
 *     removing them would have broken every bookmark and emailed link.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const types = await import("../app/portal/types.ts");
const analytics = await import("../app/lib/portal-analytics.ts");

/* ── nav ─────────────────────────────────────────────────────────────────── */

test("the tabs are Overview, Inbox, Customers, Analytics, Settings, Support", () => {
  assert.deepEqual(
    types.PORTAL_TABS.map((t) => t.label),
    ["Overview", "Inbox", "Customers", "Analytics", "Settings", "Support"],
  );
});

test("the phone bar holds four tabs plus More, and More holds the rest", () => {
  assert.deepEqual([...types.MOBILE_BAR_TABS], ["overview", "calls", "customers", "analytics"]);
  assert.deepEqual([...types.MOBILE_MORE_TABS], ["settings", "support"]);
  const all = [...types.MOBILE_BAR_TABS, ...types.MOBILE_MORE_TABS].sort();
  assert.deepEqual(all, types.PORTAL_TABS.map((t) => t.id).sort(), "every tab is reachable on a phone");
});

test("every tab has a rail icon", () => {
  const chrome = read("app/components/portal/PortalChrome.tsx");
  const map = /const TAB_ICON = \{([\s\S]*?)\}/.exec(chrome)?.[1] ?? "";
  for (const t of types.PORTAL_TABS) assert.match(map, new RegExp(`\\b${t.id}:`), `no icon for ${t.id}`);
});

const ready = { state: "ready" };
const locked = { state: "not-on-plan" };
const building = { state: "pending-build" };
const features = (over) => ({
  calls: ready, traffic: ready, performance: ready, leads: ready, crm: ready, messaging: ready, ...over,
});

test("Analytics is open when either traffic or performance is", () => {
  const tab = types.PORTAL_TABS.find((t) => t.id === "analytics");
  assert.deepEqual([...tab.feature], ["traffic", "performance"]);

  assert.equal(types.tabAvailability(tab.feature, features({})).state, "ready");
  assert.equal(types.tabAvailability(tab.feature, features({ traffic: building })).state, "ready");
  assert.equal(types.tabAvailability(tab.feature, features({ performance: locked })).state, "ready");
  // Neither ready: the not-yet state, not a padlock, unless both are off the plan.
  assert.equal(types.tabAvailability(tab.feature, features({ traffic: locked, performance: building })).state, "pending-build");
  assert.equal(types.tabAvailability(tab.feature, features({ traffic: locked, performance: locked })).state, "not-on-plan");
  // Single gates and ungated tabs are unchanged.
  assert.equal(types.tabAvailability("crm", features({ crm: locked })).state, "not-on-plan");
  assert.equal(types.tabAvailability(null, features({})), null);
});

test("the rail and More drawer mark tabs through tabAvailability", () => {
  const chrome = read("app/components/portal/PortalChrome.tsx");
  assert.match(chrome, /tabAvailability\(tab\.feature, selected\.features\)/);
});

test("Settings opens out into Account and Plan & billing in the rail", () => {
  assert.deepEqual(types.SETTINGS_TABS.map((t) => t.label), ["Account", "Plan & billing"]);
  assert.equal(types.settingsTabFor("/portal/settings"), "account");
  assert.equal(types.settingsTabFor("/portal/settings/billing"), "billing");
  assert.equal(types.settingsTabFor("/portal/analytics"), null);
  const chrome = read("app/components/portal/PortalChrome.tsx");
  assert.match(chrome, /SETTINGS_TABS\.map/);
});

/* ── old paths ───────────────────────────────────────────────────────────── */

test("the retired tabs redirect, keeping every parameter and landing on their section", () => {
  assert.equal(
    types.legacyTabDestination("traffic", { site: "rivera-hvac" }),
    "/portal/analytics?site=rivera-hvac#visitors",
  );
  assert.equal(
    types.legacyTabDestination("performance", { site: "a b", utm: ["x", "y"], none: undefined }),
    "/portal/analytics?site=a+b&utm=x&utm=y#speed",
  );
  assert.equal(types.legacyTabDestination("billing", { site: "rivera-hvac" }), "/portal/settings/billing?site=rivera-hvac");
  assert.equal(types.legacyTabDestination("billing", {}), "/portal/settings/billing");

  for (const tab of ["traffic", "performance", "billing"]) {
    const page = read(`app/portal/(dash)/${tab}/page.tsx`);
    assert.match(page, new RegExp(`redirect\\(legacyTabDestination\\("${tab}", await searchParams\\)\\)`), tab);
    assert.doesNotMatch(page, /Section/, `${tab} still renders a page instead of redirecting`);
  }
});

test("the new pages exist where the redirects and links point", () => {
  for (const p of [
    "app/portal/(dash)/analytics/page.tsx",
    "app/portal/(dash)/settings/page.tsx",
    "app/portal/(dash)/settings/billing/page.tsx",
    "app/portal/(dash)/settings/layout.tsx",
  ]) {
    assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), p);
  }
});

/** Every .ts/.tsx under a directory. */
function sources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(path);
  }
  return out;
}

test("no link outside the Overview's own files still points at a retired tab", () => {
  // The Overview (OverviewSection, HealthStrip) is being rebuilt in a parallel change that
  // removes those links; until it lands the redirects carry them.
  const allowed = new Set([
    join("app", "components", "portal", "OverviewSection.tsx"),
    join("app", "components", "portal", "HealthStrip.tsx"),
  ]);
  // Code, not prose: comments explaining the redirects name the old paths on purpose. The
  // line-comment strip skips `://` so an absolute URL in a string is still checked.
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const offenders = [];
  for (const file of sources("app")) {
    if (allowed.has(file)) continue;
    const src = code(readFileSync(file, "utf8"));
    // `/api/portal/billing` and friends are the data routes, which did not move.
    if (
      /(?<!\/api)\/portal\/(traffic|performance|billing)\b/.test(src) ||
      /tabHref\(\s*"(traffic|performance|billing)"/.test(src)
    ) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});

test("a finished downgrade lands on Plan & billing directly", () => {
  assert.match(read("app/components/agreement/AgreementClient.tsx"), /\/portal\/settings\/billing\?site=/);
});

/* ── Analytics arithmetic ────────────────────────────────────────────────── */

test("the date range is 7, 30 or 90 days, 30 by default", () => {
  assert.equal(analytics.parseRange("7"), 7);
  assert.equal(analytics.parseRange("90"), 90);
  assert.equal(analytics.parseRange(null), 30);
  assert.equal(analytics.parseRange("365"), 30);
  assert.equal(analytics.parseRange("abc"), 30);
  assert.match(read("app/api/portal/traffic/route.ts"), /parseRange\(/);
});

test("enquiries are counted per range, with the window before it and the days they arrived", () => {
  const now = Date.UTC(2026, 10, 9, 15, 0); // Nov 9, 15:00 UTC
  const at = (d, h = 12) => new Date(Date.UTC(2026, 10, d, h)).toISOString();
  const oct = (d) => new Date(Date.UTC(2026, 9, d, 12)).toISOString();
  const s = analytics.summarizeEnquiries(
    [at(9), at(9, 8), at(5), at(1), oct(28), oct(20), oct(5), "not a date", at(10)],
    now,
  );
  // 7 days: since Nov 2. Nov 9 ×2 and Nov 5 count; Nov 10 is in the future and is ignored.
  assert.deepEqual(s[7], { count: 3, previous: 2, days: ["20261105", "20261109"] });
  // 30 days: since Oct 10. Previous window: Sep 10 to Oct 9.
  assert.equal(s[30].count, 6);
  assert.equal(s[30].previous, 1);
  assert.equal(s[90].count, 7);
});

test("visits → enquiries is a rate and a 1-in-N, and never divides by nothing", () => {
  assert.deepEqual(analytics.enquiryRate(23, 1359), { pct: (23 / 1359) * 100, oneIn: 59 });
  assert.equal(analytics.formatRate(analytics.enquiryRate(23, 1359).pct), "1.7%");
  assert.deepEqual(analytics.enquiryRate(0, 400), { pct: 0, oneIn: null });
  assert.equal(analytics.enquiryRate(3, 0), null);
  assert.equal(analytics.formatRate(0), "0%");
  assert.equal(analytics.formatRate(12.4), "12%");
});

test("sources read the way a client names them, merged, with the rest as Everything else", () => {
  const rows = analytics.sourceRows(
    [
      { channel: "google.com", sessions: 500 },
      { channel: "www.google.com", sessions: 288 },
      { channel: "Direct", sessions: 285 },
      { channel: "maps.google.com", sessions: 163 },
      { channel: "m.facebook.com", sessions: 82 },
    ],
    1359,
  );
  assert.deepEqual(
    rows.map((r) => [r.label, r.sessions]),
    [
      ["Google search", 788],
      ["Typed it in / direct", 285],
      ["Google Maps", 163],
      ["Facebook", 82],
      ["Everything else", 41],
    ],
  );
  assert.equal(Math.round(rows[0].pct), 58);
  assert.equal(analytics.sourceLabel("www.bbb.org"), "bbb.org");
});

test("devices and browsers are whole shares that add up to 100", () => {
  assert.equal(analytics.deviceLabel("Desktop"), "Computer");
  const split = analytics.shares([
    { key: "A", value: 1 },
    { key: "B", value: 1 },
    { key: "C", value: 1 },
  ]);
  assert.equal(split.reduce((n, r) => n + r.pct, 0), 100);
  assert.equal(
    analytics.topBrowsers([
      { browser: "Safari", sessions: 480 },
      { browser: "Chrome", sessions: 410 },
      { browser: "Firefox", sessions: 70 },
      { browser: "Edge", sessions: 40 },
    ]),
    "Safari 48% · Chrome 41% · Other 11%",
  );
  assert.equal(analytics.topBrowsers([]), null);
});

/* ── wording ─────────────────────────────────────────────────────────────── */

test("Analytics and Settings say what Xander approved", () => {
  const page = read("app/components/portal/analytics/AnalyticsSection.tsx");
  for (const s of [
    "How your website is doing: who visits, where they come from, and how fast it loads.",
    "Who visits your website and how fast it loads.",
    '"Where they came from"',
    '"Pages & devices"',
    '"Site health"',
  ]) {
    assert.ok(page.includes(s), s);
  }
  const traffic = read("app/components/portal/TrafficSection.tsx");
  for (const s of ["Enquiries from the site", "Visits → enquiries", "Visits per day", "A day someone sent an enquiry", "Visits by source"]) {
    assert.ok(traffic.includes(s), s);
  }
  // Not built: leads carry no referrer, so there is nothing to attribute an enquiry to.
  assert.ok(!traffic.includes(">Enquiries by source<"));
  const speed = read("app/components/portal/PerformanceSection.tsx").replace(/\s+/g, " ");
  for (const s of ["Shows up quickly.", "Reacts straight away.", "Nothing jumps around.", "Technical details", "Tested on a phone,"]) {
    assert.ok(speed.includes(s), s);
  }
  assert.ok(read("app/lib/portal-analytics.ts").includes('"Typed it in / direct"'));
  assert.ok(read("app/components/portal/CallMinutes.tsx").includes("Call minutes used"));
});

test("Plan & billing carries the call-minutes meter and the old Billing content", () => {
  const page = read("app/portal/(dash)/settings/billing/page.tsx");
  assert.match(page, /<BillingSection[\s\S]*usage=\{/);
  assert.match(page, /getUsageSummary\(account, raw\)/);
  // The meter shares the one definition of "over" with every other usage figure.
  assert.match(read("app/components/portal/CallMinutes.tsx"), /from "\.\/ui\/usage"/);
  const billing = read("app/components/portal/BillingSection.tsx");
  for (const s of ["Payment method", "Invoices", "CancellationCard"]) assert.ok(billing.includes(s), s);
});
