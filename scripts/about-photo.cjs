/*
 * Rebuilds the eight files behind the /about hero photo from Xander's original.
 *
 *   node scripts/about-photo.cjs <path-to-original.jpg>
 *
 * Kept so the variants can be regenerated from the same source if the slot sizes change,
 * rather than being eight files in `public/` whose provenance nobody can reconstruct. The
 * original is not in the repo: it lives wherever Xander keeps it.
 *
 * Crop and scale only — no filter, no retouching, no AI alteration. sharp drops metadata by
 * default, which also strips any GPS tag the camera wrote.
 *
 * The two crops are a decision, not a default (Xander, 19 Nov 2026): "the portrait looks
 * better on larger screens, but the frame as a shot looks better on mobile". The breakpoint
 * that picks between them lives in `app/about/page.tsx`, and 801px is where `.about-hero`
 * stops being two columns.
 *
 *   portrait  4:5, shown from 801px up, rendered 336 CSS px wide
 *   square    the frame as shot, shown to 800px, rendered 300 CSS px wide
 *
 * Each at 1x and 2x, in AVIF and WebP, so a browser downloads exactly one file.
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = process.argv[2];
const OUT = path.join(__dirname, "..", "public", "about");

const VARIANTS = [
    { name: "portrait", widths: [340, 680], ratio: 0.8 },
    { name: "square", widths: [300, 600], ratio: null },
];

if (!SRC || !fs.existsSync(SRC)) {
    console.error("Usage: node scripts/about-photo.cjs <path-to-original.jpg>");
    process.exit(1);
}

(async () => {
    const meta = await sharp(SRC).metadata();
    console.log(`source ${meta.width}x${meta.height} ${meta.format} ${Math.round(fs.statSync(SRC).size / 1024)}KB`);
    fs.mkdirSync(OUT, { recursive: true });
    const rows = [];

    for (const v of VARIANTS) {
        for (const w of v.widths) {
            let pipe = sharp(SRC);
            if (v.ratio) {
                // Right-aligned crop: his face sits in the right of the frame, so trimming from
                // the left keeps him whole and leaves the brick and handrail behind him.
                const keepW = Math.round(meta.height * v.ratio);
                pipe = pipe
                    .extract({ left: meta.width - keepW, top: 0, width: keepW, height: meta.height })
                    .resize(w, Math.round(w / v.ratio), { fit: "cover" });
            } else {
                pipe = pipe.resize(w, null);
            }
            for (const [fmt, opts] of [["avif", { quality: 58 }], ["webp", { quality: 80 }]]) {
                const file = `about-xander-${v.name}-${w}.${fmt}`;
                const p = path.join(OUT, file);
                await pipe.clone()[fmt](opts).toFile(p);
                const m = await sharp(p).metadata();
                rows.push({ file, size: `${m.width}x${m.height}`, kb: +(fs.statSync(p).size / 1024).toFixed(1) });
            }
        }
    }
    console.table(rows);
})();
