/**
 * Refuse to build or serve this app against another checkout's node_modules.
 *
 * Why this exists (found 2026-11-04, after the main checkout's `node_modules/sharp` was
 * emptied several times on 2026-11-03/04):
 *
 *   1. A git worktree under `.claude/worktrees/<name>` that has no node_modules of its own
 *      still runs: Node and `npx` walk up the tree and find the main checkout's
 *      `node_modules`.
 *   2. `next build` / `next dev` then link each server-external package it bundles (sharp,
 *      for `app/lib/image-resize.ts`) as `.next/node_modules/sharp-<hash>`. On Windows that
 *      link is an NTFS junction to wherever sharp resolved, which is the main checkout.
 *   3. `git worktree remove` (with or without --force; Git for Windows 2.50) follows
 *      junctions while deleting. It empties the main checkout's `node_modules/sharp` and
 *      leaves the empty folder behind. The same happens to all of `node_modules` when a
 *      worktree's `node_modules` is itself a junction to another checkout's.
 *
 * So the rule is: every checkout installs its own dependencies (`npm ci`), and the build
 * says so instead of quietly linking into someone else's. next.config.ts calls this on
 * every `next build` and `next dev`, however they were started (`npm run`, `npx`, an IDE).
 */
"use strict";
// CommonJS on purpose: next.config.ts may be compiled to CJS, and Node 22.0 cannot require() ESM.
/* eslint-disable @typescript-eslint/no-require-imports -- this file is CommonJS by design */
const { lstatSync, realpathSync } = require("node:fs");
const { createRequire } = require("node:module");
const { join, relative, isAbsolute } = require("node:path");

/** Packages Next links into `.next/node_modules`, and so the ones a junction would point at. */
const LINKED_PACKAGES = ["sharp"];

const FIX = "Run `npm ci` in this folder first, so it has its own node_modules.";

const inside = (child, parent) => {
    const rel = relative(parent, child);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

/**
 * Returns why `projectDir` may not run Next against its dependencies, or null when it may.
 *
 * @param {string} projectDir the folder holding this app's package.json
 * @param {string[]} [packages] packages that must resolve inside projectDir/node_modules
 * @returns {string | null}
 */
function nodeModulesProblem(projectDir, packages = LINKED_PACKAGES) {
    const nodeModules = join(projectDir, "node_modules");

    let stat;
    try {
        stat = lstatSync(nodeModules);
    } catch {
        return `${projectDir} has no node_modules of its own, so Node is borrowing a parent folder's. ${FIX}`;
    }
    // Node reports an NTFS junction as a symbolic link too.
    if (stat.isSymbolicLink()) {
        let target = "another folder";
        try {
            target = realpathSync(nodeModules);
        } catch {
            // A dangling link: still a link, still not ours.
        }
        return (
            `${nodeModules} is a link to ${target}. Building here would let \`git worktree remove\` ` +
            `delete that folder's packages through the link. Delete the link (not its contents: ` +
            `\`cmd /c rmdir node_modules\`), then: ${FIX}`
        );
    }
    if (!stat.isDirectory()) return `${nodeModules} is not a folder. ${FIX}`;

    const ownReal = realpathSync(nodeModules);
    const requireHere = createRequire(join(projectDir, "package.json"));
    for (const name of packages) {
        let resolved;
        try {
            resolved = realpathSync(requireHere.resolve(name));
        } catch {
            return `\`${name}\` is missing or empty in ${nodeModules}. ${FIX}`;
        }
        if (!inside(resolved, ownReal)) {
            return `\`${name}\` resolves to ${resolved}, outside ${nodeModules}. ${FIX}`;
        }
    }
    return null;
}

/** Throws with the reason when `projectDir` may not run Next. */
function assertOwnNodeModules(projectDir) {
    const problem = nodeModulesProblem(projectDir);
    if (problem) {
        throw new Error(
            `[node-modules-guard] ${problem}\n` +
                `Why: see scripts/node-modules-guard.cjs. Linking into another checkout's ` +
                `node_modules is how the main checkout kept losing sharp.`,
        );
    }
}

module.exports = { nodeModulesProblem, assertOwnNodeModules };
