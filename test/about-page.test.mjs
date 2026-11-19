/**
 * /about — "Meet the owner."
 *
 * Xander approved every sentence of this page word for word on 19 Nov 2026, from the fourth
 * round of a mockup. These tests pin the sentences that carry a checkable fact about him, so an
 * edit that quietly changes his degree, his college, the dates or where he lives fails here
 * rather than going live. They also pin the two quotes, which the page attributes to him by name.
 *
 * On the code before this change every test here fails: there is no `app/about/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, aboutJsonLd, organizationJsonLd } from "../app/lib/site-seo.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const page = read("app/about/page.tsx");

/** The page's text with JSX escapes resolved, so a sentence can be matched as written. */
const prose = page.replace(/&apos;/g, "'").replace(/\s+/g, " ");

test("the facts about Xander are the ones he gave, word for word", () => {
  for (const sentence of [
    "I'm Xander Juneau. I built this for the trades.",
    "I live in Winter Garden, Florida, and I work with the local trades in and around Central Florida",
    "I spent about 12 years in the hospitality industry, and that's where I learned how to take care of people.",
    "I was learning how to lead and get results.",
    "That's how I treat my clients now: like friends or family.",
    "Electronics Engineering Technology from Valencia College in 2019",
    "I still think like an engineer: work out how the thing should run, then build it properly.",
  ]) {
    assert.ok(prose.includes(sentence), `/about no longer says: ${sentence}`);
  }
});

test("both quotes are present and attributed to Xander by name", () => {
  assert.ok(prose.includes("I saw the problem on the job."), "the first quote is gone");
  assert.ok(
    prose.includes("Small businesses need a digital presence that does more for them, at a price that makes sense."),
    "the second quote is gone",
  );
  const credits = prose.match(/Xander Juneau, owner of Juneau Digital Designs/g) ?? [];
  assert.equal(credits.length, 2, "each quote carries his name and title");
});

test("the timeline runs oldest to newest and names the real credentials", () => {
  const order = [
    "Valencia College, 2019",
    "About 12 years",
    "2020",
    "June to November 2022",
    "Since then",
    "Now",
  ];
  let at = -1;
  for (const when of order) {
    const next = prose.indexOf(`when: "${when}"`);
    assert.ok(next > at, `the timeline entry "${when}" is missing or out of order`);
    at = next;
  }
  assert.ok(
    prose.includes("Engineering Immersion Program, Thinkful (a Chegg service)"),
    "the certificate's printed name changed",
  );
  assert.ok(
    prose.includes("Websites, AI receptionists and automations for the trades."),
    "the last timeline entry changed",
  );
});

test("six lessons, each paired with what the client's site gets", () => {
  const learned = prose.match(/learned: "/g) ?? [];
  const site = prose.match(/site: "/g) ?? [];
  assert.equal(learned.length, 6, "there should be six lessons");
  assert.equal(site.length, 6, "each lesson needs its matching line about the client's site");
  // The claim here is about the contact form, which is the form a client site has. Widening it
  // to "every form" would promise something nobody has checked.
  assert.ok(prose.includes("a bot check on the contact form"), "the security claim was widened");
});

test("the page is in the sitemap and the nav and footer link to it", () => {
  assert.ok(PUBLIC_PATHS.includes("/about"), "/about is not a public path");
  assert.ok(
    sitemap().some((e) => e.url === `${SITE_URL}/about`),
    "/about is missing from the sitemap",
  );
  assert.match(read("app/components/navbar/navbar.tsx"), /href="\/about"/, "the nav does not link to /about");
  assert.match(read("app/components/footer/footer.tsx"), /href="\/about"/, "the footer does not link to /about");
});

test("the structured data says only what the page says", () => {
  const graph = aboutJsonLd()["@graph"];
  const person = graph.find((n) => n["@type"] === "Person");
  assert.equal(person.name, "Xander Juneau");
  assert.equal(person.homeLocation.address.addressLocality, "Winter Garden");
  assert.equal(person.homeLocation.address.addressRegion, "FL");
  assert.deepEqual(
    person.hasCredential.map((c) => c.name),
    ["Associate in Science, Electronics Engineering Technology", "Engineering Immersion Program"],
  );
  // The business and the person point at each other, so a search engine can tie them together.
  const org = organizationJsonLd()["@graph"].find((n) => n["@type"] === "Organization");
  assert.equal(org.founder["@id"], person["@id"]);
  assert.equal(person.worksFor["@id"], org["@id"]);
});

test("/about keeps its own title, description and canonical address", () => {
  assert.match(page, /pageMetadata\(\s*"\/about"/);
  assert.match(page, /About Xander Juneau \| Juneau Digital Designs/);
});
