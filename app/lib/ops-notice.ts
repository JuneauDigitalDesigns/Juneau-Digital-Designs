import "server-only";
import { Resend } from "resend";
import { brandedEmailHtml } from "./email-template";
import { EMAIL } from "./email-tokens";

/**
 * A short internal email to Xander about a change a client made in the portal that needs a
 * console step from him.
 *
 * A portal upgrade used to tell nobody, so `LEAD_CALLBACK` stayed off and `site.ts` stayed on
 * Starter: the client paid for Growth and got Starter's web-form behaviour until someone noticed.
 * The same went for a move to Enterprise and a scheduled downgrade.
 *
 * Never throws: the client's change has already happened, and a mail failure must not turn it
 * into an error for them.
 */
export async function sendOpsNotice(subject: string, lines: string[]): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.QUOTE_TO_EMAIL;
    if (!apiKey || !to) {
        console.warn("[ops-notice] RESEND_API_KEY or QUOTE_TO_EMAIL not set, not sent:", subject);
        return;
    }
    const from = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
    const body = lines
        .map((l) => `<p style="margin:0 0 12px;color:${EMAIL.ink};font-size:14px;line-height:1.6;">${l}</p>`)
        .join("");
    try {
        const { error } = await new Resend(apiKey).emails.send({
            from,
            to: [to],
            subject,
            html: brandedEmailHtml({ title: subject.replace(/^\[JDD\]\s*/, ""), body }),
        });
        if (error) console.error("[ops-notice] rejected", subject, error);
    } catch (e) {
        console.error("[ops-notice] failed", subject, e);
    }
}
