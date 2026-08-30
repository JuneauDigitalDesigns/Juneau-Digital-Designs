import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Featured-site screenshots, published to Vercel Blob by the console's
        // /manage → Featured tooling. Same host the onboarding upload route validates
        // against (app/api/portal/onboarding/route.ts).
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },

  /**
   * Portal responses must never be cached by anything but the client's own tab.
   *
   * Declared here rather than per-route on purpose: these responses carry caller names,
   * phone numbers, email addresses and invoice links, and a route that forgets the header
   * is exactly the kind of omission nobody notices. A `source` matcher covers every
   * existing route and every one added later.
   *
   * There was previously no Cache-Control anywhere on /api/portal/*. Nothing was
   * mis-cached — Next renders these dynamically — but that was a framework default doing
   * security-relevant work implicitly.
   *
   * Referrer-Policy is here because portal URLs carry data in the query string
   * (`?site=…&q=<caller name>`). Modern browsers default to this value; stating it means we
   * don't inherit a weaker default from an older client.
   */
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      { source: "/api/portal/:path*", headers: noStore },
      { source: "/portal/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
