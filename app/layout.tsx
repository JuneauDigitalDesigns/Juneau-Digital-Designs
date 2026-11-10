import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import MarketingChrome from "./components/MarketingChrome";

/**
 * Self-hosted rather than fetched from Google at build time.
 *
 * As `Big_Shoulders` from next/font/google this broke the build non-deterministically — the
 * same commit built at 16:13 and failed at 18:40 on 2026-11-02 with:
 *
 *   Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
 *   next/font/google queries have exactly one entry
 *
 * Three occurrences in one day, on two machines, plus a standing
 * "Failed to find font override values for font `Big Shoulders`" warning in dev — Next's font
 * metadata has no metrics for this family since Google renamed it from Big Shoulders Display.
 * A build that fails roughly half the time eventually fails unattended, and on 2026-11-02 it
 * left production serving a dead KV credential because the redeploy that carried the new one
 * errored here.
 *
 * The woff2 is the variable latin subset (weight axis 100-900), which covers the 500-900 the
 * old static-weight list requested, in one file instead of five. Vendored under the SIL Open
 * Font License, matching how CabinetGrotesk-Variable is handled below. Nothing is fetched at
 * build time now, so this font cannot fail a deploy again.
 */
const bigShoulders = localFont({
  src: "./fonts/BigShoulders-Variable.woff2",
  variable: "--font-big-shoulders",
  weight: "100 900",
  display: "swap",
});

/**
 * DM Mono, Hanken Grotesk, Inter and JetBrains Mono are self-hosted for the same reason, so
 * nothing in this app fetches a font at build time.
 *
 * As next/font/google they were the last build-time dependency on Google. On 2026-11-04 a
 * production build failed with module-not-found on the Hanken Grotesk font CSS, and a retry
 * built. That was the download itself failing. No loader fix can prevent that; only removing
 * the download can. test/self-hosted-fonts.test.mjs fails if a next/font/google import returns.
 *
 * Each file is exactly what next/font/google downloaded: the latin subset from the css2 API
 * with a Chrome user agent, fetched 2026-11-04 for the queries the old calls made
 * (DM+Mono:wght@400;500, Hanken+Grotesk:wght@400;500;600, Inter:wght@100..900,
 * JetBrains+Mono:wght@100..800). Licences are in ./fonts/LICENSES.txt (SIL OFL 1.1).
 *
 * The faces are declared the way next/font/google generated them, so rendering is unchanged:
 * - DM Mono is static, one file per weight.
 * - Hanken Grotesk is one variable file that Google listed once per requested weight. Three
 *   faces at 400/500/600 all point at that file, so a 700 still renders at 600 as before
 *   instead of becoming a weight the brand never used.
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

const hankenGrotesk = localFont({
  src: [
    { path: "./fonts/HankenGrotesk-Variable.woff2", weight: "400", style: "normal" },
    { path: "./fonts/HankenGrotesk-Variable.woff2", weight: "500", style: "normal" },
    { path: "./fonts/HankenGrotesk-Variable.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-hanken",
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

export const metadata: Metadata = {
  title: "Juneau Digital Designs LLC",
  description: "Innovative Web Design and UI/UX Solutions",
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
      className={`${bigShoulders.variable} ${dmMono.variable} ${hankenGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${cabinet.variable}`}
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
      </body>
    </html>
  );
}
