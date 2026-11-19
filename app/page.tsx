import type { Metadata } from "next";
import HomePageClient from "./components/home/homepageclient";
import JsonLd from "./components/JsonLd";
import { getPublishedFeaturedSites } from "./lib/cancel-kv";
import type { PublishedFeaturedSite } from "./lib/cancel-kv";
import { HOME_DESCRIPTION, HOME_TITLE, organizationJsonLd, pageMetadata } from "./lib/site-seo";

export type { PublishedFeaturedSite };

export const metadata: Metadata = pageMetadata("/", HOME_TITLE, HOME_DESCRIPTION);

// Featured sites change a few times a month at most, and the KV read behind them was the
// only thing forcing this page to render fresh (and cost a function invocation) on every
// visitor. A week-long ISR window turns it into a page served from the edge almost all of
// the time.
export const revalidate = 604800; // 7 days

export default async function Home() {
    const featuredSites = await getPublishedFeaturedSites();
    return (
        <>
            <JsonLd data={organizationJsonLd()} />
            <HomePageClient featuredSites={featuredSites} />
        </>
    );
}
