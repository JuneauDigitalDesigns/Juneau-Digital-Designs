import LinkInactive from "@/app/components/agreement/LinkInactive";

/** Every payment link that doesn't work gets exactly this, whatever the reason. */
export default function PayLinkNotFound() {
    return (
        <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px max(16px, 4vw)" }}>
            <article className="glass" style={{ maxWidth: 560, margin: "0 auto", padding: "32px max(20px, 3vw)", borderRadius: 18 }}>
                <div className="kicker" style={{ textAlign: "center", marginBottom: 6 }}>JUNEAU DIGITAL DESIGNS</div>
                <LinkInactive />
            </article>
        </main>
    );
}
