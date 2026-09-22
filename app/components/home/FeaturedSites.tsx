"use client";
import Image from "next/image";
import type { PublishedFeaturedSite } from "@/app/page";

/**
 * Client work, shown only once a client has said we can.
 *
 * Renders nothing while the list is empty. An empty "Live client sites" heading over a blank
 * row is worse than no section at all, and padding it with stock screenshots would
 * undercut the one thing this section exists to prove.
 *
 * Data flows from app/page.tsx (server) → HomePageClient → here, so the read is
 * server-side and this component stays a thin renderer. Consent is already baked into each
 * record (see PublishedFeaturedSite): a card is a link only when it carries a `url`, and
 * shows the business name only when it carries `businessName`. An anonymous listing has
 * neither, so there is nothing here to leak — the "Anonymous" label is drawn from the
 * absence of a name, not from a flag we could forget to check.
 *
 * Each card is an overlay: the live screenshot is the background, a bottom-anchored scrim
 * carries the quote, the name sits up top with a link arrow, and the whole card opens the
 * client's site. On hover (credited cards only) the screenshot zooms and the quote
 * crossfades into a "Visit site" cue — the motion lives in globals.css, since :hover can't
 * be expressed inline.
 */

/* Each card takes the next accent in the cycle so neighbours read as distinct. Teal and
   coral are agency tokens; the third is a warm amber literal rather than the ink token,
   because ink is invisible against the dark scrim these accents now sit on. Applied to the
   top edge, the ↗ arrow and the quote mark, and (via `--card-accent`) the hover border. */
const ACCENTS = ["var(--accent)", "var(--accent-2)", "#e0a63a"] as const;

export default function FeaturedSites({ sites }: { sites: PublishedFeaturedSite[] }) {
  if (sites.length === 0) return null;

  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      <div className="kicker" style={{ marginBottom: 14 }}>Live client sites</div>
      {/* "Real sites, real clients": in its new slot this section is evidence for the
          argument above it, and what makes it evidence is that these are live and someone
          else's, not that we operate them. */}
      <h2 style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", letterSpacing: ".01em", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
        Real sites, real clients.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 380px))", gap: 20 }}>
        {sites.map((site, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const credited = Boolean(site.url);
          const hasQuote = Boolean(site.quote);

          /* Dual scrim: a light wash under the top-placed name, and a heavier bottom rise
             carrying the quote. A card with no quote leans lighter so more screenshot shows. */
          const scrim = hasQuote
            ? "linear-gradient(to top, rgba(0,0,0,.86) 0%, rgba(0,0,0,.5) 32%, rgba(0,0,0,0) 64%), linear-gradient(to bottom, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 22%)"
            : "linear-gradient(to top, rgba(0,0,0,.6) 0%, rgba(0,0,0,.24) 34%, rgba(0,0,0,0) 66%), linear-gradient(to bottom, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 22%)";

          const inner = (
            <>
              <div className="featured-media" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                <Image
                  src={site.image}
                  alt={site.businessName ? `${site.businessName} website` : "Featured client site"}
                  fill
                  style={{ objectFit: "cover", objectPosition: "top" }}
                  sizes="(max-width: 700px) 100vw, 380px"
                />
              </div>

              {/* top accent edge */}
              <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, zIndex: 3 }} />

              {/* scrim */}
              <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 1, background: scrim }} />

              {/* content */}
              <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px 18px 18px", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: site.businessName ? 700 : 600, fontSize: site.businessName ? 17 : 15, letterSpacing: ".01em", color: site.businessName ? "rgba(255,255,255,.97)" : "rgba(255,255,255,.62)", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
                    {site.businessName ?? "Anonymous"}
                  </span>
                  {credited && (
                    <span aria-hidden style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15, color: accent, lineHeight: 1 }}>
                      ↗
                    </span>
                  )}
                </div>

                <div className="featured-foot" style={{ position: "relative" }}>
                  {hasQuote && (
                    <p className="featured-quote" style={{ margin: 0, color: "rgba(255,255,255,.93)", fontSize: 14.5, lineHeight: 1.5, textShadow: "0 1px 3px rgba(0,0,0,.55)" }}>
                      <span aria-hidden style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: accent, fontSize: 22, lineHeight: 0, position: "relative", top: 6, marginRight: 3 }}>
                        &ldquo;
                      </span>
                      {site.quote}
                    </p>
                  )}
                  {credited && (
                    <span
                      className={hasQuote ? "featured-visit" : "featured-visit-static"}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, letterSpacing: ".05em", color: "rgba(255,255,255,.96)", textShadow: "0 1px 3px rgba(0,0,0,.55)", whiteSpace: "nowrap" }}
                    >
                      Visit site →
                    </span>
                  )}
                </div>
              </div>
            </>
          );

          const cardStyle = {
            position: "relative",
            display: "block",
            aspectRatio: "4 / 5",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--surface)",
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
              aria-label={`Visit ${site.businessName ?? "this client site"} (opens in a new tab)`}
              className="featured-card featured-card--link"
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
