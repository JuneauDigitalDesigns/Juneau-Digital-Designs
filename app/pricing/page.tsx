import type { Metadata } from "next";
import PricingPageClient from "../components/pricing/pricingpageclient";
import JsonLd from "../components/JsonLd";
import { PRICING_DESCRIPTION, pageMetadata, plansJsonLd } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/pricing", "Pricing | Juneau Digital Designs", PRICING_DESCRIPTION);

export default function PricingPage() {
    return (
        <>
            <JsonLd data={plansJsonLd()} />
            <PricingPageClient />
        </>
    );
}
