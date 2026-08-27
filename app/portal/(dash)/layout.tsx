import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PortalChrome from "@/app/components/portal/PortalChrome";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import PortalScope from "@/app/components/portal/PortalScope";
import { resolveDashboard } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

/**
 * The authenticated dashboard shell.
 *
 * Account resolution moved up here from the old single-page dashboard, so it runs once per
 * navigation rather than once per tab switch, and every view beneath it is linkable.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in");

    // Read here rather than in the client component so the rail's width is correct in the
    // server HTML. Held in localStorage it would paint 232px and snap to 64px after
    // hydration on every single load. This layout is already `force-dynamic`, so a cookie
    // read costs nothing it wasn't already paying.
    const railCollapsed = (await cookies()).get("portal_rail")?.value === "collapsed";

    const ctx = await resolveDashboard();

    // Authenticated but nothing to show → terminal page. Never redirect to sign-in here:
    // Clerk bounces signed-in users off sign-in back to /portal, which loops forever.
    if (!ctx) {
        return (
            <PortalScope>
                <PortalNoAccess />
            </PortalScope>
        );
    }

    const { account, sites } = ctx;

    // The "this client still owes us a wizard" decision deliberately does NOT live here.
    //
    // It used to, as `account.sites[0]?.status === "pending-onboarding"`, which only ever
    // asked about the *first* site. An existing client's live site sits at index 0, so a
    // second site they had just paid for never triggered anything: they were dropped into
    // their old portal with no sign the purchase had happened at all.
    //
    // Testing `.some()` here instead would be worse — it would lock a client out of a working
    // live site until they finished onboarding an unrelated new one. The question is
    // per-site, so it belongs on the page that knows which site is selected. See
    // `(dash)/page.tsx`. A layout also cannot read the pathname, so a redirect issued here
    // would loop the moment the wizard lived beneath it.

    // A client whose only site is still building used to get a standalone holding page
    // instead of the shell, on the reasoning that there was no dashboard to frame. There is
    // now: the Overview shows real build progress driven by live deployment and domain
    // state, and the rail gives them Billing and Settings, which work during a build. So
    // everyone with an account gets the same shell.

    // Layouts don't receive searchParams, and the nav is a client component anyway — so
    // PortalChrome reads `?site=` itself. That also keeps the header in sync the instant a
    // client-side navigation changes it, without a server round trip.
    return (
        <PortalScope>
            <PortalChrome
                sites={sites}
                accountEmail={account.email}
                railCollapsed={railCollapsed}
            >
                {children}
            </PortalChrome>
        </PortalScope>
    );
}
