import { SignUp } from "@clerk/nextjs";
import PortalScope from "@/app/components/portal/PortalScope";
import { portalClerkAppearance } from "../../clerkAppearance";

export default function PortalSignUpPage() {
    return (
        <PortalScope>
            <div
                className="min-h-screen flex items-center justify-center p-6"
                style={{ background: "var(--bg)" }}
            >
                <div className="grid w-full max-w-5xl gap-10 md:grid-cols-2 md:items-center">
                    {/* Why we're asking them to create an account */}
                    <div className="max-w-md">
                        <span className="eyebrow">Client Portal</span>
                        <h1
                            className="mt-4"
                            style={{ fontSize: "var(--text-2xl)", color: "var(--fg)" }}
                        >
                            Create your portal login
                        </h1>
                        <p
                            className="mt-3"
                            style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}
                        >
                            Your portal is the private home base for your website. Setting up a login
                            gives you a place to check in on it any time.
                        </p>
                        <ul className="mt-6 flex flex-col gap-4">
                            <li className="flex gap-3">
                                <span aria-hidden style={{ color: "var(--accent-2)" }}>—</span>
                                <span style={{ color: "var(--fg-2)" }}>
                                    <strong style={{ color: "var(--fg)" }}>Track performance &amp; traffic</strong>
                                    {" "}— see how your site is doing at a glance.
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span aria-hidden style={{ color: "var(--accent-2)" }}>—</span>
                                <span style={{ color: "var(--fg-2)" }}>
                                    <strong style={{ color: "var(--fg)" }}>Growth plan: AI call logs</strong>
                                    {" "}— review every call your assistant handles.
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Clerk sign-up card */}
                    <div className="flex justify-center md:justify-end">
                        <SignUp
                            path="/portal/sign-up"
                            routing="path"
                            signInUrl="/portal/sign-in"
                            forceRedirectUrl="/portal"
                            appearance={portalClerkAppearance}
                        />
                    </div>
                </div>
            </div>
        </PortalScope>
    );
}
