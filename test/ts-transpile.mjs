import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import ts from "typescript";

/**
 * Letting `node --test` import this repo's `.ts` modules.
 *
 * The runtime is pinned at Node v22.0.0, which cannot read TypeScript at all — type stripping
 * arrived in 22.6 behind a flag. That is a real constraint on what can be tested: the a2p
 * modules are written as plain `.mjs` precisely so their tests could import them, and its
 * test file says so.
 *
 * That trick does not scale. Most of this repo's pure logic lives in `.ts` where it belongs —
 * `crm-contacts.ts` is imported by a route and leans on TypeScript interfaces to describe two
 * upstream shapes — and converting a module to `.mjs` to make it testable means production
 * code shaped around the test runner, which is backwards. The alternative was a test holding
 * its own copy of `buildInbox`, which certifies the copy and not the thing that ships.
 *
 * So this strips the types instead, with the `typescript` already in devDependencies. Tests
 * import `../app/lib/<module>.ts` and get the real implementation, byte for byte what Next
 * compiles, minus annotations.
 *
 * Deliberately *only* type stripping: `transpileModule` does no type checking, which is
 * `npx tsc --noEmit`'s job and would be a waste to repeat per test run. A type error here
 * surfaces as a test failure, not a transpile failure, which is the right division.
 */

const ROOT = resolvePath(fileURLToPath(import.meta.url), "../..");

/** Extensions tried for an extensionless relative specifier, in TypeScript's own order. */
const EXTENSIONS = [".ts", ".tsx", ".mts"];

function firstExisting(basePath) {
    for (const ext of EXTENSIONS) {
        if (existsSync(basePath + ext)) return basePath + ext;
    }
    // A directory import (`./legal`) resolves to its index, as TypeScript and Next resolve it.
    for (const ext of EXTENSIONS) {
        const index = resolvePath(basePath, `index${ext}`);
        if (existsSync(index)) return index;
    }
    return null;
}

export async function resolve(specifier, context, next) {
    // `@/*` maps to the repo root, mirroring tsconfig `paths`. Almost every lib here imports
    // that way, so a hook that only understood `./` would fail on the second module tested.
    const bare = specifier.startsWith("@/")
        ? resolvePath(ROOT, specifier.slice(2))
        : specifier.startsWith(".") && context.parentURL
          ? resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
          : null;

    if (bare) {
        // An explicit `.ts`/`.tsx` is honoured as written; everything else is extensionless,
        // the way TypeScript source is normally spelled.
        const hit = EXTENSIONS.some((e) => bare.endsWith(e))
            ? (existsSync(bare) ? bare : null)
            : firstExisting(bare);
        if (hit) return { url: pathToFileURL(hit).href, format: "module", shortCircuit: true };
    }

    return next(specifier, context);
}

export async function load(url, context, next) {
    if (!EXTENSIONS.some((e) => url.endsWith(e))) return next(url, context);

    const path = fileURLToPath(url);
    const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
        fileName: path,
        compilerOptions: {
            // ESNext output so `import`/`export` survive untouched — anything that downlevels
            // to `require` would not load as an ES module here.
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
            // Matches tsconfig. Without it `transpileModule` warns on every file, since a
            // single-file transform cannot know whether an exported name is a type.
            isolatedModules: true,
        },
    });

    return { format: "module", source: outputText, shortCircuit: true };
}
