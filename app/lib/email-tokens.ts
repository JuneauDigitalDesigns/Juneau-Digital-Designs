/**
 * Brand tokens for transactional email, mirroring the light-theme `:root`
 * values in app/globals.css.
 *
 * These are hardcoded on purpose: mail clients don't support `var()`, and the
 * emails are server-rendered strings that never load globals.css. Keeping every
 * value here — with the source variable named alongside it — means a brand
 * change is a single-file edit and the mapping stays auditable.
 *
 * Light theme only. The dark-theme overrides have no meaningful email
 * equivalent (clients that force-darken do their own thing regardless).
 */
export const EMAIL = {
  canvas: "#ddd0b3", // --bg-body
  card: "#fbf5e6", // --panel
  panelInset: "#f0e6cd", // --panel-header — info blocks inside the card
  ink: "#14120c", // --fg — body text
  fg2: "#43402c", // --fg-2 — secondary copy
  fg3: "#7a715a", // --fg-3 — subtitles, muted notes
  accent: "#1f6f78", // --accent — links
  accent2: "#d2542f", // --accent-2 — header/footer chrome
  // --on-accent-2. All footer copy uses this at full strength: dimmed cream on
  // coral falls below 4.5:1, so footer hierarchy comes from size/weight, not color.
  onAccent2: "#f4ecd8",
  rule: "rgba(20,18,12,0.16)", // --rule
  ruleOnDark: "rgba(244,236,216,0.30)", // divider on the coral footer (decorative, not text)
} as const;

export const EMAIL_FONT = {
  display: "'Big Shoulders Display','Big Shoulders',Impact,system-ui,sans-serif",
  body: "'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif",
} as const;

export const EMAIL_FONT_IMPORT =
  "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;600&family=Hanken+Grotesk:wght@400;500;600&display=swap";
