import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Block, Section } from "./types";

/* ── page geometry ── */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 66;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 60;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.78, 0.78, 0.78);
const CALLOUT_BG = rgb(0.96, 0.96, 0.94);

/**
 * WinAnsi is the encoding pdf-lib's standard fonts use, and it *throws* on any
 * character outside it. The terms themselves are checked, but client-entered
 * values (legal name, address, signer name) can contain anything a keyboard or
 * clipboard produces — so everything drawn goes through sanitize() first.
 * Unrepresentable characters become "?" rather than being dropped, so
 * corruption is visible in the document instead of silent.
 */
const WINANSI_HIGH = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
    "‘’“”•–—˜™š›œžŸ" +
    " ¡¢£¤¥¦§¨©ª«¬­®¯" +
    "°±²³´µ¶·¸¹º»¼½¾¿" +
    "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ" +
    "ÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß" +
    "àáâãäåæçèéêëìíîï" +
    "ðñòóôõö÷øùúûüýþÿ",
);

export function sanitize(text: string): string {
  let out = "";
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 0x0a || c === 0x09) out += " ";
    else if (c >= 0x20 && c <= 0x7e) out += ch;
    else if (WINANSI_HIGH.has(ch)) out += ch;
    else out += "?";
  }
  return out;
}

export interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  indent?: number;
  lineGap?: number;
  /** Space added before the block. */
  before?: number;
  /** Space added after the block. */
  after?: number;
}

/**
 * A minimal block-flow document over pdf-lib: word wraps at a fixed content
 * width, paginates automatically, and keeps a footer page number. pdf-lib has
 * no layout engine, so this is the layer that supplies one.
 */
export class PdfDoc {
  private constructor(
    readonly pdf: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.page = pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
  }

  page: PDFPage;
  private y: number;

  static async create(): Promise<PdfDoc> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    return new PdfDoc(pdf, font, bold);
  }

  get cursorY(): number {
    return this.y;
  }

  newPage(): void {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
  }

  /** Starts a new page if `height` would cross the bottom margin. */
  private ensure(height: number): void {
    if (this.y - height < MARGIN_BOTTOM) this.newPage();
  }

  space(h: number): void {
    this.y -= h;
  }

  rule(color = RULE): void {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: PAGE_W - MARGIN_X, y: this.y },
      thickness: 0.5,
      color,
    });
    this.y -= 10;
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const clean = sanitize(text).replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const lines: string[] = [];
    let line = "";
    for (const word of clean.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A single word longer than the line (a URL, say) is hard-broken.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = word;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Draws wrapped text and advances the cursor. Returns the height consumed. */
  text(content: string, opts: TextOpts = {}): void {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.bold : this.font;
    const color = opts.color ?? INK;
    const indent = opts.indent ?? 0;
    const lh = size * (opts.lineGap ?? 1.4);

    if (opts.before) this.y -= opts.before;

    const lines = this.wrap(content, font, size, CONTENT_W - indent);
    for (const line of lines) {
      this.ensure(lh);
      this.page.drawText(line, { x: MARGIN_X + indent, y: this.y - size, size, font, color });
      this.y -= lh;
    }

    if (opts.after) this.y -= opts.after;
  }

  /** Draws a label and value on one line at fixed columns — used by the audit page. */
  labelValue(label: string, value: string, labelX = 0, valueX = 150, size = 9): void {
    const lh = size * 1.55;
    this.ensure(lh);
    this.page.drawText(sanitize(label), {
      x: MARGIN_X + labelX,
      y: this.y - size,
      size,
      font: this.bold,
      color: INK,
    });
    for (const line of this.wrap(value, this.font, size, CONTENT_W - valueX)) {
      this.page.drawText(line, { x: MARGIN_X + valueX, y: this.y - size, size, font: this.font, color: INK });
      this.y -= lh;
    }
    if (!value) this.y -= lh;
  }

  bullets(items: string[], size = 9.5): void {
    for (const item of items) {
      const lines = this.wrap(item, this.font, size, CONTENT_W - 16);
      const lh = size * 1.4;
      lines.forEach((line, i) => {
        this.ensure(lh);
        if (i === 0) {
          this.page.drawText("•", {
            x: MARGIN_X + 4,
            y: this.y - size,
            size,
            font: this.font,
            color: MUTED,
          });
        }
        this.page.drawText(line, { x: MARGIN_X + 16, y: this.y - size, size, font: this.font, color: INK });
        this.y -= lh;
      });
      this.y -= 2;
    }
  }

  table(rows: [string, string][], size = 9): void {
    const colW = CONTENT_W * 0.62;
    const rightX = MARGIN_X + colW + 10;
    const rightW = CONTENT_W - colW - 10;
    const lh = size * 1.35;

    for (const [label, value] of rows) {
      const l = this.wrap(label, this.font, size, colW - 8);
      const r = this.wrap(value, this.bold, size, rightW);
      const height = Math.max(l.length, r.length) * lh + 6;
      this.ensure(height);

      const top = this.y;
      l.forEach((line, i) => {
        this.page.drawText(line, { x: MARGIN_X, y: top - size - i * lh, size, font: this.font, color: INK });
      });
      r.forEach((line, i) => {
        this.page.drawText(line, { x: rightX, y: top - size - i * lh, size, font: this.bold, color: INK });
      });
      this.y = top - height;
      this.page.drawLine({
        start: { x: MARGIN_X, y: this.y + 3 },
        end: { x: PAGE_W - MARGIN_X, y: this.y + 3 },
        thickness: 0.4,
        color: RULE,
      });
    }
    this.y -= 4;
  }

  /** Boxed, bold emphasis — the arbitration warning. */
  callout(content: string, size = 9): void {
    const inset = 10;
    const lines = this.wrap(content, this.bold, size, CONTENT_W - inset * 2);
    const lh = size * 1.45;
    const boxH = lines.length * lh + inset * 2;

    // A callout must not be split across pages — it is the one block whose
    // conspicuousness is the entire legal point of it.
    if (this.y - boxH < MARGIN_BOTTOM) this.newPage();

    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: top - boxH,
      width: CONTENT_W,
      height: boxH,
      color: CALLOUT_BG,
      borderColor: rgb(0.55, 0.55, 0.55),
      borderWidth: 1,
    });
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN_X + inset,
        y: top - inset - size - i * lh,
        size,
        font: this.bold,
        color: INK,
      });
    });
    this.y = top - boxH - 8;
  }

  image(png: Awaited<ReturnType<PDFDocument["embedPng"]>>, w: number, h: number, x = MARGIN_X): void {
    this.ensure(h + 4);
    this.page.drawImage(png, { x, y: this.y - h, width: w, height: h });
    this.y -= h + 4;
  }

  /** Stamps "Page N of M" on every page. Call once, last. */
  private paginate(): void {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      const label = `Page ${i + 1} of ${pages.length}`;
      const size = 8;
      p.drawText(label, {
        x: PAGE_W - MARGIN_X - this.font.widthOfTextAtSize(label, size),
        y: 32,
        size,
        font: this.font,
        color: MUTED,
      });
    });
  }

  async finish(): Promise<Uint8Array> {
    this.paginate();
    return this.pdf.save();
  }
}

/* ── section rendering ── */

export function renderBlock(doc: PdfDoc, block: Block): void {
  switch (block.kind) {
    case "para":
      doc.text(block.text, { size: 9.5, after: 7 });
      break;
    case "bullets":
      doc.bullets(block.items);
      doc.space(4);
      break;
    case "table":
      doc.table(block.rows);
      break;
    case "callout":
      doc.space(4);
      doc.callout(block.text);
      break;
    case "allcaps":
      doc.text(block.text, { size: 9, bold: true, after: 8 });
      break;
  }
}

export function renderSections(doc: PdfDoc, sections: Section[]): void {
  for (const section of sections) {
    // Schedule A (num 0) starts its own page and prints unnumbered.
    if (section.num === 0) doc.newPage();

    doc.space(10);
    const heading = section.num === 0 ? section.heading : `${section.num}. ${section.heading}`;
    doc.text(heading, { size: 11.5, bold: true, after: 3 });
    doc.rule();

    for (const block of section.intro) renderBlock(doc, block);

    for (const sub of section.subsections) {
      doc.space(4);
      const subHeading = sub.num ? `${sub.num} ${sub.heading}` : sub.heading;
      doc.text(subHeading, { size: 9.75, bold: true, after: 4 });
      for (const block of sub.blocks) renderBlock(doc, block);
    }
  }
}
