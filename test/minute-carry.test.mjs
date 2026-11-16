/**
 * Growth → Enterprise: the one exception to "no credit" (Xander, 2026-11-16, Q8): "When growth
 * sites move on to enterprise, both unused time on the old plan and the unused call minutes should
 * carry over just for the rest of the month."
 *
 *   - Money: each other Growth subscription is cancelled with its unused part of the month
 *     credited (prorate + invoice_now). The host's unused Growth time nets against the Enterprise
 *     charge in its upgrade invoice. Nowhere else in the app may prorate a cancellation.
 *   - Minutes: each moved site's unused Growth minutes join the Enterprise pool for the month the
 *     move happens in (the host subscription's current period), and only that month.
 *
 * On the code before this change the minute tests fail: there was no carry-over at all, so the
 * Enterprise pool for the move month was the plain Enterprise cap and every moved site's unused
 * Growth minutes were lost.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { capForWindow, carriedMinutes } from "../app/lib/billing-periods.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const MIN = 60;

test("a site whose Growth month began before the Enterprise month brings what it hadn't used", () => {
  // 350 included; 100 min used in its own month before the Enterprise month began. Those calls are
  // not in the pool, so they come off what it brings. Calls since are counted by the pool itself.
  assert.equal(carriedMinutes({ capMinutes: 350, usedBeforePoolSeconds: 100 * MIN, poolCountedEarlierSeconds: 0 }), 250);
});

test("a site already over its Growth minutes brings none, and never a negative", () => {
  assert.equal(carriedMinutes({ capMinutes: 350, usedBeforePoolSeconds: 400 * MIN, poolCountedEarlierSeconds: 0 }), 0);
});

test("calls the pool counts that belonged to the site's previous Growth month are given back", () => {
  // Its Growth month began after the Enterprise month did, so the pool also counts calls from
  // its previous Growth month, which that month's own allowance already covered.
  assert.equal(carriedMinutes({ capMinutes: 350, usedBeforePoolSeconds: 0, poolCountedEarlierSeconds: 30 * MIN }), 380);
});

test("the host brings all of its Growth minutes: its calls this month are already in the pool", () => {
  assert.equal(carriedMinutes({ capMinutes: 350, usedBeforePoolSeconds: 0, poolCountedEarlierSeconds: 0 }), 350);
});

test("partial minutes are kept to the second, and the result is whole minutes rounded down", () => {
  assert.equal(carriedMinutes({ capMinutes: 350, usedBeforePoolSeconds: 90, poolCountedEarlierSeconds: 0 }), 348);
});

test("carried minutes count only in the month of the move", () => {
  const carry = { windowStartMs: 1_000, minutes: 600 };
  assert.equal(capForWindow(1050, carry, 1_000), 1650);
  assert.equal(capForWindow(1050, carry, 2_000), 1050);
  assert.equal(capForWindow(1050, null, 1_000), 1050);
  // Not yet worked out: no minutes are invented.
  assert.equal(capForWindow(1050, { windowStartMs: 1_000 }, 1_000), 1050);
});

test("the move records the carry-over, and billing and the portal meter both read it", () => {
  assert.match(read("app/api/portal/consolidate/route.ts"), /recordMinuteCarry\(/);
  const billing = read("app/lib/usage-billing.ts");
  assert.match(billing, /carriedMinutesFor\(/);
  assert.match(billing, /capForWindow\(/);
  const meter = read("app/lib/portal-usage.ts");
  assert.match(meter, /carriedMinutesFor\(/);
  assert.match(meter, /capForWindow\(/);
});

test("the unused Growth fee is credited on the move, and no other cancellation prorates", () => {
  assert.match(read("app/lib/consolidation.ts"), /subscriptions\.cancel\(subscriptionId, \{ prorate: true, invoice_now: true \}\)/);
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs)$/.test(name) && /prorate:\s*true/.test(readFileSync(p, "utf8"))) {
        hits.push(relative(ROOT, p).split(sep).join("/"));
      }
    }
  };
  walk(join(ROOT, "app"));
  assert.deepEqual(hits, ["app/lib/consolidation.ts"]);
});
