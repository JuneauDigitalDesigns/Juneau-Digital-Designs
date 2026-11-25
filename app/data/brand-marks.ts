/**
 * The agency's own two brand marks, transparent, as Xander supplied them (24 Nov 2026).
 *
 * They replace `/JDD_mark.webp`, an old lockup with a cream box baked into it. Since 25 Nov 2026
 * the nav shows the monogram alone, 40px tall, at every width, and the footer shows the wordmark
 * alone, 64px (Xander). The earlier monogram | hairline | wordmark nav came from the mockup
 * https://claude.ai/artifact/Tv1x1gqfbNr9RAMx6hxPyh.
 *
 * `width`/`height` are each file's own pixel size, so next/image reserves the right shape before
 * the picture loads. The rendered size is set in CSS (`.nav-brand-*`, `.footer-brand`).
 */
export const MONOGRAM = { src: "/monogram.webp", width: 3200, height: 1684 } as const;
export const WORDMARK = { src: "/wordmark.webp", width: 4800, height: 773 } as const;
