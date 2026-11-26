import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import MarketingChrome from "./components/MarketingChrome";
import SiteAnalytics from "./components/SiteAnalytics";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_URL } from "./lib/site-seo";

/**
 * Plus Jakarta Sans, the face the wordmark is drawn in (brand/logo/build_marks.py outlines it at
 * 800 and 650), sets the marketing site's headings and body text since 2026-11-26 (Xander picked
 * pairing A, "Plus Jakarta Sans + DM Mono", from https://claude.ai/artifact/TCkeUrBBb8MdxynpRD4x9D).
 * It replaced Big Shoulders (display) and Hanken Grotesk (body); DM Mono keeps the labels.
 *
 * Self-hosted, never next/font/google: on 2026-11-02 and 2026-11-04 the Google download failed
 * production builds (test/self-hosted-fonts.test.mjs). The woff2 is the variable font, weight
 * axis 200-800, v2.071 from github.com/tokotype/PlusJakartaSans, subset to Google's latin range
 * (33 KB). There is no 900: a 900 renders at 800. SIL OFL 1.1, in ./fonts/LICENSES.txt.
 */
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

/**
 * DM Mono, Inter and JetBrains Mono are self-hosted for the same reason, so
 * nothing in this app fetches a font at build time.
 *
 * As next/font/google they were the last build-time dependency on Google. On 2026-11-04 a
 * production build failed with module-not-found on the Hanken Grotesk font CSS, and a retry
 * built. That was the download itself failing. No loader fix can prevent that; only removing
 * the download can. test/self-hosted-fonts.test.mjs fails if a next/font/google import returns.
 *
 * Each file is exactly what next/font/google downloaded: the latin subset from the css2 API
 * with a Chrome user agent, fetched 2026-11-04 for the queries the old calls made
 * (DM+Mono:wght@400;500, Inter:wght@100..900,
 * JetBrains+Mono:wght@100..800). Licences are in ./fonts/LICENSES.txt (SIL OFL 1.1).
 *
 * The faces are declared the way next/font/google generated them, so rendering is unchanged:
 * - DM Mono is static, one file per weight.
 * - Inter and JetBrains Mono were requested as the whole axis, so each is one face with a
 *   weight range.
 */
const dmMono = localFont({
  src: [
    { path: "./fonts/DMMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/DMMono-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono",
  display: "swap",
});

/* Portal-only faces. The three above dress the marketing brand; these three dress the
   product UI inside `.portal-scope` and are referenced nowhere else.

   Inter and JetBrains Mono are variable fonts, loaded as one file each over the whole
   weight axis rather than as static instances per weight.

   `preload: false` on all three because they are portal-only. Preloading is per-document,
   so leaving it on would push these onto every marketing page for visitors who will never
   see the portal. The trade is a brief FOUT on the first portal paint, which is the right
   side of that bargain. */
const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
  preload: false,
});

const cabinet = localFont({
  src: "./fonts/CabinetGrotesk-Variable.woff2",
  variable: "--font-cabinet",
  weight: "300 900",
  display: "swap",
  preload: false,
});

/**
 * Site-wide defaults. `metadataBase` turns every page's relative canonical and preview-image
 * path into a full www address. The title and description are the homepage's, so a page that
 * sets none of its own (a 404, for one) no longer shows the old "Innovative Web Design and
 * UI/UX Solutions". Public pages set their own through `pageMetadata` in `app/lib/site-seo.ts`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
};

/**
 * `viewportFit: "cover"` is the switch that makes `env(safe-area-inset-*)` return real
 * numbers. Without it those values are 0 on every device and the CSS that reads them looks
 * correct while doing nothing — the portal's bottom tab bar would sit under the iPhone home
 * indicator and its last row would be untappable.
 *
 * Next injects `width=device-width, initial-scale=1` by default, so this replaces that
 * default and must restate both. It also means the page now extends under the notch, which
 * is why the tab bar and the bottom sheet pad themselves rather than relying on the browser.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /* The font variables MUST live on <html>, not <body>: globals.css declares
     --font-display/-body/-mono on :root, and a custom property resolves using
     the variables available where it is declared. On <body> they were invisible
     to :root, so --font-display computed to nothing and every
     `font-family: var(--font-display)` on the site silently fell back to system
     sans — the webfonts loaded but were never applied. */
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${dmMono.variable} ${inter.variable} ${jetbrainsMono.variable} ${cabinet.variable}`}
    >
      {/* No `overflow-x-hidden` here: setting overflow on one axis makes the other
          compute as `auto`, which turns <body> into a scroll container and silently
          breaks every `position: sticky` inside it. `html { overflow-x: hidden }` in
          globals.css does the clipping without that side effect. */}
      <body className="antialiased">
          {/* The grain overlay used to sit here. It is `position: fixed`, so it painted
              over the portal too — MarketingChrome now owns it and keeps it off the
              product routes while leaving it on /portal/onboarding. */}
          <MarketingChrome>{children}</MarketingChrome>
          {/* Vercel Web Analytics. Off on the portal and private links; see SiteAnalytics. */}
          <SiteAnalytics />
      </body>
    </html>
  );
}
