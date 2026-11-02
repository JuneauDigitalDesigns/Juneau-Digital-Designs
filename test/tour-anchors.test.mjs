import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The first-run tour anchors on `data-tour` attributes. This test exists because one of them
 * was silently dropped and nothing could catch it.
 *
 * `InboxSection.tsx` set `data-tour="inbox-list"` on `<Card>`, and `Card` destructured a closed
 * prop list with no rest spread — so the attribute never reached the DOM. `TourController`
 * polls four seconds for that anchor and bails without rendering or logging, so the entire tour
 * silently never ran for any user.
 *
 * Neither existing guard could see it:
 *  - `tsc` does not type-check hyphenated JSX attributes against a component's props, so
 *    `data-tour` on a component that does not accept it is not an error. The compiler is
 *    structurally incapable of flagging this.
 *  - There is no runtime error. The tour just quietly does nothing.
 *
 * So the rule is checked here instead: a `data-tour` on a lowercase intrinsic element always
 * reaches the DOM, but on a capitalized component it only does if that component explicitly
 * accepts it or spreads the rest of its props.
 */

const COMPONENT_ROOT = "app/components";

/** Every .tsx under app/components, recursively. */
function tsxFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
        else if (entry.endsWith(".tsx")) out.push(path);
    }
    return out;
}

/** The JSX tag name that a given `data-tour=` occurrence sits inside. */
function owningTag(source, attrIndex) {
    const open = source.lastIndexOf("<", attrIndex);
    if (open === -1) return null;
    return source.slice(open + 1).match(/^([A-Za-z][A-Za-z0-9_.]*)/)?.[1] ?? null;
}

/**
 * Is this capitalized tag really a polymorphic intrinsic element?
 *
 * `Card` renders `<Tag>` where `as: Tag = "div"` — capitalized so JSX treats it as a value, but
 * the value is always an intrinsic tag name, so the attribute does reach the DOM.
 */
function isPolymorphicTag(tag, source) {
    return new RegExp(`\\bas:\\s*${tag}\\b`).test(source);
}

/** Does this component declare `data-tour`, or spread the rest of its props onto the element? */
function forwardsDataTour(componentName, files) {
    const bare = componentName.split(".").pop();
    for (const file of files) {
        const src = readFileSync(file, "utf8");
        const defines = new RegExp(`(function|const)\\s+${bare}\\b`).test(src);
        if (!defines) continue;
        // A rest spread carries unknown props onto the element on its own.
        if (/\.\.\.(rest|props|others)\b/.test(src)) return true;
        // Otherwise it must BOTH accept the prop and pass it to something it renders. Declaring
        // it alone is not enough: a component can accept `data-tour` and drop it on the floor,
        // which fails exactly as silently as not accepting it.
        return src.includes('"data-tour"') && /data-tour=\{/.test(src);
    }
    // Not one of ours (next/link, phosphor icons, …) — those forward unknown props themselves.
    return true;
}

test("every data-tour anchor actually reaches the DOM", () => {
    const files = tsxFiles(COMPONENT_ROOT);
    const dropped = [];

    for (const file of files) {
        const src = readFileSync(file, "utf8");
        for (const match of src.matchAll(/data-tour=/g)) {
            const tag = owningTag(src, match.index);
            if (!tag || !/^[A-Z]/.test(tag)) continue; // intrinsic element — always reaches the DOM
            if (isPolymorphicTag(tag, src)) continue; // capitalized, but holds an intrinsic tag name
            if (!forwardsDataTour(tag, files)) {
                const line = src.slice(0, match.index).split("\n").length;
                dropped.push(`${file}:${line} — <${tag}> does not forward data-tour`);
            }
        }
    }

    assert.deepEqual(
        dropped,
        [],
        `data-tour set on a component that silently drops it:\n  ${dropped.join("\n  ")}\n\n` +
            `Give that component an explicit \`"data-tour"?: string\` prop and pass it to the ` +
            `element it renders.`
    );
});
