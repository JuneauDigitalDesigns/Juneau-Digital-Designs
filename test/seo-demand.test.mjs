/**
 * The spoke-proposal rules (L12), on Search Console rows. Pure: no KV, no Google.
 *
 * Thresholds are Xander's starting ones (2026-11-12): over 90 days, 30+ impressions across 2+
 * queries that name the town and match the service, or 2+ clicks; at most 3 proposals per client
 * per month; a spoke under 20 impressions after 180 days is proposed for merging back. Never the
 * main city (L4), only a town with a hub or one that qualifies (L6), within the caps (L14).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { matchTowns, matchServices, evaluateProposals, normalizeTerm } = await import("../app/lib/seo-demand.ts");

const profile = {
    v: 1,
    siteSlug: "acme",
    property: "https://acme.vercel.app/",
    verifiedAt: "2026-06-01T00:00:00.000Z",
    mainCity: "Clermont",
    caps: { area: 10, spoke: 15 },
    towns: [
        { name: "Clermont", slug: "clermont", hub: false, qualifies: false, facts: 1 },
        { name: "Minneola", slug: "minneola", hub: true, qualifies: true, facts: 4 },
        { name: "Winter Garden", slug: "winter-garden", hub: true, qualifies: true, facts: 3 },
        { name: "Groveland", slug: "groveland", hub: false, qualifies: false, facts: 0 },
    ],
    services: [
        { slug: "ac-repair", name: "AC Repair", terms: ["ac repair", "ac not cooling"], page: true },
        { slug: "duct-cleaning", name: "Duct Cleaning", terms: ["duct cleaning"], page: true },
    ],
    sharedFacts: { "Minneola|ac-repair": 2, "Winter Garden|ac-repair": 1 },
    spokes: [],
    updatedAt: "2026-11-01T00:00:00.000Z",
};

const day = (d) => `2026-${d}`;
const row = (date, query, impressions, clicks = 0, page = "https://acme.vercel.app/services/ac-repair") => ({
    date: day(date), query, page, impressions, clicks, position: 8.4,
});
const NOW = new Date("2026-11-13T00:00:00Z");
const none = { open: [], decided: [], proposedThisMonth: 0 };

test("query matching normalizes like the console and needs whole words", () => {
    assert.equal(normalizeTerm("Café & Grill’s"), "cafe and grills"); // pinned to jdd-ops lib/search-profile.js
    assert.deepEqual(matchTowns("ac repair winter garden fl", profile), ["Winter Garden"]);
    assert.deepEqual(matchTowns("ac repair minneolax", profile), []);
    assert.deepEqual(matchServices("repair my ac minneola", profile), ["ac-repair"]);
    assert.deepEqual(matchServices("ac not cooling minneola", profile), ["ac-repair"]);
});

test("30 impressions across 2 queries naming the town and matching the service makes a spoke proposal", () => {
    const rows = [row("10-01", "ac repair minneola", 20), row("10-02", "minneola ac not cooling", 10)];
    const out = evaluateProposals({ profile, rows, pageRows: [], state: none, signals: { Minneola: { calls: 2, leads: 1 } }, now: NOW });
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "spoke:minneola:ac-repair");
    assert.equal(out[0].kind, "spoke");
    assert.equal(out[0].evidence.impressions, 30);
    assert.equal(out[0].evidence.queries.length, 2);
    assert.deepEqual(out[0].evidence.signal, { calls: 2, leads: 1 });
});

test("30 impressions on ONE query is not enough; 2 clicks on one query is", () => {
    const one = evaluateProposals({ profile, rows: [row("10-01", "ac repair minneola", 40)], pageRows: [], state: none, signals: {}, now: NOW });
    assert.equal(one.length, 0);
    const clicks = evaluateProposals({ profile, rows: [row("10-01", "ac repair minneola", 5, 2)], pageRows: [], state: none, signals: {}, now: NOW });
    assert.equal(clicks.length, 1);
});

test("rows older than 90 days do not count", () => {
    const rows = [row("07-01", "ac repair minneola", 20), row("07-02", "minneola ac not cooling", 20)];
    assert.equal(evaluateProposals({ profile, rows, pageRows: [], state: none, signals: {}, now: NOW }).length, 0);
});

test("never the main city (L4)", () => {
    const rows = [row("10-01", "ac repair clermont", 50, 3), row("10-02", "clermont ac not cooling", 50)];
    assert.equal(evaluateProposals({ profile, rows, pageRows: [], state: none, signals: {}, now: NOW }).length, 0);
});

test("fewer than 2 shared facts makes it 'ask the client', not 'approve'", () => {
    const rows = [row("10-01", "ac repair winter garden", 20), row("10-02", "winter garden ac not cooling", 15)];
    const [p] = evaluateProposals({ profile, rows, pageRows: [], state: none, signals: {}, now: NOW });
    assert.equal(p.kind, "ask-client");
    assert.deepEqual(p.missing, ["shared-facts"]);
});

test("a town without a hub gets a town-facts proposal at 50 impressions, never a spoke", () => {
    const rows = [row("10-01", "ac repair groveland", 30), row("10-02", "duct cleaning groveland", 25)];
    const out = evaluateProposals({ profile, rows, pageRows: [], state: none, signals: {}, now: NOW });
    assert.deepEqual(out.map((p) => [p.id, p.kind]), [["town:groveland", "town-facts"]]);
});

test("an existing spoke, an open proposal, or a recent decline is not proposed again", () => {
    const rows = [row("10-01", "ac repair minneola", 20), row("10-02", "minneola ac not cooling", 10)];
    const withSpoke = { ...profile, spokes: [{ town: "Minneola", service: "ac-repair", since: "2026-10-01T00:00:00.000Z" }] };
    assert.equal(evaluateProposals({ profile: withSpoke, rows, pageRows: [], state: none, signals: {}, now: NOW }).length, 0);
    assert.equal(evaluateProposals({ profile, rows, pageRows: [], state: { ...none, open: ["spoke:minneola:ac-repair"] }, signals: {}, now: NOW }).length, 0);
    const declined = { ...none, decided: [{ id: "spoke:minneola:ac-repair", status: "declined", decidedAt: "2026-10-01T00:00:00.000Z" }] };
    assert.equal(evaluateProposals({ profile, rows, pageRows: [], state: declined, signals: {}, now: NOW }).length, 0);
    const longAgo = { ...none, decided: [{ id: "spoke:minneola:ac-repair", status: "declined", decidedAt: "2026-06-01T00:00:00.000Z" }] };
    assert.equal(evaluateProposals({ profile, rows, pageRows: [], state: longAgo, signals: {}, now: NOW }).length, 1);
});

test("at most 3 proposals per client per month, strongest first", () => {
    const towns = ["Minneola", "Winter Garden", "Groveland"];
    const rows = [
        row("10-01", "ac repair minneola", 5, 9),
        row("10-01", "duct cleaning minneola", 5, 2),
        row("10-01", "ac repair winter garden", 5, 4),
        row("10-01", "duct cleaning winter garden", 5, 3),
        row("10-01", "groveland ac repair", 60),
    ];
    const out = evaluateProposals({ profile: { ...profile, sharedFacts: {} }, rows, pageRows: [], state: { ...none, proposedThisMonth: 1 }, signals: {}, now: NOW });
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((p) => p.id), ["spoke:minneola:ac-repair", "spoke:winter-garden:ac-repair"]);
    assert.ok(towns.length);
});

test("the spoke cap (15) is respected, counting live spokes and open proposals", () => {
    const spokes = Array.from({ length: 14 }, (_, i) => ({ town: "Winter Garden", service: `s${i}`, since: "2026-10-01T00:00:00.000Z" }));
    const rows = [row("10-01", "ac repair minneola", 5, 9)];
    const capped = { ...profile, spokes };
    assert.equal(evaluateProposals({ profile: capped, rows, pageRows: [], state: { ...none, open: ["spoke:groveland:duct-cleaning"] }, signals: {}, now: NOW }).length, 0);
    assert.equal(evaluateProposals({ profile: capped, rows, pageRows: [], state: none, signals: {}, now: NOW }).length, 1);
});

test("a spoke live 180 days with under 20 impressions is proposed for merging back", () => {
    const old = { ...profile, spokes: [{ town: "Minneola", service: "ac-repair", since: "2026-04-01T00:00:00.000Z" }] };
    const page = "https://acme.vercel.app/areas/minneola/ac-repair";
    const quiet = [{ date: day("10-01"), page, impressions: 19, clicks: 0 }];
    const [p] = evaluateProposals({ profile: old, rows: [], pageRows: quiet, state: none, signals: {}, now: NOW });
    assert.equal(p.id, "fold:minneola:ac-repair");
    assert.equal(p.kind, "fold");
    assert.equal(p.evidence.impressions, 19);
    const busy = [{ date: day("10-01"), page, impressions: 20, clicks: 0 }];
    assert.equal(evaluateProposals({ profile: old, rows: [], pageRows: busy, state: none, signals: {}, now: NOW }).length, 0);
    const young = { ...profile, spokes: [{ town: "Minneola", service: "ac-repair", since: "2026-09-01T00:00:00.000Z" }] };
    assert.equal(evaluateProposals({ profile: young, rows: [], pageRows: [], state: none, signals: {}, now: NOW }).length, 0);
});
