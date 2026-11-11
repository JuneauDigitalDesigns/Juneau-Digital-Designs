import { NextResponse, after } from "next/server";
import { AgreementLinkError, acceptAgreementLink, resolveAgreementLink } from "@/app/lib/agreement-link";
import { AGREE_CODE, agreementConsentError, agreementSubmissionError } from "@/app/lib/agreement-link.mjs";
import { normalizeE164 } from "@/app/lib/phone";
import { smsConsentCopyForVersion } from "@/app/lib/sms-consent-text";
import { sendClientAgreementEmail } from "@/app/lib/agreement-email";
import { shortAgreeUrl } from "@/app/lib/order-checkout";
import { stripLastPage } from "@/app/lib/pdf-signer";

export const runtime = "nodejs";

/**
 * A client agreeing through their private link (`/agree/[code]`). No login: the code is the
 * credential, tied to one order and one version of the document. Everything the page enforces is
 * checked again here.
 */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
    const { code } = await ctx.params;
    const normalized = code.trim().toUpperCase();
    if (!AGREE_CODE.test(normalized)) return inactive();

    const view = await resolveAgreementLink(normalized);
    if (view.state === "accepted") return NextResponse.json({ ok: true, email: view.order.client.email });
    if (view.state === "inactive") return inactive();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const problem = agreementSubmissionError(body ?? {}, view.termsHash) ?? agreementConsentError(body ?? {}, view.order);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    // The optional SMS opt-in, recorded against the words the page showed beside the box. A
    // version this deploy doesn't know can't be proven, so nothing is recorded against it.
    let smsConsent: { phone: string; copy: NonNullable<ReturnType<typeof smsConsentCopyForVersion>> } | undefined;
    if (body?.smsConsent === true) {
        const copy = smsConsentCopyForVersion(body.smsConsentVersion);
        const phone = normalizeE164(String(body.alertPhone));
        if (!copy) {
            return NextResponse.json({ error: "This agreement has changed. Reload the page to read the current version." }, { status: 400 });
        }
        if (phone) smsConsent = { phone, copy };
    }

    try {
        const { order, result } = await acceptAgreementLink(normalized, {
            pageOpenedAt: String(body?.pageOpenedAt),
            scrollCompletedAt: String(body?.scrollCompletedAt),
            ip: clientIp(request),
            userAgent: request.headers.get("user-agent") || "unknown",
            path: shortAgreeUrl(normalized),
        }, smsConsent);
        if (result) {
            after(() =>
                stripLastPage(result.pdfBytes)
                    .then((copy) => sendClientAgreementEmail(result.record, copy))
                    .catch((e) => console.error("[agree] terms email failed", order.id, e)),
            );
        }
        return NextResponse.json({ ok: true, email: order.client.email });
    } catch (e) {
        if (e instanceof AgreementLinkError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
        console.error("[agree] could not record the agreement", e);
        return NextResponse.json({ error: "The agreement could not be recorded. Try again." }, { status: 500 });
    }
}

function inactive() {
    return NextResponse.json({ error: "This link is no longer active.", code: "inactive" }, { status: 410 });
}

function clientIp(req: Request): string {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}
