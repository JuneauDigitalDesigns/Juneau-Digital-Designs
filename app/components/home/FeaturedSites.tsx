"use client";
import Image from "next/image";
import type { PublishedFeaturedSite } from "@/app/page";

/**
 * Client work, shown only once a client has said we can.
 *
 * Renders nothing while the list is empty. An empty "Client work" heading over a blank
 * row is worse than no section at all, and padding it with stock screenshots would
 * undercut the one thing this section exists to prove.
 *
 * Data flows from app/page.tsx (server) → HomePageClient → here, so the read is
 * server-side and this component stays a thin renderer. Consent is already baked into each
 * record (see PublishedFeaturedSite): a card is a link only when it carries a `url`, and
 * shows the business name only when it carries `businessName`. An anonymous listing has
 * neither, so there is nothing here to leak — the "Anonymous" label is drawn from the
 * absence of a name, not from a flag we could forget to check.
 */

/* Each card takes the next accent in the cycle so neighbours read as distinct. All three
   are agency tokens — teal, coral, then ink — applied to the quote mark, the top edge and
   (via `--card-accent`) the hover border. */
const ACCENTS = ["var(--accent)", "var(--accent-2)", "var(--fg)"] as const;

export default function FeaturedSites({ sites }: { sites: PublishedFeaturedSite[] }) {
  if (sites.length === 0) return null;

  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      <div className="kicker" style={{ marginBottom: 14 }}>Client work</div>
      {/* "In the wild", not "Sites we run": in its new slot this section is evidence for
          the argument above it, and what makes it evidence is that these are live and
          someone else's, not that we operate them. */}
      <h2 style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", letterSpacing: ".01em", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
        In the wild.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20 }}>
        {sites.map((site, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const credited = Boolean(site.url);

          const inner = (
            <>
              <div style={{ position: "relative", aspectRatio: "16 / 10", background: "var(--surface)", borderTop: `3px solid ${accent}` }}>
                <Image
                  src={site.image}
                  alt={site.businessName ? `${site.businessName} website` : "Featured client site"}
                  fill
                  style={{ objectFit: "cover", objectPosition: "top" }}
                  sizes="(max-width: 700px) 100vw, 33vw"
                />
              </div>
              <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 19, color: site.businessName ? "var(--fg)" : "var(--fg-3)" }}>
                    {site.businessName ?? "Anonymous"}
                  </span>
                  {credited && (
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: accent, whiteSpace: "nowrap" }}>
                      Visit ↗
                    </span>
                  )}
                </div>
                {site.quote && (
                  <p style={{ margin: "2px 0 0", paddingTop: 12, borderTop: "1px solid var(--rule-weak, rgba(20,18,12,.09))", color: "var(--fg-2)", fontSize: 14, lineHeight: 1.5 }}>
                    <span aria-hidden style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: accent, fontSize: 20, lineHeight: 0, position: "relative", top: 5, marginRight: 2 }}>
                      &ldquo;
                    </span>
                    {site.quote}
                  </p>
                )}
              </div>
            </>
          );

          const cardStyle = {
            border: "1px solid var(--rule)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--panel)",
            display: "flex",
            flexDirection: "column",
            textDecoration: "none",
            color: "inherit",
            ["--card-accent"]: accent,
          } as React.CSSProperties;

          return credited ? (
            <a
              key={site.slug}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="featured-card"
              style={cardStyle}
            >
              {inner}
            </a>
          ) : (
            <div key={site.slug} className="featured-card" style={cardStyle}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
