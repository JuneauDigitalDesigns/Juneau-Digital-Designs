import type { Metadata } from "next";
import PricingPageClient from "../components/pricing/pricingpageclient";
import JsonLd from "../components/JsonLd";
import { PRICING_DESCRIPTION, pageMetadata, plansJsonLd } from "@/app/lib/site-seo";
import { ownerLeadAlertsEnabled } from "@/app/lib/owner-text-campaign";

export const metadata: Metadata = pageMetadata("/pricing", "Pricing | Juneau Digital Designs", PRICING_DESCRIPTION);

export default function PricingPage() {
    /* The new-lead text is promised only while the campaign that sends it is live
       (OWNER_TEXT_CAMPAIGN=v2). The page is static, so it reads the switch at build time:
       flipping the campaign takes a redeploy to reach this card, as it does for the Terms. */
    return (
        <>
            <JsonLd data={plansJsonLd()} />
            <PricingPageClient leadTextsLive={ownerLeadAlertsEnabled()} />
        </>
    );
}
