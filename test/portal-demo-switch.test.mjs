/**
 * The homepage portal section loads one demo: the desktop film on a wide screen, the portal's
 * mobile view on a phone (Xander, 2026-11-18). Source-level, as there is no browser in this suite.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sw = readFileSync("app/components/home/PortalDemoSwitch.tsx", "utf8");
const home = readFileSync("app/components/home/homepageclient.tsx", "utf8");

test("the homepage mounts the switch, and imports neither demo itself", () => {
    assert.match(home, /<PortalDemoSwitch \/>/);
    assert.doesNotMatch(home, /import PortalDemo(Mobile)? from/);
});

test("each version is its own dynamic chunk, never server-rendered", () => {
    assert.match(sw, /dynamic\(\(\) => import\("\.\/PortalDemo"\), \{ ssr: false \}\)/);
    assert.match(sw, /dynamic\(\(\) => import\("\.\/PortalDemoMobile"\), \{ ssr: false \}\)/);
    assert.doesNotMatch(sw, /^import PortalDemo/m);
});

test("it decides on viewport width at 768px, holds a slot until it knows, and follows a resize", () => {
    assert.match(sw, /MOBILE_DEMO_QUERY = "\(max-width: 767px\)"/);
    assert.match(sw, /\(\) => "unknown"/, "the server renders neither");
    assert.match(sw, /addEventListener\("change"/);
    assert.match(sw, /width === "mobile" \? <PortalDemoMobile \/> : <PortalDemo \/>/);
});
