import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Two portal bugs that were invisible to the compiler and to every other test.
 *
 * 1. The first-run tour auto-launched on every visit. driver.js resets its state *before* it
 *    calls `onDestroyed`, so reading `getActiveIndex()` there always gave undefined, the code
 *    fell back to step 0, and "completed" was never saved. The index has to come from the
 *    hook's own snapshot (`opts.state`).
 *
 * 2. "All customers" on a customer record did nothing. Which record was open lived in
 *    `useState(params.get("open"))`, read from the URL once at mount, so a link that cleared
 *    `?open=` changed the URL and nothing else. It has to be derived from the URL.
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

/** The body of the `onDestroyed:` handler, up to the next top-level driver option. */
function onDestroyedBody(src) {
    const start = src.indexOf("onDestroyed:");
    assert.ok(start >= 0, "TourController has no onDestroyed handler");
    const end = src.indexOf("onNextClick:", start);
    return src.slice(start, end > start ? end : undefined);
}

test("the tour reads its final step from the hook snapshot, not the reset driver", () => {
    const body = onDestroyedBody(tour);
    assert.doesNotMatch(body, /getActiveIndex\s*\(/, "driver state is already reset inside onDestroyed");
    assert.match(body, /opts\.state\.activeIndex/);
});

test("leaving the tour by any route marks it seen", () => {
    assert.match(onDestroyedBody(tour), /completed:\s*true/);
});

test("the tour route never un-sees the tour", () => {
    assert.match(tourRoute, /completed:\s*body\.completed === true \|\| prev\.completed === true/);
});

test("the open customer record is derived from the URL, not held in state", () => {
    assert.doesNotMatch(customers, /useState[^;]*params\.get\("open"\)/);
    assert.match(customers, /const openId = params\.get\("open"\)/);
});
