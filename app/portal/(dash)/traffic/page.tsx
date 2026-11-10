import { redirect } from "next/navigation";
import { legacyTabDestination } from "@/app/portal/types";

export const dynamic = "force-dynamic";

/**
 * Traffic is now the top of Analytics. This path stays so bookmarks, emails and any link that
 * has not caught up still land somewhere, with `?site=` and every other parameter intact.
 */
export default async function TrafficPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    redirect(legacyTabDestination("traffic", await searchParams));
}
