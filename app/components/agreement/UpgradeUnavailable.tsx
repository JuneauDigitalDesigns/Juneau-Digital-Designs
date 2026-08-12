import Link from "next/link";

/**
 * Shown instead of the signing form when an `?upgrade=<slug>` link can't lead anywhere.
 *
 * Covers several causes with one message on purpose — signed out, slug not on the account,
 * site not a live starter, or no subscription on file. Distinguishing them for the visitor
 * would either be useless to them (our billing plumbing) or tell an unauthenticated stranger
 * which slugs exist. The specific reason goes to the server log, where it can be acted on.
 *
 * The tone is "something needs fixing", not "you can't have this": a live client without a
 * subscription on file is an anomaly, and the fix is ours to make.
 */
export default function UpgradeUnavailable() {
    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
            <div className="max-w-lg text-center">
                <span className="eyebrow">Upgrade</span>

                <h1 className="mt-6" style={{ fontSize: "var(--text-2xl)" }}>
                    We need to sort something out first
                </h1>

                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    We can&rsquo;t start this upgrade from here. If you were trying to move up to
                    Growth, get in touch and we&rsquo;ll set it up for you — it won&rsquo;t take
                    long, and nothing has been charged.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com?subject=Upgrade%20to%20Growth"
                        className="btn primary"
                    >
                        Get in touch
                    </a>
                    <Link
                        href="/portal"
                        className="text-sm underline underline-offset-4"
                        style={{ color: "var(--fg-2)" }}
                    >
                        Back to your portal
                    </Link>
                </div>
            </div>
        </main>
    );
}
