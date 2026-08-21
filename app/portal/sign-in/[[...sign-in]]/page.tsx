import { SignIn } from "@clerk/nextjs";
import PortalScope from "@/app/components/portal/PortalScope";
import { safeRedirectPath } from "@/app/lib/safe-redirect";
import { portalClerkAppearance } from "../../clerkAppearance";

export default async function PortalSignInPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
    // A returning client buying another site arrives here rather than at sign-up, and has to
    // land back on `/start?plan=X` to finish. See the sign-up page for why this is validated
    // and why it has to be `forceRedirectUrl`.
    const redirectUrl = safeRedirectPath((await searchParams).redirect_url);

    return (
        <PortalScope>
            <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
                <SignIn
                    path="/portal/sign-in"
                    routing="path"
                    signUpUrl={`/portal/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
                    forceRedirectUrl={redirectUrl}
                    appearance={portalClerkAppearance}
                />
            </div>
        </PortalScope>
    );
}
