import Script from "next/script";
import { GOOGLE_ADS_TAG_ID } from "@/app/data/google-ads";

/**
 * Loads Google's global site tag (gtag.js) for the Ads account, and nothing else.
 *
 * Renders null until `GOOGLE_ADS_TAG_ID` is set (see `app/data/google-ads.ts`), so today it
 * loads no third-party script at all. Used on /contact/thank-you, where the conversion fires; it
 * can be moved to the root layout later if the Ads account also wants remarketing across the site.
 */
export default function GoogleAdsScript() {
  if (!GOOGLE_ADS_TAG_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_TAG_ID}');`}
      </Script>
    </>
  );
}
