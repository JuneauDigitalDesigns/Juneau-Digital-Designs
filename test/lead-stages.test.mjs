/**
 * The lead stages this site's copy of the console's lead shape lists (Xander, 2026-11-15).
 *
 * The console's board has New, Contacted, Scheduled and New client, with Lost beside them, and no
 * "won" any more (jdd-ops console/src/lib/leadTypes.ts, PR #131). This site only ever writes "new",
 * from the hero form and the demo-call ingest, and reads no stage, so its copy of the type is the
 * only place the old names were left. Pinned here so the two copies can't drift apart again.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the lead stage list is the console board's: new, contacted, scheduled, client, lost", () => {
    const queue = read("app/lib/lead-queue.ts");
    const m = /export type LeadStage = ([^;]+);/.exec(queue);
    assert.ok(m, "LeadStage is declared");
    const stages = [...m[1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]);
    assert.deepEqual(stages, ["new", "contacted", "scheduled", "client", "lost"]);
});

test("every lead this site writes starts in New", () => {
    for (const p of ["app/api/lead/route.ts", "app/lib/demo-call-ingest.ts"]) {
        const stages = [...read(p).matchAll(/\bstage: "([a-z-]+)"/g)].map((x) => x[1]);
        assert.deepEqual(stages, ["new"], p);
    }
});
