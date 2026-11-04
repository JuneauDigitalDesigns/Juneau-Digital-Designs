/**
 * The agency build must never download a font.
 *
 * next/font/google fetches its families from Google during `next build`, so every production
 * deploy depended on Google answering. Twice that dependency failed a deploy:
 *   - 2026-11-02: Big Shoulders failed three builds in a day, and one of those failures left
 *     production serving a dead KV credential. It was self-hosted that day.
 *   - 2026-11-04: a production build failed with module-not-found on the Hanken Grotesk font
 *     CSS, and a retry built. Hanken, DM Mono, Inter and JetBrains Mono were still on
 *     next/font/google.
 * All of them now load from committed files in app/fonts/ via next/font/local.
 *
 * Reads the source rather than importing it: Node 22.0 cannot load the TypeScript layout. On the
 * code before this change, the first test fails on app/layout.tsx.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".git", ".claude", ".vercel", "test"]);
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function googleFontImports() {
  const hits = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name)) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (SOURCE.test(name) && /from\s+["']next\/font\/google["']/.test(readFileSync(p, "utf8"))) {
        hits.push(relative(ROOT, p).split(sep).join("/"));
      }
    }
  };
  walk(ROOT);
  return hits;
}

test("nothing in the app imports next/font/google", () => {
  assert.deepEqual(googleFontImports(), []);
});

test("every font file the layout loads is committed, and is woff2", () => {
  const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
  // Both forms next/font/local takes: `src: "./fonts/x.woff2"` and `{ path: "./fonts/x.woff2" }`.
  const paths = [...new Set([...layout.matchAll(/(?:src|path):\s*"(\.\/fonts\/[^"]+)"/g)].map((m) => m[1]))];
  assert.ok(paths.length >= 6, `expected the layout to load at least six local font files, found ${paths.length}`);
  for (const rel of paths) {
    const file = join(ROOT, "app", rel);
    assert.ok(existsSync(file), `${rel} is missing; the build fails with module-not-found`);
    // A CRLF-converted woff2 still exists and still builds; only the browser rejects it.
    assert.equal(readFileSync(file).subarray(0, 4).toString("latin1"), "wOF2", `${rel} is not woff2`);
  }
});

test("every font variable the app's CSS reads is still defined by the layout", () => {
  // Swapping a loader must not drop a variable: a missing one is no error, the text just falls
  // back to the system stack.
  const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
  for (const v of ["--font-big-shoulders", "--font-dm-mono", "--font-hanken", "--font-inter", "--font-jetbrains", "--font-cabinet"]) {
    assert.match(layout, new RegExp(`variable:\\s*"${v}"`), `${v} is no longer defined`);
  }
});
