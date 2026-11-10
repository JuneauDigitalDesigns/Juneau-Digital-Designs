/**
 * Suggestion chips in the onboarding wizard (wizard/service-suggestions.ts). The wizard looks a
 * service's chips up by its menu label, so a key that drifts from @jdd/schema's industry menu
 * silently shows no chips. These tests pin every key to a real trade and a real menu label.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { INDUSTRY_MENUS } from "@jdd/schema";

import { SUGGESTIONS, suggestionsFor } from "../app/components/onboarding/wizard/service-suggestions.ts";

const menuById = new Map(INDUSTRY_MENUS.map((m) => [m.id, m]));

test("every suggestion key is a real trade and a real menu label for that trade", () => {
    for (const [trade, services] of Object.entries(SUGGESTIONS)) {
        const menu = menuById.get(trade);
        assert.ok(menu, `"${trade}" is not a trade id in INDUSTRY_MENUS`);
        const labels = new Set(menu.services.map((s) => s.label));
        for (const service of Object.keys(services)) {
            assert.ok(labels.has(service), `"${service}" is not a ${trade} menu label`);
        }
    }
});

test("HVAC has chips for every service on its menu (batches 1 and 2, approved 2026-11-10)", () => {
    for (const { label } of menuById.get("hvac").services) {
        const s = suggestionsFor("hvac", label);
        assert.ok(s.included.length && s.jobs.length && s.questions.length, `${label} is missing a list`);
    }
});

test("chip lists have no repeats and no en or em dashes", () => {
    for (const [trade, services] of Object.entries(SUGGESTIONS)) {
        for (const [service, lists] of Object.entries(services)) {
            for (const [list, items] of Object.entries(lists)) {
                assert.equal(new Set(items).size, items.length, `${trade} / ${service} / ${list} repeats a chip`);
                for (const item of items) assert.doesNotMatch(item, /[–—]/, `${item} has a long dash`);
            }
        }
    }
});

test("a service with no approved batch gets no chips", () => {
    assert.deepEqual(suggestionsFor("plumbing", "Drain Clearing"), { included: [], jobs: [], questions: [] });
    assert.deepEqual(suggestionsFor("hvac", "Something I made up"), { included: [], jobs: [], questions: [] });
});
