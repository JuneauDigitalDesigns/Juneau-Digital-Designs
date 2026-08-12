"use client";
import Image from "next/image";
import type { PublishedFeaturedSite } from "@/app/page";

/**
 * Client work, shown only once a client has said we can.
 *
 * Renders nothing while the list is empty. An empty "Our Work" heading over a blank
 * row is worse than no section at all, and padding it with stock screenshots would
 * undercut the one thing this section exists to prove.
 *
 * Data flows from app/page.tsx (server) → HomePageClient → here, so the read is
 * server-side and this component stays a thin renderer.
 */
export default function FeaturedSites({ sites }: { sites: PublishedFeaturedSite[] }) {
  if (sites.length === 0) return null;

  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      <div className="kicker" style={{ marginBottom: 14 }}>Client work</div>
      <h2 style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", letterSpacing: ".01em", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
        Sites we run.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20 }}>
        {sites.map((site) => (
          <a
            key={site.slug}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden", background: "var(--panel)", display: "flex", flexDirection: "column", textDecoration: "none" }}
          >
            <div style={{ position: "relative", aspectRatio: "16 / 10", background: "var(--surface)" }}>
              <Image src={site.image} alt={`${site.businessName} website`} fill style={{ objectFit: "cover", objectPosition: "top" }} sizes="(max-width: 700px) 100vw, 33vw" />
            </div>
            <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)" }}>
                {site.trade}
              </div>
              <div style={{ fontWeight: 700, fontSize: 19, color: "var(--fg)" }}>{site.businessName}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
