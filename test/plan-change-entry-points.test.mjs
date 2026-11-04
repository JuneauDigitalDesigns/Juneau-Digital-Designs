/**
 * Where plan changes start, and who hears about them.
 *
 * On the code before this change these fail:
 *   - A Starter client choosing Enterprise at /start went straight to an Enterprise purchase: a
 *     second subscription beside the Starter one, which kept billing, and the Starter site outside
 *     the bundle. Xander decided (D5) to set these up by hand.
 *   - A portal upgrade, a move to Enterprise and a scheduled downgrade told nobody, so the console
 *     steps they need (LEAD_CALLBACK, site.ts) waited until someone noticed.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a Starter holder choosing Enterprise is sent to the contact page, before consolidation", () => {
  const start = read("app/start/page.tsx");
  const starterCheck = start.indexOf('s.plan === "starter" && isActiveSite(s)');
  const growthCheck = start.indexOf("growthSitesForConsolidation(account).length > 0");
  assert.ok(starterCheck > 0, "no Starter check");
  assert.ok(starterCheck < growthCheck, "Starter check must run first");
  assert.match(start, /return <EnterpriseContactUs \/>/);
});

test("the contact page says exactly what Xander approved", () => {
  const page = read("app/components/pricing/EnterpriseContactUs.tsx").replace(/\s+/g, " ").replace(/&rsquo;/g, "'");
  assert.ok(page.includes('<span className="eyebrow">Enterprise</span>'));
  assert.ok(page.includes("Let's set this up together"));
  assert.ok(
    page.includes(
      "Moving your Starter site onto Enterprise takes a few changes on our side, so we'll set it up with you directly. Email hello@juneaudigitaldesigns.com and we'll sort it out. Nothing has been charged.",
    ),
  );
  assert.ok(page.includes("mailto:hello@juneaudigitaldesigns.com?subject=Move%20to%20Enterprise"));
  assert.ok(page.includes("Get in touch"));
  assert.ok(page.includes("Back to your portal"));
});

test("upgrades, moves to Enterprise and scheduled downgrades notify Xander", () => {
  for (const route of [
    "app/api/portal/upgrade/route.ts",
    "app/api/portal/consolidate/route.ts",
    "app/api/portal/downgrade/route.ts",
  ]) {
    assert.match(read(route), /sendOpsNotice\(/, route);
  }
});
