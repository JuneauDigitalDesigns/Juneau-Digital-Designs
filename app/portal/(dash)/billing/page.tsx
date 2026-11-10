import { redirect } from "next/navigation";
import { legacyTabDestination } from "@/app/portal/types";

export const dynamic = "force-dynamic";

/**
 * Billing moved inside Settings as "Plan & billing". This path stays as a redirect: it is in
 * old emails and bookmarks, and the downgrade flow used to finish here.
 */
export default async function BillingPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    redirect(legacyTabDestination("billing", await searchParams));
}
