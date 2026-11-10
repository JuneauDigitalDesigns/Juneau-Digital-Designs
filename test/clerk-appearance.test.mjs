/**
 * Clerk's sign-in, sign-up and account menu, re-themed to the agency brand (PR F of the portal
 * UX rework, 2026-11-09).
 *
 * Three things here were silent failures before, which is why they are pinned:
 *  - `appearance` is typed `any` in @clerk/nextjs 7 unless @clerk/ui is installed (it isn't, see
 *    clerkAppearance.ts), and Core 3 renamed four colour variables this repo used. Clerk drops
 *    unknown names without a word, so the old ink colour simply never applied.
 *  - Without `cssLayerName` and the matching `@layer` order line, Clerk's CSS is unlayered and
 *    beats every Tailwind class passed in `elements`, again silently.
 *  - There is no automated contrast check in this repo. The palette below is the one Clerk
 *    renders, so its text pairs are computed here rather than trusted to a comment.
 *
 * Imports the real appearance module (type-stripped by test/ts-hooks.mjs); reads the pages and
 * components as source, since they import Next and Clerk.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const appearance = await import("../app/portal/clerkAppearance.ts");
const { AGENCY_HEX, clerkAppearance, clerkAuthAppearance, clerkLocalization } = appearance;

// ── WCAG 2 relative luminance / contrast ────────────────────────────────────────────────────
function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

test("no Core 2 variable names, which Clerk 7 drops silently", () => {
    const removed = ["colorText", "colorTextSecondary", "colorInputBackground", "colorInputText"];
    for (const theme of [clerkAppearance, clerkAuthAppearance]) {
        for (const name of removed) assert.ok(!(name in (theme.variables ?? {})), name);
        // `appearance.layout` became `appearance.options`.
        assert.ok(!("layout" in theme), "layout is now options");
    }
    // And not reintroduced anywhere in the file, e.g. in a per-component object.
    const src = read("app/portal/clerkAppearance.ts");
    for (const name of removed) assert.doesNotMatch(src, new RegExp(`\\b${name}\\s*:`), name);
});

test("Clerk's CSS sits in the `clerk` layer, ordered below components and utilities", () => {
    assert.equal(clerkAppearance.cssLayerName, "clerk");
    const css = read("app/globals.css");
    const order = css.indexOf("@layer theme, base, clerk, components, utilities;");
    const tw = css.indexOf('@import "tailwindcss";');
    assert.ok(order >= 0, "the @layer order line is missing");
    assert.ok(order < tw, "the @layer order must come before Tailwind declares its own layers");
});

test("every text colour Clerk renders clears WCAG AA on every surface it sits on", () => {
    const surfaces = { card: AGENCY_HEX.card, bg: AGENCY_HEX.bg, panelHeader: AGENCY_HEX.panelHeader };
    // Body-size text: 4.5:1 everywhere.
    for (const fg of ["fg", "fg2"]) {
        for (const [name, bg] of Object.entries({ ...surfaces, white: AGENCY_HEX.white })) {
            assert.ok(contrast(AGENCY_HEX[fg], bg) >= 4.5, `${fg} on ${name}: ${contrast(AGENCY_HEX[fg], bg).toFixed(2)}`);
        }
    }
    // Links sit on the card and on the sand footer.
    for (const bg of [AGENCY_HEX.card, AGENCY_HEX.panelHeader]) {
        assert.ok(contrast(AGENCY_HEX.teal, bg) >= 4.5, `teal on ${bg}`);
    }
    // Status text on the card.
    for (const c of ["danger", "success", "warning"]) {
        assert.ok(contrast(AGENCY_HEX[c], AGENCY_HEX.card) >= 4.5, `${c}: ${contrast(AGENCY_HEX[c], AGENCY_HEX.card).toFixed(2)}`);
    }
    // The variables actually point at those values.
    const v = clerkAppearance.variables;
    assert.equal(v.colorForeground, AGENCY_HEX.fg);
    assert.equal(v.colorMutedForeground, AGENCY_HEX.fg2);
    assert.equal(v.colorBackground, AGENCY_HEX.card);
    // The agency body face, not the portal's Inter: sign-in matches the agency site.
    assert.match(v.fontFamily, /^var\(--font-hanken\)/);
    assert.match(read("app/portal/sign-in/_auth/AuthShell.module.css"), /font-family: var\(--font-hanken\)/);
    // --fg-3 fails on cream at the sizes Clerk uses for muted text.
    assert.ok(!Object.values(v).includes("#7a715a"), "--fg-3 is not AA on cream");
});

test("cream on coral is large-text only, so the coral button label stays large and bold", () => {
    const onCoral = contrast(AGENCY_HEX.onCoral, AGENCY_HEX.coral);
    assert.ok(onCoral >= 3 && onCoral < 4.5, `expected a large-text-only pair, got ${onCoral.toFixed(2)}`);
    assert.ok(contrast(AGENCY_HEX.onCoral, AGENCY_HEX.coralDeep) >= 4.5, "the hover/deep coral is AA at any size");

    // WCAG large text: >= 18.66px bold. Every font size on the primary button must clear it.
    const btn = clerkAuthAppearance.elements.formButtonPrimary;
    const sizes = [...btn.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 0, "the primary button must set its own size");
    for (const px of sizes) assert.ok(px >= 18.66, `primary button label at ${px}px is too small for cream on coral`);
    assert.match(btn, /\bfont-(bold|extrabold|black)\b/);
    assert.match(btn, /hover:bg-\[#b8441f\]/);
});

test("approved card wording, through Clerk localization", () => {
    assert.equal(clerkLocalization.signIn.start.title, "Sign in to your client portal");
    assert.equal(clerkLocalization.signIn.start.subtitle, "Your leads, customers and site, all in one place");
    // No sign-up string is approved yet: Clerk's default title stays.
    assert.ok(!("signUp" in clerkLocalization));
    assert.match(read("app/portal/layout.tsx"), /localization=\{clerkLocalization\}/);
});

test("sign-in and sign-up wear the agency brand, not the portal scope", () => {
    for (const page of ["app/portal/sign-in/[[...sign-in]]/page.tsx", "app/portal/sign-up/[[...sign-up]]/page.tsx"]) {
        const src = read(page);
        // The import and the JSX, not the word: the pages' comments explain why it's gone.
        assert.doesNotMatch(src, /components\/portal\/PortalScope"|^\s*<PortalScope>/m, page);
        assert.match(src, /<AuthShell>/, page);
        assert.match(src, /appearance=\{clerkAuthAppearance\}/, page);
    }
    const chrome = read("app/components/MarketingChrome.tsx");
    assert.match(chrome, /isPortalProduct = isPortal && !isOnboarding && !isPortalAuth/);
    assert.match(chrome, /isPortalAuth && <AuthCanvas \/>/);
});

test("the brand panel's peek card is hidden from assistive tech", () => {
    assert.match(read("app/portal/sign-in/_auth/AuthShell.tsx"), /className=\{s\.peek\} aria-hidden="true"/);
});

test("the account menu: Manage account, Help & support, Replay the tour, Sign out last", () => {
    const src = read("app/components/portal/PortalUserButton.tsx");
    // lastIndexOf: the doc comment above the component names the same labels.
    const at = (s) => src.lastIndexOf(s);
    const order = ['label="manageAccount"', 'helpLabel = "Help & support"', 'label="Replay the tour"', 'label="signOut"'];
    for (const s of order) assert.ok(at(s) >= 0, s);
    assert.ok(at(order[0]) < at("<UserButton.Link") && at("<UserButton.Link") < at(order[2]), "help sits between manage and replay");
    assert.ok(at(order[2]) < at(order[3]), "sign out is last");
    assert.match(src, /launchTour\(\)/);
    assert.match(src, /tabHref\("support", siteSlug\)/);

    // Every UserButton in the portal chrome is ours, so none renders without the two items.
    const chrome = read("app/components/portal/PortalChrome.tsx");
    assert.doesNotMatch(chrome, /<UserButton\b/);
    assert.equal((chrome.match(/<PortalUserButton\b/g) ?? []).length, 3);
});
