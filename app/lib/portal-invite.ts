import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Portal access for a client who was closed on a call and has never signed in.
 *
 * **Invitation only. No temporary passwords, ever, for real clients** (orchestrator decision,
 * 2026-11-03). Nothing here — or anywhere on this path — generates, sets, stores, logs or emails
 * a password. The client creates their own password when they accept the invitation: the ticket
 * verifies their email, and a password is the one thing sign-up still asks for (dev also offers
 * Google there; production has no social sign-in). The link goes inside our own welcome email
 * (`notify: false`), so the client gets one email, not two.
 *
 * Accepting creates a Clerk user with a *verified* email, which is exactly what the portal
 * already keys on: `resolveAccountForUser` finds the email-keyed account fulfilment wrote, and
 * links it. No new linking path exists for this flow.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://juneaudigitaldesigns.com";

export type PortalInvite =
    | { kind: "invitation"; invitationId: string; url: string }
    | { kind: "existing-login" };

/**
 * Where a Clerk invitation sends the client: the sign-up page, which creates their login from the
 * invitation ticket, and then on to this site's onboarding form.
 *
 * It used to point straight at `/portal/onboarding`. That route is protected and an invitee has
 * no session yet, so the middleware bounced them to sign-in with the ticket buried in
 * `redirect_url`, and sign-in said it couldn't find an account. No phone-closed client could ever
 * have created a login (test run, 2026-11-08).
 */
export function invitationRedirect(siteSlug: string): string {
    const onboarding = `/portal/onboarding?site=${encodeURIComponent(siteSlug)}`;
    return `${SITE_URL}/portal/sign-up?redirect_url=${encodeURIComponent(onboarding)}`;
}

/**
 * Invite `email`, unless a Clerk user already has it — a returning client who already signs in
 * gets no invite; their new site appears on the login they have.
 */
export async function invitePortalUser(email: string, siteSlug: string): Promise<PortalInvite> {
    const client = await clerkClient();
    const existing = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    if (existing.data.length > 0) return { kind: "existing-login" };

    const invitation = await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: invitationRedirect(siteSlug),
        notify: false,
        ignoreExisting: true,
    });
    if (!invitation.url) throw new Error("Clerk returned an invitation without a URL");
    return { kind: "invitation", invitationId: invitation.id, url: invitation.url };
}

/**
 * The one recovery path for a lost or expired link: revoke the open invitation and issue a new
 * one. It replaces any temptation to email a password.
 */
export async function resendPortalInvite(
    email: string,
    siteSlug: string,
    previousInvitationId: string | undefined,
): Promise<PortalInvite> {
    const client = await clerkClient();
    if (previousInvitationId) {
        // Already accepted or revoked is fine; the point is that only the newest link works.
        await client.invitations.revokeInvitation(previousInvitationId).catch((e) => {
            console.warn("[portal-invite] revoke failed (continuing)", previousInvitationId, e);
        });
    }
    return invitePortalUser(email, siteSlug);
}
