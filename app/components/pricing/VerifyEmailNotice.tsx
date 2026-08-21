import Link from "next/link";

/**
 * Shown at `/start` when the signed-in user has no *verified* email address.
 *
 * The account record is keyed on email, and an unverified address is a claim rather than a
 * fact — creating a record under one would let a stranger who typed a paying client's address
 * into the signup form inherit their portal. So the gate stops here instead.
 *
 * Rare enough that it does not need a resend button: Clerk's own flow already sent the
 * verification, and its UI is where they complete it. This page's job is to explain why the
 * purchase did not continue, which is otherwise completely opaque.
 */
export default function VerifyEmailNotice() {
    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
            <div className="max-w-lg text-center">
                <span className="eyebrow">One more step</span>

                <h1 className="mt-6" style={{ fontSize: "var(--text-2xl)" }}>
                    Confirm your email to continue
                </h1>

                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    We sent a verification link when you created your login. Open it, then come
                    back and pick your plan again — your account is tied to that address, so we
                    confirm it before anything is set up or charged.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    <Link href="/pricing" className="btn primary">
                        Back to plans
                    </Link>
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com?subject=Trouble%20verifying%20my%20email"
                        className="text-sm underline underline-offset-4"
                        style={{ color: "var(--fg-2)" }}
                    >
                        Having trouble?
                    </a>
                </div>
            </div>
        </main>
    );
}
