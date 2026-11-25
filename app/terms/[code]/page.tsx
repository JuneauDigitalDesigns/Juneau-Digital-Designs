import type { Metadata } from "next";
import { headers } from "next/headers";
import { lookupAgreementLink } from "@/app/lib/agree-link-limit";
import { smsConsentCopy } from "@/app/lib/sms-consent-text";
import AgreeLinkClient, { AgreeDone, AgreeInactive } from "@/app/components/agreement/AgreeLinkClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Terms of Service | Juneau Digital Designs",
    robots: { index: false, follow: false },
};

/** The client's private page for one order's agreement. No login: the code is the credential. */
export default async function AgreePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const normalized = code.trim().toUpperCase();
    // Through the per-IP limit on codes that don't exist (agree-link-limit.ts): past it, every code
    // shows as no longer active, the page a wrong code already gets.
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || null;
    const view = await lookupAgreementLink(normalized, ip);

    return (
        <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px max(16px, 4vw)" }}>
            <article className="glass" style={{ maxWidth: 760, margin: "0 auto", padding: "32px max(20px, 3vw)", borderRadius: 18 }}>
                {view.state === "inactive" && <AgreeInactive />}
                {view.state === "accepted" && <AgreeDone email={view.order.client.email} />}
                {view.state === "active" && (
                    <AgreeLinkClient
                        code={normalized}
                        sections={view.sections}
                        termsHash={view.termsHash}
                        isAddendum={view.order.agreementKind === "addendum" || view.version.startsWith("addendum")}
                        businessLine={`${view.order.client.legalName} · ${view.order.plan.charAt(0).toUpperCase()}${view.order.plan.slice(1)} plan, billed monthly`}
                        signerLine={`Signer: ${view.order.client.contactName}, ${view.order.client.contactTitle}, ${view.order.client.legalName}`}
                        email={view.order.client.email}
                        smsConsentCopy={smsConsentCopy()}
                        hasReceptionist={view.order.plan !== "website" && view.order.receptionistMode !== "declined"}
                    />
                )}
            </article>
        </main>
    );
}
