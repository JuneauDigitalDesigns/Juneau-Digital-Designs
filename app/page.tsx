import HomePageClient from "./components/home/homepageclient";
import { getPublishedFeaturedSites } from "./lib/cancel-kv";
import type { PublishedFeaturedSite } from "./lib/cancel-kv";

export type { PublishedFeaturedSite };

export default async function Home() {
    const featuredSites = await getPublishedFeaturedSites();
    return <HomePageClient featuredSites={featuredSites} />;
}
