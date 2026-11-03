import { register } from "node:module";

/**
 * Registers the TypeScript transpile hooks for the test run. Wired up by `npm test` via
 * `--import`, which has to happen before any test file is loaded.
 *
 * Two files rather than one because `module.register` loads its hooks into a separate thread,
 * so the registrar and the hooks cannot be the same module.
 */
register("./ts-transpile.mjs", import.meta.url);
