import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { ExtractedPage } from './extract';
import { normalizeText, normalizeWithMap } from './textUtils';

export interface ReviewPdfMatchInput {
  pageNumber: number;
  text: string;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const BODY_SIZE = 10;
const LINE_HEIGHT = 15;
const HIGHLIGHT = rgb(1, 0.93, 0.55);

interface PreparedMatch {
  pageNumber: number;
  windows: string[];
}

/**
 * Prepare match windows: 48-char normalized windows stepped every 24 chars
 * (capped) so wrapped lines can be located inside long passages.
 */
function prepareMatches(matches: ReviewPdfMatchInput[]): PreparedMatch[] {
  return matches
    .map((m) => {
      const norm = normalizeText(m.text);
      const windows: string[] = [];
      if (norm.length >= 24) {
        for (let i = 0; i + 24 <= norm.length && windows.length < 24; i += 24) {
          windows.push(norm.slice(i, i + 48));
        }
      }
      return { pageNumber: m.pageNumber, windows };
    })
    .filter((m) => m.windows.length > 0);
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      // Hard-break very long words.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) {
          cut--;
        }
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Build a review-copy PDF from extracted page text with matched passages
 * highlighted in yellow. Because only extracted text positions are known
 * (no glyph coordinates from the original), this is a plain re-flowed copy.
 *
 * Fidelity notes (documented for the docs builder):
 * - This is NOT the original layout: text is re-flowed in Helvetica on A4.
 * - Images, tables, headers/footers, fonts and exact pagination are not preserved.
 * - The UI must label it "review copy, layout may differ from the original".
 */
export async function buildReviewCopyPdf(
  pages: ExtractedPage[],
  matches: ReviewPdfMatchInput[],
  title: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_W - MARGIN * 2;
  const prepared = prepareMatches(matches);

  const newPage = () => pdf.addPage([PAGE_W, PAGE_H]);

  // ---- Cover page ----
  {
    const page = newPage();
    let y = PAGE_H - 120;
    page.drawText('Similarity Review: Review Copy', {
      x: MARGIN,
      y,
      size: 20,
      font: boldFont,
      color: rgb(0.11, 0.16, 0.31),
    });
    y -= 34;
    const titleLines = wrapLine(title, boldFont, 13, maxWidth);
    for (const line of titleLines) {
      page.drawText(line, { x: MARGIN, y, size: 13, font: boldFont });
      y -= 20;
    }
    y -= 12;
    const notice = wrapLine(
      'This is a review copy generated for review purposes. The layout may differ from the original document. ' +
        'Matched passages are highlighted in yellow. The original document is preserved unchanged.',
      font,
      BODY_SIZE,
      maxWidth,
    );
    for (const line of notice) {
      page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font });
      y -= LINE_HEIGHT;
    }
    y -= 10;
    page.drawText(
      `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${pages.length} source page(s) · ${matches.length} matched passage(s)`,
      { x: MARGIN, y, size: 9, font, color: rgb(0.39, 0.45, 0.55) },
    );
  }

  // ---- Content pages ----
  for (const sourcePage of pages) {
    let page = newPage();
    let y = PAGE_H - MARGIN;

    const ensureSpace = () => {
      if (y < MARGIN + LINE_HEIGHT) {
        page = newPage();
        y = PAGE_H - MARGIN;
      }
    };

    page.drawText(`Source page ${sourcePage.pageNumber}`, {
      x: MARGIN,
      y,
      size: 13,
      font: boldFont,
      color: rgb(0.11, 0.16, 0.31),
    });
    y -= 24;

    const pageMatches = prepared.filter((m) => m.pageNumber === sourcePage.pageNumber);

    const paragraphs = sourcePage.text
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0);

    if (paragraphs.length === 0) {
      page.drawText('(No extractable text on this page.)', {
        x: MARGIN,
        y,
        size: BODY_SIZE,
        font,
        color: rgb(0.39, 0.45, 0.55),
      });
      continue;
    }

    for (const para of paragraphs) {
      const lines = wrapLine(para, font, BODY_SIZE, maxWidth);
      for (const line of lines) {
        ensureSpace();
        // Find highlight spans for this line via normalized windows.
        const lineMap = normalizeWithMap(line);
        const spans: Array<{ start: number; end: number }> = [];
        for (const pm of pageMatches) {
          for (const w of pm.windows) {
            const idx = lineMap.norm.indexOf(w);
            if (idx >= 0) {
              const start = lineMap.map[idx] ?? 0;
              const endIdx = idx + w.length - 1;
              const end = (lineMap.map[endIdx] ?? line.length - 1) + 1;
              if (end > start) spans.push({ start: Math.max(0, start), end: Math.min(line.length, end) });
              break;
            }
          }
        }
        // Merge overlapping spans.
        spans.sort((a, b) => a.start - b.start);
        const merged: Array<{ start: number; end: number }> = [];
        for (const s of spans) {
          const last = merged[merged.length - 1];
          if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
          else merged.push({ ...s });
        }
        // Draw highlight rectangles behind the text.
        for (const s of merged) {
          const x = MARGIN + font.widthOfTextAtSize(line.slice(0, s.start), BODY_SIZE);
          const w = font.widthOfTextAtSize(line.slice(s.start, s.end), BODY_SIZE);
          page.drawRectangle({
            x,
            y: y - 3,
            width: w,
            height: BODY_SIZE + 5,
            color: HIGHLIGHT,
          });
        }
        page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font });
        y -= LINE_HEIGHT;
      }
      y -= 6; // paragraph gap
      ensureSpace();
    }
  }

  // Disable object streams so the file stays parseable by older PDF
  // readers (plain xref table instead of compressed object streams).
  const bytes = await pdf.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
