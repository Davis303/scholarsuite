/**
 * Document export for the Writing Assistant.
 *
 * Rebuilds DOCX (via the `docx` library) applying only accepted or manually
 * edited revisions, and renders a clean PDF (via `pdf-lib`). Also produces the
 * change list shown in "View Changes".
 */

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  ChangeItem,
  ExtractedDocument,
  RevisionStatus,
} from "./types";

export interface ExportRevision {
  id: string;
  scope: string;
  sectionRef: string;
  original_text: string;
  revised_text: string;
  status: RevisionStatus;
}

/**
 * Apply accepted/edited revisions to the extracted sections.
 * Returns the new sections plus the list of applied changes.
 */
export function applyRevisions(
  doc: ExtractedDocument,
  revisions: ExportRevision[]
): { sections: ExtractedDocument["sections"]; changes: ChangeItem[] } {
  const applicable = revisions.filter(
    (r) => r.status === "accepted" || r.status === "edited"
  );
  const sections = doc.sections.map((s) => ({
    ...s,
    paragraphs: [...s.paragraphs],
  }));
  const changes: ChangeItem[] = [];

  for (let ri = 0; ri < applicable.length; ri += 1) {
    const rev = applicable[ri];
    const original = rev.original_text.trim();
    if (original.length === 0) continue;
    const revised = rev.revised_text.trim();
    let applied = false;

    for (let si = 0; si < sections.length; si += 1) {
      const section = sections[si];
      if (rev.sectionRef && rev.sectionRef !== "selection") {
        const idx = Number(rev.sectionRef.replace("section-", ""));
        if (!Number.isNaN(idx) && si !== idx) continue;
      }
      for (let i = 0; i < section.paragraphs.length; i += 1) {
        const para = section.paragraphs[i];
        if (para.includes(original)) {
          section.paragraphs[i] = para.replace(original, revised);
          applied = true;
          break;
        }
        // Paragraph-level revisions replace the whole paragraph.
        if (rev.scope === "paragraph" && para.trim() === original) {
          section.paragraphs[i] = revised;
          applied = true;
          break;
        }
      }
      if (applied) break;
    }

    if (applied) {
      changes.push({
        id: rev.id,
        scope: rev.scope,
        sectionRef: rev.sectionRef,
        original,
        revised,
        status: rev.status,
      });
    }
  }

  return { sections, changes };
}

export function buildChangeList(revisions: ExportRevision[]): ChangeItem[] {
  return revisions.map((r) => ({
    id: r.id,
    scope: r.scope,
    sectionRef: r.sectionRef,
    original: r.original_text,
    revised: r.revised_text,
    status: r.status,
  }));
}

/**
 * Build a DOCX file from sections (with revisions applied).
 */
export async function buildDocx(
  doc: ExtractedDocument,
  title: string
): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true, size: 44 })],
    })
  );
  for (let si = 0; si < doc.sections.length; si += 1) {
    const section = doc.sections[si];
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: section.heading, bold: true, size: 32 })],
        })
      );
    }
    for (let pi = 0; pi < section.paragraphs.length; pi += 1) {
      const para = section.paragraphs[pi];
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para, size: 24 })],
          spacing: { after: 160 },
        })
      );
    }
  }
  const document = new Document({
    sections: [{ children }],
    title,
  });
  const buffer = await Packer.toBuffer(document);
  return Buffer.from(buffer);
}

/**
 * Build a simple, clean PDF from sections (with revisions applied).
 * Uses standard Helvetica; preserves headings, paragraph breaks, page numbers.
 */
export async function buildPdf(
  doc: ExtractedDocument,
  title: string
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4
  const PAGE_H = 841.89;
  const MARGIN = 56;
  const MAX_W = PAGE_W - MARGIN * 2;
  const BODY_SIZE = 11;
  const HEADING_SIZE = 15;
  const TITLE_SIZE = 20;

  function wrap(text: string, size: number, fnt: typeof font): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const lines: string[] = [];
    let line = "";
    for (let wi = 0; wi < words.length; wi += 1) {
      const word = words[wi];
      const trial = line ? `${line} ${word}` : word;
      if (fnt.widthOfTextAtSize(trial, size) > MAX_W && line) {
        lines.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  type Line = { text: string; size: number; bold: boolean; gapAfter: number };
  const lines: Line[] = [{ text: title, size: TITLE_SIZE, bold: true, gapAfter: 18 }];
  for (let si = 0; si < doc.sections.length; si += 1) {
    const section = doc.sections[si];
    if (section.heading) {
      lines.push({ text: section.heading, size: HEADING_SIZE, bold: true, gapAfter: 8 });
    }
    for (let pi = 0; pi < section.paragraphs.length; pi += 1) {
      const para = section.paragraphs[pi];
      const wrappedLines = wrap(para, BODY_SIZE, font);
      for (let li = 0; li < wrappedLines.length; li += 1) {
        lines.push({ text: wrappedLines[li], size: BODY_SIZE, bold: false, gapAfter: 0 });
      }
      lines.push({ text: "", size: BODY_SIZE, bold: false, gapAfter: 8 });
    }
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageNumber = 1;

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    pageNumber += 1;
  }

  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];
    const needed = line.size * 1.5 + line.gapAfter;
    if (y - needed < MARGIN) newPage();
    if (line.text) {
      page.drawText(line.text, {
        x: MARGIN,
        y: y - line.size,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: rgb(0.13, 0.16, 0.22),
      });
    }
    y -= line.size * 1.5 + line.gapAfter;
  }

  // Page numbers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1}`;
    p.drawText(label, {
      x: PAGE_W / 2 - 4,
      y: 32,
      size: 9,
      font,
      color: rgb(0.42, 0.45, 0.52),
    });
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
