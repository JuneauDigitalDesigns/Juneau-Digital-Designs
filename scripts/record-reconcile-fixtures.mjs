#!/usr/bin/env node
/**
 * Record the vendor responses the client-call reconcile's tests replay
 * (test/fixtures/call-reconcile/). Read-only, and against the `_e2e_` test clients only.
 *
 * Why recorded: the reconcile's correctness rests on beliefs about vendors that are easy to get
 * wrong by hand. Retell's v3 list-calls takes `op: "ge"` (`"gte"` is a 400), returns
 * `call_analysis` and `end_timestamp` but no transcript, and pages with `pagination_key`. The
 * Airtable `Date` a row carries equals Retell's `start_timestamp` to the millisecond. A
 * hand-written fixture would encode whatever we believed, and the test would certify it.
 *
 * Scrubbed before saving: phone numbers become Twilio's magic test numbers, every free-text
 * analysis value becomes "scrubbed" (empty stays empty, and the enumerated values the gate reads
 * stay as they are), and links, transcripts, costs and dynamic variables are dropped. The agent
 * id and base id are replaced with fixed placeholders.
 *
 * Usage (from this repo, with jdd-ops beside it):
 *   node scripts/record-reconcile-fixtures.mjs [--ops ../jdd-ops]
 * Reads RETELL_API_KEY and AIRTABLE_API_KEY from jdd-ops/.env and each fixture client's
 * `.env.local`. Prints counts only.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "test", "fixtures", "call-reconcile");
const opsArg = process.argv.indexOf("--ops");
const OPS = resolve(opsArg !== -1 ? process.argv[opsArg + 1] : resolve(HERE, "..", "..", "jdd-ops"));

function readEnv(path) {
    const out = {};
    if (!existsSync(path)) return out;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return out;
}

const master = readEnv(resolve(OPS, ".env"));
const RETELL = master.RETELL_API_KEY;
const AIRTABLE = master.AIRTABLE_API_KEY;
if (!RETELL || !AIRTABLE) throw new Error("RETELL_API_KEY and AIRTABLE_API_KEY must be in jdd-ops/.env");

/** The only clients this ever reads. */
const FIXTURES = [
    { slug: "_e2e_test_growth", agent: "agent_e2egrowthfixture", base: "appE2EGROWTHBASE0" },
    { slug: "_e2e_test_starter", agent: "agent_e2estarterfixtur", base: "appE2ESTARTERBASE" },
];

const KEEP_VALUES = new Set(["", "granted", "declined", "unknown", "emergency", "callback"]);
const scrubValue = (v) => (typeof v === "string" ? (KEEP_VALUES.has(v) ? v : "scrubbed") : v);

function scrubCall(c, agentPlaceholder) {
    const a = c.call_analysis ?? null;
    return {
        call_id: c.call_id,
        call_type: c.call_type,
        agent_id: agentPlaceholder,
        call_status: c.call_status,
        start_timestamp: c.start_timestamp,
        end_timestamp: c.end_timestamp,
        duration_ms: c.duration_ms,
        disconnection_reason: c.disconnection_reason,
        direction: c.direction,
        from_number: c.from_number ? "+15005550009" : c.from_number,
        to_number: c.to_number ? "+15005550006" : c.to_number,
        call_analysis: a
            ? {
                  in_voicemail: a.in_voicemail,
                  call_successful: a.call_successful,
                  custom_analysis_data: a.custom_analysis_data
                      ? Object.fromEntries(Object.entries(a.custom_analysis_data).map(([k, v]) => [k, scrubValue(v)]))
                      : a.custom_analysis_data,
              }
            : a,
    };
}

async function retell(path, init) {
    const res = await fetch(`https://api.retellai.com${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${RETELL}`, "Content-Type": "application/json" },
    });
    return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
    mkdirSync(OUT, { recursive: true });
    const since = Date.now() - 45 * 24 * 60 * 60 * 1000;

    for (const f of FIXTURES) {
        const env = readEnv(resolve(OPS, "clients", f.slug, ".env.local"));
        if (!env.RETELL_AGENT_ID || !env.AIRTABLE_BASE_ID) {
            console.log(`${f.slug}: no agent or base on disk, skipped`);
            continue;
        }

        // Every page of the window, as the reconcile walks it.
        const pages = [];
        let key;
        for (let i = 0; i < 10; i++) {
            const r = await retell("/v3/list-calls", {
                method: "POST",
                body: JSON.stringify({
                    filter_criteria: {
                        agent_id: [env.RETELL_AGENT_ID],
                        start_timestamp: { type: "number", op: "ge", value: since },
                    },
                    limit: 50,
                    ...(key ? { pagination_key: key } : {}),
                }),
            });
            if (r.status !== 200) throw new Error(`${f.slug}: list-calls ${r.status}`);
            pages.push({
                status: r.status,
                body: {
                    items: r.body.items.map((c) => scrubCall(c, f.agent)),
                    has_more: r.body.has_more,
                    ...(r.body.pagination_key ? { pagination_key: r.body.pagination_key } : {}),
                },
            });
            if (!r.body.has_more || !r.body.pagination_key) break;
            key = r.body.pagination_key;
        }
        const calls = pages.flatMap((p) => p.body.items);

        // The replay body is get-call's call. Record one, scrubbed the same way.
        const sample = calls.find((c) => c.call_analysis?.custom_analysis_data);
        const got = sample ? await retell(`/v2/get-call/${encodeURIComponent(sample.call_id)}`) : null;

        // The log, as the reconcile reads it: Date and Site only, since the window opened.
        const rows = [];
        let offset;
        do {
            const q = new URLSearchParams();
            q.append("fields[]", "Date");
            if (env.AIRTABLE_SITE_TAG) q.append("fields[]", "Site");
            q.set("filterByFormula", `IS_AFTER({Date}, '${new Date(since).toISOString()}')`);
            q.set("pageSize", "100");
            if (offset) q.set("offset", offset);
            const res = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent("Call Log")}?${q}`, {
                headers: { Authorization: `Bearer ${AIRTABLE}` },
            });
            const body = await res.json();
            if (res.status !== 200) throw new Error(`${f.slug}: airtable ${res.status}`);
            rows.push(...body.records);
            offset = body.offset;
        } while (offset);

        // What asking for a column the base doesn't have does: the whole request fails, so the
        // reconcile asks for `Site` on enterprise profiles only. Error type and status only.
        const probe = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent("Call Log")}?fields%5B%5D=Site&maxRecords=1`, {
            headers: { Authorization: `Bearer ${AIRTABLE}` },
        });
        const probeBody = await probe.json().catch(() => ({}));
        const unknownField = { status: probe.status, body: { error: { type: probeBody?.error?.type ?? null } } };

        const file = {
            recordedAt: new Date().toISOString(),
            client: f.slug,
            agentId: f.agent,
            baseId: f.base,
            since,
            listCalls: pages,
            getCall: got ? { status: got.status, body: scrubCall(got.body, f.agent) } : null,
            airtableUnknownField: env.AIRTABLE_SITE_TAG ? null : unknownField,
            airtableList: { status: 200, body: { records: rows.map((r) => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })) } },
        };
        writeFileSync(resolve(OUT, `${f.slug.replace(/^_/, "")}.json`), JSON.stringify(file, null, 2) + "\n");
        console.log(`${f.slug}: ${calls.length} call(s) in ${pages.length} page(s), ${rows.length} row(s)`);
    }
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
