import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { validateIdentityInput, type A2pIdentityInput } from "@/app/lib/a2p-identity.mjs";
import { A2pVendorError, createIdentityObjects } from "@/app/lib/a2p-trusthub.mjs";
import {
    readRegistrationIdentity,
    saveRegistrationIdentity,
} from "@/app/lib/a2p-registration-store.mjs";

/**
 * A2P identity — submit and consume.
 *
 * The POST handler *is* the TrustHub call. The client's EIN (and the authorized
 * representative's name, direct email and mobile) exist in this process's memory for the
 * duration of one request, are sent to Twilio, and are unreachable the moment the request
 * ends. Only the resulting SIDs are persisted.
 *
 * **This is a structural property, not a convention.** Collecting the EIN at one step and
 * using it at a later one would need somewhere to hold it in between, and serverless memory
 * does not survive invocations — so "somewhere" becomes storage, and storage is the thing
 * being avoided. That is why the field's submit handler and the registration call are the
 * same request, and why this route cannot be split in two.
 *
 * Rules this file exists to keep (`PLAN-portal-form-capture.md` §1b):
 *   - the request body is never logged, in whole or in part;
 *   - no error path interpolates the payload — a Twilio 400 quotes the offending value back,
 *     and an unhandled throw in a Next route prints `error.message` to stderr, which Vercel
 *     captures. `A2pVendorError` is scrubbed at construction for exactly this reason;
 *   - nothing is echoed to the browser, success or failure, beyond field *names*;
 *   - identity never travels in the URL. Vercel's runtime logs capture request path and
 *     **Search Params** (documented), and not the body — so the payload is POST JSON and
 *     `?site=` carries nothing but a slug.
 *
 * Out of scope here, by design: the customer profile, entity assignments, compliance
 * evaluation, submit-for-review, trust product, brand and campaign. Those take SIDs, not
 * identity data, and belong to the registration chain (`jdd-ops`, per the runbook).
 */

/** Only these tiers register — Starter and web-only send no customer-facing messages. */
const REGISTERING_PLANS = new Set(["growth", "enterprise"]);

/**
 * Does this site already have a business identity on file?
 *
 * The wizard asks this on mount so it can skip the field rather than make a returning client
 * expose their EIN a second time for nothing. Returns a boolean, never the SIDs: the browser
 * has no use for them, and "what does the client need to see" is the only question that
 * decides what crosses the wire.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (!REGISTERING_PLANS.has(ctx.site.plan)) {
        return NextResponse.json({ applicable: false, onFile: false });
    }

    const record = await readRegistrationIdentity({ slug: ctx.site.slug });
    return NextResponse.json({
        applicable: true,
        onFile: Boolean(record?.businessEndUserSid),
        registrationPath: record?.registrationPath ?? null,
    });
}

export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (!REGISTERING_PLANS.has(ctx.site.plan)) {
        // Refused rather than ignored: a Starter or web-only client reaching here means the
        // step rendered when it should not have, and silently accepting identity data we have
        // no registration to use it for is the worst of both outcomes.
        return NextResponse.json(
            { error: "This plan does not register for business messaging." },
            { status: 400 },
        );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
        // Checked before the body is read, so a misconfigured deployment cannot be the reason
        // a client's EIN was in this process's memory at all.
        return NextResponse.json(
            { error: "Business registration is not configured yet. Nothing was sent." },
            { status: 503 },
        );
    }

    // Already on file: do not re-create. Twilio would hold a second copy of the same
    // identity, and the first one is the one the registration chain is already pointing at.
    const existing = await readRegistrationIdentity({ slug: ctx.site.slug });
    if (existing?.businessEndUserSid) {
        return NextResponse.json({ ok: true, alreadyOnFile: true });
    }

    let input: A2pIdentityInput;
    try {
        input = (await request.json()) as A2pIdentityInput;
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validation = validateIdentityInput(input);
    if (!validation.ok) {
        // Field names only. The values are the point of the exercise.
        return NextResponse.json(
            { error: "Some details are missing or malformed.", fields: validation.fields },
            { status: 400 },
        );
    }

    // Enterprise cannot take the sole-proprietor path: a Sole Proprietor campaign allows one
    // number, and Enterprise runs two or three sites. Allowing it would register a client
    // whose second number can never be added — discovered weeks later, at the campaign.
    if (ctx.site.plan === "enterprise" && input.registrationPath === "sole-proprietor") {
        return NextResponse.json(
            { error: "Enterprise registration requires an EIN.", fields: ["registrationPath"] },
            { status: 400 },
        );
    }

    try {
        const sids = await createIdentityObjects({
            slug: ctx.site.slug,
            input,
            auth: { accountSid, authToken },
        });

        await saveRegistrationIdentity({
            slug: ctx.site.slug,
            registrationPath: input.registrationPath,
            sids,
        });

        // The whole audit trail, and deliberately so: the event, the site, the path taken.
        // No field names from the payload, no values, nothing derived from them. This mirrors
        // the console's key-names-not-values audit convention.
        console.log(
            `[a2p-identity] submitted and consumed site=${ctx.site.slug} path=${input.registrationPath} at=${new Date().toISOString()}`,
        );

        return NextResponse.json({ ok: true });
    } catch (error) {
        // `A2pVendorError.message` is scrubbed at construction, so it is safe to return and
        // safe to log; anything else is replaced wholesale rather than inspected, because an
        // unknown error's message may have been built from the payload by code we don't own.
        if (error instanceof A2pVendorError) {
            console.error(`[a2p-identity] vendor rejected site=${ctx.site.slug}: ${error.message}`);
            return NextResponse.json(
                { error: "Our messaging provider rejected these details. We have been notified." },
                { status: 502 },
            );
        }
        console.error(`[a2p-identity] failed site=${ctx.site.slug} (message withheld)`);
        return NextResponse.json({ error: "Could not submit these details." }, { status: 500 });
    }
}
