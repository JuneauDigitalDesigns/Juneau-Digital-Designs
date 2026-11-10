import { SignUp } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import InviteOtherAccount from "@/app/components/portal/InviteOtherAccount";
import { inviteNeedsSignOut, inviteReturnPath } from "@/app/lib/invite-return.mjs";
import { safeRedirectPath } from "@/app/lib/safe-redirect";
import { postAuthRedirect } from "@/app/lib/post-auth-redirect";
import { clerkAuthAppearance } from "../../clerkAppearance";
import AuthShell from "../../sign-in/_auth/AuthShell";

export default async function PortalSignUpPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect_url?: string | string[]; __clerk_ticket?: string | string[]; __clerk_status?: string | string[] }>;
}) {
    const params = await searchParams;
    const { userId } = await auth();
    if (inviteNeedsSignOut(userId, params.__clerk_ticket)) {
        const user = await currentUser();
        return (
            <AuthShell>
                <InviteOtherAccount email={user?.primaryEmailAddress?.emailAddress ?? null} returnPath={inviteReturnPath(params)} />
            </AuthShell>
        );
    }

    /**
     * Honour where the visitor was actually headed.
     *
     * `forceRedirectUrl` was hardcoded to "/portal", and in Clerk that outranks the
     * `redirect_url` query param — so once the purchase gate started routing buyers through
     * here, every one of them would have been dropped on the dashboard with the plan they
     * had just chosen silently discarded. Validated rather than passed straight through:
     * a query param that decides where the browser goes next is an open redirect otherwise.
     */
    const redirectUrl = safeRedirectPath(params.redirect_url);

    // Agency brand, not `<PortalScope>`: see AuthShell. Same page as sign-in, so a client who
    // follows "Sign up" from the sign-in card stays in the same place.
    //
    // The card keeps Clerk's own title: no sign-up string has been approved yet. The explainer
    // that used to sit beside the card ("Create your portal login" and two bullets) is replaced
    // by the shared brand panel, whose wording is approved.
    return (
        <AuthShell>
            <SignUp
                path="/portal/sign-up"
                routing="path"
                signInUrl={`/portal/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
                forceRedirectUrl={postAuthRedirect(redirectUrl)}
                appearance={clerkAuthAppearance}
            />
        </AuthShell>
    );
}
