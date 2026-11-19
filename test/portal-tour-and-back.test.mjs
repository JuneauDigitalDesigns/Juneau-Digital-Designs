import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Two portal bugs that were invisible to the compiler and to every other test.
 *
 * 1. The first-run tour once auto-launched on every visit, because "seen" was never saved when the
 *    tour was left. Leaving the tour by any route (Done, the close button, Esc, or tapping away)
 *    must save it as seen, for the device it ran on, and the route must never un-see it.
 *
 * 2. "All customers" on a customer record did nothing. Which record was open lived in
 *    `useState(params.get("open"))`, read from the URL once at mount, so a link that cleared
 *    `?open=` changed the URL and nothing else. It has to be derived from the URL. (The tour
 *    relies on the same rule: it opens a sample customer with `?open=`.)
 *
 * Both are source-level rules, so they are checked at source level, the same way
 * `tour-anchors.test.mjs` checks the tour's `data-tour` anchors.
 */

/** Code only: the explanatory comments name the old patterns on purpose. */
function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

const tour = code("app/components/portal/tour/TourController.tsx");
const customers = code("app/components/portal/crm/CustomersSection.tsx");
const tourRoute = code("app/api/portal/tour/route.ts");

/** The body of the controller's `end` callback: every way out of the tour goes through it. */
function endBody(src) {
    const start = src.indexOf("const end = useCallback(");
    assert.ok(start >= 0, "TourController has no end callback");
    return src.slice(start, src.indexOf("}, [", start));
}

test("leaving the tour by any route marks it seen, for the device it ran on", () => {
    assert.match(endBody(tour), /postTour\(\{\s*device:\s*r\.device,\s*completed:\s*true/);
    // The close button, Esc, the last card's Done and tapping away all call `end`.
    assert.match(tour, /onClose=\{end\}/);
    assert.match(tour, /e\.key === "Escape"\) end\(\)/);
    assert.match(tour, /if \(i >= r\.steps\.length\) return end\(\)/);
    assert.match(tour, /!== expectedPath\.current\) end\(\)/);
});

test("the tour route never un-sees the tour, and only writes through nextTour", () => {
    assert.match(tourRoute, /nextTour\(user\.publicMetadata\?\.tour/);
    assert.match(tourRoute, /isTourDevice\(body\.device\)/);
});

test("the open customer record is derived from the URL, not held in state", () => {
    assert.doesNotMatch(customers, /useState[^;]*params\.get\("open"\)/);
    assert.match(customers, /const openId = params\.get\("open"\)/);
});
