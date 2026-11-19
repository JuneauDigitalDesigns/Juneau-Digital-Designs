import type { Metadata } from "next";
import GoogleAdsScript from "@/app/components/GoogleAdsScript";
import ThankYouClient from "./ThankYouClient";

/**
 * /contact/thank-you — the page the /contact form lands on, for Google Ads conversion counting.
 *
 * `noindex`, and left out of `PUBLIC_PATHS` so it never enters the sitemap: nobody should reach
 * it from a search, only from sending the form. The gtag loads here (and nowhere else yet); it
 * renders nothing until the Ads tag is configured in `app/data/google-ads.ts`.
 */
export const metadata: Metadata = {
  title: "Thank you | Juneau Digital Designs",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <>
      <GoogleAdsScript />
      <ThankYouClient />
    </>
  );
}
