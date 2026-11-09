import { NextResponse } from "next/server";
import { readAgreementPdf } from "@/app/lib/agreement-store";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { ownedAgreement } from "@/app/lib/portal-agreements";
import { stripLastPage } from "@/app/lib/pdf-signer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads one signed agreement for the signed-in owner of that account.
 *
 * Ownership is checked on the server on every download, against the session's own account. The
 * client's copy has the audit page removed (IP address, browser, hashes), the same copy the
 * signing email attaches. A refusal and a missing file are the same 404, so this can't be used
 * to find out which agreement ids exist.
 */
const NOT_FOUND = () => NextResponse.json({ error: "Agreement not available" }, { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const { id } = await params;
    const record = await ownedAgreement(ctx.account, id);
    if (!record) return NOT_FOUND();

    let copy: Uint8Array;
    try {
        copy = await stripLastPage(await readAgreementPdf(record.id));
    } catch (e) {
        console.error("[portal/agreements] could not read", record.id, e);
        return NOT_FOUND();
    }

    const date = record.audit.signedAt.slice(0, 10);
    const name = record.kind === "addendum" ? "addendum" : "agreement";
    return new Response(Buffer.from(copy), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="jdd-${name}-${date}.pdf"`,
            "Cache-Control": "private, no-store",
        },
    });
}
