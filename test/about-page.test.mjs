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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, aboutJsonLd, organizationJsonLd } from "../app/lib/site-seo.ts";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), "utf8");
const page = read("app/about/page.tsx");

/** The page's text with JSX escapes resolved, so a sentence can be matched as written. */
const prose = page.replace(/&apos;/g, "'").replace(/\s+/g, " ");

test("the facts about Xander are the ones he gave, word for word", () => {
  for (const sentence of [
    "I'm Xander Juneau. I built this for the trades.",
    "I live in Winter Garden, Florida, and I work with the local trades in and around Central Florida",
    // The trade list matches the homepage hero's exactly, "auto detailing" included (Xander,
    // 19 Nov 2026). Pinned here because the two must stay in step and this one used to lag.
    "HVAC, plumbing, roofing, lawn care, pressure washing and auto detailing businesses.",
    "I spent about 12 years in the hospitality industry, and that's where I learned how to take care of people.",
    "I was learning how to lead and get results.",
    "That's how I treat my clients now: like friends or family.",
    // Approved 19 Nov 2026, from his own thought: "the hospitality industry has never really
    // left me and you never really leave it". Both halves carry — that it stayed with him, and
    // that nobody leaves it — so neither sentence is to be dropped or merged away.
    "The hospitality industry never really left me. I don't think you ever really leave it.",
    // Approved 19 Nov 2026. He asked for this to say he did both at once rather than simply
    // dropping the word "first", which the new dates had made untrue.
    "I worked and studied at the same time, and earned an Associate in Science degree in Electronics Engineering Technology from Valencia College in 2019.",
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

/*
 * Reordered on 19 Nov 2026. Hospitality used to sit between the 2019 degree and 2020 with the
 * label "About 12 years", which Xander read off the page as a claim that twelve years fitted
 * into that one gap: "putting it in between my degree and the COVID-19 looks like I'm trying to
 * say there's about 12 years of hospitality between 2019 and 2020, which obviously can't be
 * true." He gave the two missing years — hospitality from 2014, the degree from 2016 — so every
 * entry now carries a real date and the order is genuinely oldest to newest.
 *
 * The twelve years still appear, in the paragraph beside the timeline, where they read as a
 * span rather than as a position on it.
 */
test("the timeline runs oldest to newest and names the real credentials", () => {
  const order = [
    "Since 2014",
    "Valencia College, 2016 to 2019",
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
  // Hospitality comes before the degree, and carries a start date rather than a span. Both are
  // the point of the reorder, so they are asserted rather than left to the order loop above.
  assert.ok(
    prose.indexOf('what: "Hospitality"') < prose.indexOf('what: "A.S., Electronics Engineering Technology"'),
    "Hospitality should come before the degree",
  );
  assert.doesNotMatch(prose, /when: "About 12 years"/, "the timeline is dating hospitality as a span again");
  // Xander typed this line himself.
  assert.ok(
    prose.includes("Where I honed my skills in taking care of people, leading, and getting results."),
    "the Hospitality wording changed",
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

test("the photo's alt text is the approved string, and says who he is", () => {
  // Approved by Xander on 19 Nov 2026. It describes a real person; a reworded version is a
  // different claim about him, so it is pinned here rather than left to a later tidy-up.
  assert.match(page, /const PORTRAIT_ALT = "Xander Juneau, the owner of Juneau Digital Designs";/);
  assert.match(page, /alt=\{PORTRAIT_ALT\}/, "the photo does not use the approved alt text");
  // No invented location: nobody here knows where the photo was taken.
  assert.doesNotMatch(
    page.slice(page.indexOf("PORTRAIT_ALT"), page.indexOf("PORTRAIT_ALT") + 400),
    /Winter Garden|Florida/,
    "the alt text names a place the photo was not confirmed to show",
  );
});

test("the hero serves the right crop at each width, and every file it names exists", () => {
  // Xander's call: the 4:5 crop from 801px up, the frame as shot below it. 801px is also where
  // the hero stops being two columns, so the two must stay in step.
  assert.match(page, /media="\(min-width: 801px\)"/, "the portrait crop has no breakpoint");
  const css = read("app/globals.css");
  assert.match(css, /@media \(min-width: 801px\) \{\s*\.about-portrait img \{ aspect-ratio: 4 \/ 5; \}/);
  assert.match(css, /aspect-ratio: 300 \/ 305;/, "the phone crop's shape is not reserved");

  const files = page.match(/\$\{PHOTO\}-[a-z0-9-]+\.(avif|webp)/g) ?? [];
  assert.ok(files.length >= 8, `expected both crops in both formats at two sizes, found ${files.length}`);
  for (const ref of new Set(files)) {
    const file = ref.replace("${PHOTO}", "about-xander");
    assert.ok(existsSync(root(`public/about/${file}`)), `public/about/${file} is missing`);
  }
  // AVIF first, then WebP: a browser takes the smaller one it understands.
  assert.ok(
    page.indexOf('type="image/avif"') < page.indexOf('type="image/webp"'),
    "WebP is offered before AVIF, so no browser would take the smaller file",
  );
});

test("the photo is small enough to serve, and is never lazy-loaded in the hero", () => {
  let largest = 0;
  for (const f of readdirSync(root("public/about"))) {
    const kb = statSync(root(`public/about/${f}`)).size / 1024;
    largest = Math.max(largest, kb);
  }
  // The original JPEG was 163KB. Anything approaching that means a variant was regenerated
  // at the wrong size or quality.
  assert.ok(largest < 45, `the largest variant is ${largest.toFixed(1)}KB, which is too big for a hero photo`);
  assert.doesNotMatch(page, /loading="lazy"/, "the hero photo must not be lazy-loaded");
  assert.match(page, /fetchPriority="high"/, "the hero photo should be fetched at high priority");
});

test("/about keeps its own title, description and canonical address", () => {
  assert.match(page, /pageMetadata\(\s*"\/about"/);
  assert.match(page, /About Xander Juneau \| Juneau Digital Designs/);
});
