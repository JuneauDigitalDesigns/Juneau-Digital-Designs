"use client";

import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ArrowCounterClockwise, Lifebuoy } from "@phosphor-icons/react";
import { tabHref } from "@/app/portal/types";
import { launchTour } from "./tour/TourController";

/**
 * The account menu in the portal chrome: Clerk's `<UserButton/>` with our two items added.
 *
 * Order is the approved ClerkMenu mockup's: Manage account, Help & support, Replay the tour,
 * Sign out. Clerk's own two items are restated as `<UserButton.Action label="manageAccount" />`
 * and `label="signOut"` so the order is ours and explicit, with Sign out last, rather than
 * whatever placement Clerk gives custom items by default.
 *
 * Styling is not here. The popover renders through a portal into <body>, outside
 * `.portal-scope`, so it is dressed by `clerkAppearance` on the provider in literal hex; see
 * app/portal/clerkAppearance.ts.
 *
 * `onLeave` exists for the mobile "More" drawer, which has to close before either item can
 * work: the tour points at the tab bar under it, and a page change does not close it. With it
 * set, Help & support becomes an action that closes the drawer and then navigates, because
 * Clerk's `UserButton.Link` takes no click handler.
 */
export default function PortalUserButton({
    siteSlug,
    onLeave,
}: {
    /** The selected site, so Help & support opens that site's support page. */
    siteSlug: string;
    onLeave?: () => void;
}) {
    const router = useRouter();
    const supportHref = tabHref("support", siteSlug);
    const helpLabel = "Help & support";
    const helpIcon = <Lifebuoy size={16} aria-hidden />;

    return (
        <UserButton>
            <UserButton.MenuItems>
                <UserButton.Action label="manageAccount" />
                {onLeave ? (
                    <UserButton.Action
                        label={helpLabel}
                        labelIcon={helpIcon}
                        onClick={() => {
                            onLeave();
                            router.push(supportHref);
                        }}
                    />
                ) : (
                    <UserButton.Link label={helpLabel} href={supportHref} labelIcon={helpIcon} />
                )}
                <UserButton.Action
                    label="Replay the tour"
                    labelIcon={<ArrowCounterClockwise size={16} aria-hidden />}
                    onClick={() => {
                        onLeave?.();
                        launchTour();
                    }}
                />
                <UserButton.Action label="signOut" />
            </UserButton.MenuItems>
        </UserButton>
    );
}
