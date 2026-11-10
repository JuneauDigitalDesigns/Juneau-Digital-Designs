import { SignIn } from "@clerk/nextjs";
import { safeRedirectPath } from "@/app/lib/safe-redirect";
import { postAuthRedirect } from "@/app/lib/post-auth-redirect";
import { clerkAuthAppearance } from "../../clerkAppearance";
import AuthShell from "../_auth/AuthShell";

export default async function PortalSignInPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
    // A returning client buying another site arrives here rather than at sign-up, and has to
    // land back on `/start?plan=X` to finish. See the sign-up page for why this is validated
    // and why it has to be `forceRedirectUrl`.
    const redirectUrl = safeRedirectPath((await searchParams).redirect_url);

    // Agency brand, not `<PortalScope>`: see AuthShell. The card's title and subtitle come from
    // `clerkLocalization` on the provider in app/portal/layout.tsx.
    return (
        <AuthShell>
            <SignIn
                path="/portal/sign-in"
                routing="path"
                signUpUrl={`/portal/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
                forceRedirectUrl={postAuthRedirect(redirectUrl)}
                appearance={clerkAuthAppearance}
            />
        </AuthShell>
    );
}
