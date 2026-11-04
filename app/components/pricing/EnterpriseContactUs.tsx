import Link from "next/link";

/**
 * Shown at `/start?plan=enterprise` to a client who holds a Starter site.
 *
 * The ordinary path would open a new Enterprise subscription and charge its onboarding fee,
 * while the Starter subscription kept billing and the Starter site stayed outside the bundle.
 * Xander decided (D5, 2026-11-04) to set these up by hand for now rather than automate a move
 * that is rare. Wording approved word for word.
 */
export default function EnterpriseContactUs() {
    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
            <div className="max-w-lg text-center">
                <span className="eyebrow">Enterprise</span>
                <h1 className="mt-6" style={{ fontSize: "var(--text-2xl)" }}>
                    Let&rsquo;s set this up together
                </h1>
                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    Moving your Starter site onto Enterprise takes a few changes on our side, so
                    we&rsquo;ll set it up with you directly. Email hello@juneaudigitaldesigns.com and
                    we&rsquo;ll sort it out. Nothing has been charged.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com?subject=Move%20to%20Enterprise"
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
