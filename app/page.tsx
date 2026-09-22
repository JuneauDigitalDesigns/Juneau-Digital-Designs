import HomePageClient from "./components/home/homepageclient";
import { getPublishedFeaturedSites } from "./lib/cancel-kv";
import type { PublishedFeaturedSite } from "./lib/cancel-kv";

export type { PublishedFeaturedSite };

// Featured sites change a few times a month at most, and the KV read behind them was the
// only thing forcing this page to render fresh (and cost a function invocation) on every
// visitor. A week-long ISR window turns it into a page served from the edge almost all of
// the time.
export const revalidate = 604800; // 7 days

export default async function Home() {
    const featuredSites = await getPublishedFeaturedSites();
    return <HomePageClient featuredSites={featuredSites} />;
}
