import type { Metadata } from "next";
import { Big_Shoulders, DM_Mono, Hanken_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import MarketingChrome from "./components/MarketingChrome";
import ThemeProvider from "./components/theme/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* Portal-only faces. The three above dress the marketing brand; these three dress the
   product UI inside `.portal-scope` and are referenced nowhere else.

   No `weight` array on the Google two: both are variable fonts, and naming weights opts
   into static instances — three separate files instead of one axis.

   `preload: false` on all three because they are portal-only. Preloading is per-document,
   so leaving it on would push these onto every marketing page for visitors who will never
   see the portal. The trade is a brief FOUT on the first portal paint, which is the right
   side of that bargain. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
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
      suppressHydrationWarning
      className={`${bigShoulders.variable} ${dmMono.variable} ${hankenGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${cabinet.variable}`}
    >
      {/* No `overflow-x-hidden` here: setting overflow on one axis makes the other
          compute as `auto`, which turns <body> into a scroll container and silently
          breaks every `position: sticky` inside it. `html { overflow-x: hidden }` in
          globals.css does the clipping without that side effect. */}
      <body className="antialiased">
        <ThemeProvider>
          {/* The grain overlay used to sit here. It is `position: fixed`, so it painted
              over the portal too — MarketingChrome now owns it and keeps it off the
              product routes while leaving it on /portal/onboarding. */}
          <MarketingChrome>{children}</MarketingChrome>
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
