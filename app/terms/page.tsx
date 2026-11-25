import type { Metadata } from "next";
import { pageMetadata } from "@/app/lib/site-seo";
import Link from "next/link";
import { getTermsForPlan } from "@/app/lib/legal";
import { hashTermsForPlan } from "@/app/lib/legal/hash";
import type { Block, Section } from "@/app/lib/legal/types";
import type { PlanSlug } from "@/app/lib/agreement-types";

export const metadata: Metadata = pageMetadata(
    "/terms",
    "Terms of Service | Juneau Digital Designs",
    "The Juneau Digital Designs Terms of Service, with the plan summary for each plan, as clients accept them at checkout.",
);

/**
 * The public Terms of Service.
 *
 * Exists because Stripe Checkout's `consent_collection.terms_of_service: "required"` links the
 * client to a Terms of Service URL from Stripe's public details, and a signed-out buyer must be
 * able to read what they are ticking. `/terms/accept` (signed in) is where a client accepts.
 *
 * Read-only. Nothing is accepted here. Acceptance happens on `/terms/accept` (a ticked box), on
 * a private link `/terms/[code]`, or on a sales call (verbal, recorded by the operator), and all
 * record the same version and hash this page prints. Rendered from `getTermsForPlan`, the one
 * source the acceptance pages, the PDF and `hashTermsForPlan` all read, so this page cannot show
 * words other than the ones a client agrees to. Public on purpose: nothing in `proxy.ts`
 * protects `/terms`.
 */

/** One tab per plan a client can be asked to accept, cheapest first. */
const DOCUMENTS: { key: string; label: string; plan: PlanSlug }[] = [
    { key: "website", label: "Starter", plan: "website" },
    { key: "starter", label: "Starter + AI Receptionist", plan: "starter" },
    { key: "growth", label: "Growth", plan: "growth" },
    { key: "enterprise", label: "Enterprise", plan: "enterprise" },
];

export default async function TermsPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string }>;
}) {
    const { plan: requested } = await searchParams;
    const doc = DOCUMENTS.find((d) => d.key === requested) ?? DOCUMENTS.find((d) => d.key === "growth")!;
    const { version, sections } = getTermsForPlan(doc.plan);
    const hash = hashTermsForPlan(doc.plan);

    return (
        <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "64px max(24px, 4vw)" }}>
            <article
                className="glass"
                style={{ maxWidth: 860, margin: "0 auto", padding: "40px max(24px, 3vw)", borderRadius: 18 }}
            >
                <div className="kicker" style={{ marginBottom: 10 }}>━ TERMS OF SERVICE</div>
                <h1 style={{ margin: "0 0 10px", fontSize: 34, lineHeight: 1.15, color: "var(--fg)" }}>
                    Terms of Service
                </h1>
                <p style={{ margin: "0 0 20px", color: "var(--fg-2)", fontSize: 14.5, lineHeight: 1.6 }}>
                    Version {version}. Choose your plan to read the Terms of Service with its plan summary. See
                    also our{" "}
                    <Link href="/sms-terms" style={{ color: "var(--fg)", fontWeight: 600 }}>SMS Terms</Link> and{" "}
                    <Link href="/privacy-policy" style={{ color: "var(--fg)", fontWeight: 600 }}>Privacy Policy</Link>.
                </p>

                <nav aria-label="Plan" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                    {DOCUMENTS.map((d) => (
                        <Link
                            key={d.key}
                            href={`/terms?plan=${d.key}`}
                            aria-current={d.key === doc.key ? "page" : undefined}
                            style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                fontSize: 13.5,
                                fontWeight: 600,
                                textDecoration: "none",
                                border: "1px solid var(--rule)",
                                color: d.key === doc.key ? "var(--bg)" : "var(--fg)",
                                background: d.key === doc.key ? "var(--fg)" : "transparent",
                            }}
                        >
                            {d.label}
                        </Link>
                    ))}
                </nav>

                {sections.map((s) => (
                    <TermsSection key={`${s.num}-${s.heading}`} section={s} />
                ))}

                <p
                    data-terms-version={version}
                    data-terms-hash={hash}
                    style={{ marginTop: 36, fontSize: 12, color: "var(--fg-3)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}
                >
                    {doc.label} · {version} · SHA-256 {hash}
                </p>
            </article>
        </main>
    );
}

function TermsSection({ section }: { section: Section }) {
    return (
        <section style={{ marginTop: 28 }}>
            {/* Section 0 with no heading is the preamble; the plan summary is section 0 with one. */}
            {section.heading && (
                <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "var(--fg)" }}>
                    {section.num === 0 ? section.heading : `${section.num}. ${section.heading}`}
                </h2>
            )}
            {section.intro.map((b, i) => (
                <TermsBlock key={i} block={b} />
            ))}
            {section.subsections.map((sub) => (
                <div key={sub.num + sub.heading} style={{ marginTop: 14 }}>
                    {sub.heading && (
                        <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--fg)" }}>
                            {sub.num ? `${sub.num} ${sub.heading}` : sub.heading}
                        </h3>
                    )}
                    {sub.blocks.map((b, i) => (
                        // A clause with no heading prints its number at the start of its text.
                        <TermsBlock key={i} block={b} lead={!sub.heading && i === 0 ? sub.num : undefined} />
                    ))}
                </div>
            ))}
        </section>
    );
}

const text = { margin: "0 0 10px", fontSize: 14, lineHeight: 1.65, color: "var(--fg-2)" } as const;

function TermsBlock({ block, lead }: { block: Block; lead?: string }) {
    const num = lead ? <strong style={{ color: "var(--fg)" }}>{lead} </strong> : null;
    switch (block.kind) {
        case "para":
            return (
                <p style={text}>
                    {num}
                    {block.text}
                </p>
            );
        case "allcaps":
            return (
                <p style={{ ...text, fontSize: 13 }}>
                    {num}
                    {block.text}
                </p>
            );
        case "callout":
            return (
                <p style={{ ...text, padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: 10, background: "var(--surface)" }}>
                    {block.text}
                </p>
            );
        case "bullets":
            return (
                <ul style={{ ...text, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                    {block.items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            );
        case "table":
            return (
                <table style={{ width: "100%", borderCollapse: "collapse", margin: "0 0 12px", fontSize: 13.5 }}>
                    <tbody>
                        {block.rows.map(([k, v], i) => (
                            <tr key={i}>
                                <td style={{ padding: "8px 10px", border: "1px solid var(--rule)", color: "var(--fg)", fontWeight: 600, width: "45%" }}>{k}</td>
                                <td style={{ padding: "8px 10px", border: "1px solid var(--rule)", color: "var(--fg-2)" }}>{v}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
    }
}
