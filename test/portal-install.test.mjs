/**
 * The portal as an installable app (2026-11-19, Xander Q18). Source-level: the card renders only
 * in a phone browser, which this suite has none of.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the manifest names the app JDD Portal and stays inside /portal", () => {
    const m = JSON.parse(read("public/portal.webmanifest"));
    assert.equal(m.name, "JDD Portal");
    assert.equal(m.start_url, "/portal");
    assert.equal(m.scope, "/portal");
    assert.equal(m.display, "standalone");
    for (const icon of m.icons) {
        assert.ok(existsSync(new URL(`../public${icon.src}`, import.meta.url)), `missing ${icon.src}`);
    }
    assert.ok(m.icons.some((i) => i.purpose === "maskable"), "a maskable icon for Android");
});

test("only portal routes link the manifest; the agency site is not installable", () => {
    assert.match(read("app/portal/layout.tsx"), /manifest: "\/portal\.webmanifest"/);
    assert.doesNotMatch(read("app/layout.tsx"), /manifest:/);
});

test("no push: no service worker and no notification permission request", () => {
    const card = read("app/components/portal/overview/InstallCard.tsx");
    assert.doesNotMatch(card, /serviceWorker|Notification\.requestPermission|PushManager/);
});

test("approved install wording, word for word (mockup strings 8 to 12)", () => {
    const card = read("app/components/portal/overview/InstallCard.tsx");
    for (const s of [
        "Put the portal on your home screen",
        "It opens full screen, like an app, one tap from your home screen.",
        "Show me how",
        "Not now",
        "Add to your home screen",
        "in Safari&apos;s toolbar.",
        "Scroll down and tap Add to Home Screen.",
        "Tap Add. The portal icon appears with your other apps.",
    ]) {
        assert.ok(card.includes(s), s);
    }
});
