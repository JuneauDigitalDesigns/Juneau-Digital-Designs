import type { Metadata } from "next";
import PricingPageClient from "../components/pricing/pricingpageclient";

export const metadata: Metadata = {
    title: "Pricing | Juneau Digital Designs",
    description: "Monthly pricing for a website, a 24/7 AI receptionist, and a portal where every lead lands. Month to month, no contract.",
};

export default function PricingPage() {
    return <PricingPageClient />;
}
