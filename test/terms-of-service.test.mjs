/**
 * Terms of Service v6.0 / v6.1 (approved by Xander word for word, 2026-11-16).
 *
 * The Terms replaced the Master Services Agreement (v5.4). These pin what the approval rests on:
 *   - every plan's document is the Terms of Service, version v6.0 under the live SMS campaign (v1)
 *     and v6.1 under v2, and the two differ only in §4.6 and the plan summary's text-alert line;
 *   - nothing of the old contract survives in the rendered text: no "Service Agreement", no
 *     annual prepay, no Google Analytics, no "enquiry", no em dash;
 *   - MSA v5.5's approved site wording (PR #113, closed unmerged) is carried over: a site is four (4)
 *     or more pages, and nothing caps it at five;
 *   - the clauses Xander decided on 2026-11-16 read as approved: the liability cap, the domain
 *     handed over even when fees are owed, prorated upgrades, the add-on clause, Search Console;
 *   - the old acceptance URLs redirect permanently, so links already sent keep working.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

register("./server-only-hook.mjs", import.meta.url);

const { getTermsForPlan, TERMS_VERSIONS } = await import("../app/lib/legal/index.ts");
const { hashTermsForPlan } = await import("../app/lib/legal/hash.ts");
const { buildCallScript } = await import("../app/lib/legal/call-script.ts");

const PLANS = [
  ["starter", {}],
  ["starter", { webOnly: true }],
  ["growth", {}],
  ["enterprise", {}],
];

function text(sections) {
  const out = [];
  const block = (b) => {
    if (b.text) out.push(b.text);
    if (b.items) out.push(...b.items);
    if (b.rows) out.push(...b.rows.map((r) => r.join(" | ")));
  };
  for (const s of sections) {
    out.push(s.heading);
    s.intro.forEach(block);
    for (const sub of s.subsections) {
      out.push(sub.heading);
      sub.blocks.forEach(block);
    }
  }
  return out.join("\n");
}

const doc = (plan, opts = {}, campaign = "v1") => text(getTermsForPlan(plan, { ...opts, campaign }).sections);

test("the versions are v6.0 (SMS v1) and v6.1 (SMS v2), and each document carries its own", () => {
  assert.deepEqual(TERMS_VERSIONS, { v1: "v6.0", v2: "v6.1" });
  assert.equal(getTermsForPlan("growth", { campaign: "v1" }).version, "v6.0");
  assert.equal(getTermsForPlan("growth", { campaign: "v2" }).version, "v6.1");
  // Different words, different hash: an acceptance proves which version the client saw.
  assert.notEqual(
    hashTermsForPlan("growth", { campaign: "v1" }),
    hashTermsForPlan("growth", { campaign: "v2" }),
  );
});

for (const [plan, opts] of PLANS) {
  const label = `${plan}${opts.webOnly ? " (website only)" : ""}`;

  for (const campaign of ["v1", "v2"]) {
    const d = doc(plan, opts, campaign);

    test(`${label} ${campaign}: nothing of the old contract survives`, () => {
      assert.doesNotMatch(d, /Service Agreement|Master Services|Schedule A/);
      assert.doesNotMatch(d, /annual|per year|prepay|price of 10/i);
      assert.doesNotMatch(d, /Google Analytics/);
      assert.doesNotMatch(d, /enquir/i);
      assert.doesNotMatch(d, /—/, "no em dashes (house style)");
      assert.doesNotMatch(d, /\[\?\]/, "every cross-reference resolved");
    });

    test(`${label} ${campaign}: a site is four (4) or more pages (MSA v5.5, PR #113)`, () => {
      assert.doesNotMatch(d, /four-page|up to five pages|beyond five|fifth page/);
      assert.match(
        d,
        // Town pages are part of the base site at launch (T1, approved by Xander 2026-11-16); later
        // pages, and pages proposed from search data, are paid.
        /Your website is a site at a single domain of four \(4\) or more pages: Home, Services, About and Contact, an individual page for each service for which you give us enough detail to support one, an individual page for each town you work in for which you give us enough real details about your work there, such as photos of jobs or reviews from customers in that town, and an optional additional page\. Other pages, including pages added later and new pages proposed from search data, are not included in any plan and are paid add-on work\./,
      );
      assert.match(d, /Additional pages beyond those included \| Quoted per request/);
      if (plan !== "growth") {
        assert.match(d, /four \(4\) or more pages/);
        assert.match(d, /plus individual service pages and town pages where the Client's information supports them/);
      }
    });
  }
}

test("§4.6 and the plan summary's text line follow the campaign, and only they do", () => {
  const v1 = doc("starter", {}, "v1");
  const v2 = doc("starter", {}, "v2");
  assert.match(v1, /we text you a summary after each call the AI receptionist handles/);
  assert.match(v1, /A text summary from Juneau Digital Designs to the Client's mobile phone after each call/);
  assert.match(v2, /we text you call summaries, new-lead alerts and occasional service alerts/);
  assert.match(v2, /A text alert from Juneau Digital Designs to the Client's mobile phone whenever a new lead/);
  // Same text otherwise, line for line.
  const strip = (s) =>
    s
      .split("\n")
      .filter((l) => !/^If you opt in, we text you|^A text (summary|alert) from Juneau Digital Designs/.test(l));
  assert.deepEqual(strip(v1), strip(v2));
});

test("the 2026-11-16 decisions read as approved", () => {
  const d = doc("growth");
  assert.match(d, /THE GREATER OF THE FEES YOU PAID US IN THE THREE \(3\) MONTHS BEFORE THE CLAIM, OR FIVE HUNDRED DOLLARS \(\$500\)\./);
  assert.match(d, /we still send your website project and the PDF, and still hand over your domain\. The site content file and the port of your number wait/);
  assert.match(d, /prorated for the rest of the current month, and the higher plan's monthly fee from your next billing date/);
  assert.match(d, /The onboarding fee is charged once only, and never again, including when you change plans\./);
  // Q8 (Xander, 2026-11-16): the one exception to "no credit", for Growth sites moving onto Enterprise.
  assert.match(d, /The one exception is a move onto an Enterprise plan, described in Section 3\.7\./);
  assert.match(
    d,
    /When sites on a Growth plan move onto an Enterprise plan, the unused part of the current month on each of their Growth subscriptions is credited to your account and taken off your next invoices, and their unused included call minutes are added to your Enterprise allowance for the rest of that month only\./,
  );
  // Add-ons are never prorated (Xander, 2026-11-16), unlike a plan upgrade.
  assert.match(d, /An add-on's monthly price is never prorated\. You can start it right away, paying its full monthly price that day and then on each billing date, or have it start on your next billing date\./);
  assert.match(d, /We may offer optional services that are not part of any plan\./);
  assert.match(d, /we add it to our own Google Search Console account; that is for our use and is not a service to you/);
  assert.match(d, /search engine optimization services, such as ongoing search optimization, keyword research and new pages proposed from search data/);
  // The homepage and pricing site line say the same as the plan summary, and never name Search Console (T5).
  for (const f of ["app/components/pricing/pricingpageclient.tsx", "app/components/home/homepageclient.tsx"]) {
    const src = readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), "utf8");
    assert.ok(
      src.includes(
        '"Home, Services, About and Contact, plus pages for your services and the towns you work in, built from the details you give us. Hosting, SSL, daily backups and uptime monitoring included, plus 2 content edits a month."',
      ),
      f,
    );
    assert.doesNotMatch(src, /Search Console/, f);
  }
  assert.match(d, /WE DO NOT GUARANTEE ANY NUMBER OF LEADS, CALLS, INQUIRIES, CUSTOMERS, VISITORS OR SEARCH RANKINGS\./);
  assert.match(d, /Florida is an all-party consent state \(Fla\. Stat\. § 934\.03\)/);
});

test("the preamble opens the document, unnumbered, and the plan summary closes it", () => {
  const { sections } = getTermsForPlan("starter", { campaign: "v1" });
  assert.equal(sections[0].num, 0);
  assert.equal(sections[0].heading, "");
  assert.match(sections[0].intro[0].text, /^These Terms of Service \(the "Terms"\) are an agreement between Juneau Digital Designs LLC/);
  assert.equal(sections[1].num, 1);
  assert.equal(sections.at(-1).heading, "PLAN SUMMARY: STARTER PLAN");
  // Thirteen numbered sections, the same for every plan.
  for (const [plan, opts] of PLANS) {
    const nums = getTermsForPlan(plan, { ...opts, campaign: "v1" }).sections.map((s) => s.num).filter((n) => n > 0);
    assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], plan);
  }
});

test("the plan summary is monthly only and lists the new lines", () => {
  const { sections } = getTermsForPlan("starter", { campaign: "v1" });
  const summary = text([sections.at(-1)]);
  assert.match(summary, /charged at checkout\./);
  assert.match(summary, /One-time onboarding fee \(charged once, at checkout\) \| \$297/);
  assert.match(summary, /Minimum term \| None/);
  assert.match(summary, /Chargeback reimbursement \| The processor's fee/);
  assert.match(summary, /Phone number port-out \(when you leave\) \| \$50 per number/);
  assert.match(summary, /Site statistics through Vercel Analytics, and Lighthouse performance checks/);
  assert.match(summary, /Domain name registration and renewals, in the Client's own Cloudflare account/);
  assert.match(summary, /A search-ready build: page titles, descriptions and canonical addresses/);
});

test("the read-aloud script is monthly, says no refunds, and names the Terms of Service (r3)", () => {
  const s = buildCallScript("growth", "monthly");
  assert.match(s.version, /-r3$/);
  assert.match(s.lines.join("\n"), /there are no refunds\./);
  assert.match(s.lines.join("\n"), /the full Terms of Service we'll email you\. Do you agree\?/);
  assert.doesNotMatch(s.lines.join("\n"), /year|partial periods|full agreement/);
});

test("the SMS Terms page names the Terms of Service page, even where JSX wraps a sentence", () => {
  // S1 (approved 2026-11-16) sat across two JSX lines, so a per-line check let "our agreement
  // page" ship to /sms-terms. Read the page's text with comment lines dropped and lines joined.
  const src = readFileSync(fileURLToPath(new URL("../app/sms-terms/page.tsx", import.meta.url)), "utf8");
  const text = src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
    .join(" ")
    .replace(/\s+/g, " ");
  assert.doesNotMatch(text, /agreement page/i);
  assert.match(text, /it is the only one the checkbox on our Terms of Service page opts you into\./);
  assert.match(text, /the checkbox on our Terms of Service page opts you into\./);
});

test("no page or email a client sees still calls it the Service Agreement", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(e)) files.push(p);
    }
  };
  walk(fileURLToPath(new URL("../app", import.meta.url)));
  const offenders = [];
  for (const f of files) {
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return; // comments
        // Settings names a master accepted before v6.0 by the name it was accepted under (O2), and
        // the legacy drawn-signature audit line only renders for those old records.
        if (/legacyAgreement|Electronic signature record for Service Agreement/.test(line)) return;
        if (/Service Agreement|service agreement|Master Services Agreement/.test(line)) offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, []);
});

test("the old acceptance URLs redirect permanently to the new ones", async () => {
  const { default: config } = await import("../next.config.ts");
  const redirects = await config.redirects();
  assert.deepEqual(
    redirects.map(({ source, destination, permanent }) => ({ source, destination, permanent })),
    [
      { source: "/agreement", destination: "/terms/accept", permanent: true },
      { source: "/agree/:code", destination: "/terms/:code", permanent: true },
    ],
  );
  // The pages live at the new paths, and the API routes did not move.
  const exists = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8").length > 0;
  assert.ok(exists("app/terms/accept/page.tsx"));
  assert.ok(exists("app/terms/[code]/page.tsx"));
  assert.ok(exists("app/api/agreement/route.ts"));
  assert.ok(exists("app/api/agree/[code]/route.ts"));
});
