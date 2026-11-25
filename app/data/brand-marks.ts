/**
 * The agency's own two brand marks, transparent, as Xander supplied them (24 Nov 2026).
 *
 * They replace `/JDD_mark.webp`, an old lockup with a cream box baked into it. The nav shows
 * monogram | hairline | wordmark, with the hairline drawn in markup; below 640px it shows the
 * wordmark alone. The footer shows the wordmark alone. Approved from the mockup
 * https://claude.ai/artifact/Tv1x1gqfbNr9RAMx6hxPyh: dark hairline; monogram 30px and wordmark
 * 44px tall in the nav, the wordmark 40px on a phone and 64px in the footer.
 *
 * `width`/`height` are each file's own pixel size, so next/image reserves the right shape before
 * the picture loads. The rendered size is set in CSS (`.nav-brand-*`, `.footer-brand`).
 */
export const MONOGRAM = { src: "/monogram.webp", width: 3200, height: 1684 } as const;
export const WORDMARK = { src: "/wordmark.webp", width: 4800, height: 773 } as const;
/** Juneau over Digital Designs: the nav's wordmark from 1040px to 1219px only (Xander's option B). */
export const WORDMARK_STACKED = { src: "/wordmark-stacked.png", width: 4800, height: 2100 } as const;
