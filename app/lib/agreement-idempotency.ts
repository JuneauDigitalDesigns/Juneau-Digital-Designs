import { createHash } from "node:crypto";
import type { AgreementSubmission } from "./agreement-types";

/**
 * When is a second acceptance "the same agreement again"?
 *
 * When the same account accepts the same document, for the same purchase, with the same
 * details. A retry is the usual cause: an error after the agreement saved, a double press, or
 * a trip back through `/pricing` after a failed checkout, which is what produced the duplicate
 * on the 2026-11-04 Stripe test run. A retry must not file a second agreement or send a second
 * copy. `/api/agreement` returns the first one instead.
 *
 * The key covers the account, the document shown (its version, and the hash of the terms, which
 * tells the Website-Only schedule apart), and every field of the submission except the two visit
 * timestamps (`pageOpenedAt`, `scrollCompletedAt`), which describe the visit, not the agreement,
 * and change on every retry. Every other field counts, including fields added after this was
 * written: plan, master or addendum and its parent, billing period, the site being changed, the
 * entity and signer, extra sites, the phone choice, the SMS opt-in and its number. If any of
 * them differ, the client agreed to something different, and that gets its own record and its
 * own email. Correcting a typo in the signer's email, for example, sends the agreement to the
 * corrected address.
 *
 * Text is trimmed and the signer's email lowercased, so stray whitespace or a capital does not
 * count as a different agreement. A drawn signature (only from a page loaded before clickwrap
 * shipped) enters as its hash. Scoped to the signed-in account, so two accounts never share a
 * key.
 */
export interface IdempotencyDocument {
    version: string;
    termsHash: string;
}

/** Visit metadata, not terms: left out so a retry from a reloaded page still matches. */
const VISIT_FIELDS = new Set(["pageOpenedAt", "scrollCompletedAt"]);

function normalise(value: unknown): unknown {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(normalise);
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(value).sort()) out[k] = normalise((value as Record<string, unknown>)[k]);
        return out;
    }
    return value;
}

export function agreementIdempotencyKey(
    accountEmail: string,
    body: AgreementSubmission,
    doc: IdempotencyDocument,
): string {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
        if (VISIT_FIELDS.has(k) || v === undefined || v === null) continue;
        fields[k] = v;
    }
    // Absent and "master" are the same document.
    fields.kind = body.kind === "addendum" ? "addendum" : "master";
    if (typeof body.signerEmail === "string") fields.signerEmail = body.signerEmail.trim().toLowerCase();
    if (typeof body.signatureDataUrl === "string") {
        fields.signatureDataUrl = createHash("sha256").update(body.signatureDataUrl).digest("hex");
    }

    const canonical = normalise({
        account: accountEmail.trim().toLowerCase(),
        version: doc.version,
        termsHash: doc.termsHash,
        submission: fields,
    });
    return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
