import { redirect } from "next/navigation";
import { legacyTabDestination } from "@/app/portal/types";

export const dynamic = "force-dynamic";

/**
 * Performance is now the Speed section of Analytics. Kept as a redirect, landing on that
 * section, so old links and bookmarks keep working.
 */
export default async function PerformancePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    redirect(legacyTabDestination("performance", await searchParams));
}
