/**
 * One-time script to produce public/legal/msa-v3.pdf from msa-v2.pdf.
 *
 * Patches applied:
 *  - Page 1: replaces the "Provider: Juneau Digital Designs LLC, a Florida
 *    limited liability company located at [YOUR ADDRESS], Ocoee, FL ..."
 *    paragraph with the corrected text (no LLC; real address; sole prop).
 *  - Page 11: replaces "PROVIDER: JUNEAU DIGITAL DESIGNS LLC" with
 *    "PROVIDER: JUNEAU DIGITAL DESIGNS".
 *
 * Usage:
 *   node scripts/regenerate-msa-v3.mjs
 *
 * The output (public/legal/msa-v3.pdf) is committed to the repo. Re-run this
 * script if you ever need to update those static patches.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = resolve(ROOT, "public", "legal", "msa-v2.pdf");
const OUT = resolve(ROOT, "public", "legal", "msa-v3.pdf");

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.1, 0.1, 0.1);

async function main() {
  const original = await readFile(SRC);
  const pdf = await PDFDocument.load(original);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages = pdf.getPages();

  // ── Page 1: replace Provider paragraph ──
  // Original 2-line paragraph. PDF coords (bottom-left origin, 612×792):
  //   intro "This Master..." baseline ≈ y 673
  //   line 1 "Provider: ... [YOUR" baseline ≈ y 642
  //   line 2 "ADDRESS], Ocoee, FL ..." baseline ≈ y 620
  //   "Client:" baseline ≈ y 580
  // Whiteout must cover y 615..655 without clipping the intro above.
  const p1 = pages[0];
  p1.drawRectangle({
    x: 60,
    y: 640,
    width: 490,
    height: 52,
    color: WHITE,
  });

  const line1Y = 674;
  const line2Y = 656;
  p1.drawText("Provider:", { x: 72, y: line1Y, size: 11, font: helvBold, color: BLACK });
  p1.drawText(
    " Juneau Digital Designs, a Florida sole proprietorship located at",
    { x: 122, y: line1Y, size: 11, font: helv, color: BLACK },
  );
  p1.drawText(
    '1242 Vizcaya Lake Rd, Ocoee, FL 34761 ("we," "us," or "JDD")',
    { x: 72, y: line2Y, size: 11, font: helv, color: BLACK },
  );

  // ── Page 11: replace signature block header ──
  // "SIGNATURES" heading at y ≈ 210; "PROVIDER: JUNEAU DIGITAL DESIGNS LLC"
  // header below it at y ≈ 185. Whiteout the LLC line without touching
  // SIGNATURES above or the "By: ____" blanks below.
  const p11 = pages[10];
  p11.drawRectangle({
    x: 60,
    y: 174,
    width: 360,
    height: 22,
    color: WHITE,
  });
  p11.drawText("PROVIDER: JUNEAU DIGITAL DESIGNS", {
    x: 72,
    y: 181,
    size: 11,
    font: helvBold,
    color: BLACK,
  });

  const out = await pdf.save();
  await writeFile(OUT, out);
  console.log(`✓ Wrote ${OUT} (${out.length.toLocaleString()} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
