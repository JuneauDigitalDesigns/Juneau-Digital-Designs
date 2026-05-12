import type { Metadata } from "next";
import PricingPageClient from "../components/pricing/pricingpageclient";

export const metadata: Metadata = {
    title: "Pricing | Juneau Digital Designs",
    description: "Simple, transparent monthly pricing for web design and digital support.",
};

export default function PricingPage() {
    return <PricingPageClient />;
}
