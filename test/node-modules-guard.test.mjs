/**
 * The build refuses to run against another checkout's node_modules.
 *
 * On 2026-11-03/04 the main checkout's `node_modules/sharp` was emptied again and again. The
 * cause: a worktree with no node_modules of its own ran `next build`, which borrowed the main
 * checkout's packages and linked `.next/node_modules/sharp-<hash>` to the main checkout's sharp
 * as an NTFS junction. `git worktree remove` follows junctions, so removing the worktree
 * deleted the main checkout's sharp. scripts/node-modules-guard.cjs stops the build before
 * that link is made; these tests pin each way of borrowing that it has to catch.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { nodeModulesProblem, assertOwnNodeModules } = createRequire(import.meta.url)(
    "../scripts/node-modules-guard.cjs",
);

const scratch = mkdtempSync(join(tmpdir(), "nm-guard-"));
// fs.rmSync unlinks junctions rather than following them, so this cleans up safely.
after(() => rmSync(scratch, { recursive: true, force: true }));

let n = 0;
/** A folder with a package.json, and optionally a node_modules holding a fake sharp. */
function project({ withSharp = true, withNodeModules = true } = {}) {
    const dir = join(scratch, `p${n++}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), '{"name":"app","private":true}');
    if (withNodeModules) mkdirSync(join(dir, "node_modules"));
    if (withSharp) fakeSharp(join(dir, "node_modules"));
    return dir;
}
function fakeSharp(nodeModules) {
    mkdirSync(join(nodeModules, "sharp"), { recursive: true });
    writeFileSync(join(nodeModules, "sharp", "package.json"), '{"name":"sharp","main":"index.js"}');
    writeFileSync(join(nodeModules, "sharp", "index.js"), "module.exports = {};");
}
const junction = (target, path) => symlinkSync(target, path, "junction");

test("a checkout with its own node_modules and sharp may build", () => {
    assert.equal(nodeModulesProblem(project()), null);
    assert.doesNotThrow(() => assertOwnNodeModules(project()));
});

test("a worktree with no node_modules, borrowing the parent checkout's, may not", () => {
    // The shape of .claude/worktrees/<name> under a main checkout that has installed.
    const main = project();
    const worktree = join(main, ".claude", "worktrees", "verify");
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktree, "package.json"), '{"name":"app","private":true}');

    // Node itself would happily use the parent's sharp: that is the hazard.
    assert.equal(
        createRequire(join(worktree, "package.json")).resolve("sharp"),
        join(main, "node_modules", "sharp", "index.js"),
    );
    assert.match(nodeModulesProblem(worktree), /has no node_modules of its own/);
    assert.throws(() => assertOwnNodeModules(worktree), /node-modules-guard.*npm ci/s);
});

test("a node_modules that is a junction to another checkout's may not", () => {
    const other = project();
    const worktree = project({ withNodeModules: false, withSharp: false });
    junction(join(other, "node_modules"), join(worktree, "node_modules"));
    assert.match(nodeModulesProblem(worktree), /is a link to .*rmdir node_modules/s);
});

test("a sharp that is itself a junction out of node_modules may not", () => {
    const other = project();
    const worktree = project({ withSharp: false });
    junction(join(other, "node_modules", "sharp"), join(worktree, "node_modules", "sharp"));
    assert.match(nodeModulesProblem(worktree), /`sharp` resolves to .* outside/);
});

test("an emptied sharp, the state the bug left behind, is named rather than half-built", () => {
    const dir = project({ withSharp: false });
    mkdirSync(join(dir, "node_modules", "sharp"));
    assert.match(nodeModulesProblem(dir), /`sharp` is missing or empty/);
});

test("next.config.ts runs the guard before Next reads its config", () => {
    const src = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    assert.match(src, /import \{ assertOwnNodeModules \} from "\.\/scripts\/node-modules-guard\.cjs";/);
    const call = src.search(/^assertOwnNodeModules\(/m);
    assert.ok(call > 0, "assertOwnNodeModules(...) is called at the top level");
    assert.ok(call < src.indexOf("export default"), "and before the config is exported");
});
