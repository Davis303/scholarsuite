/**
 * Text extraction for the Writing Assistant.
 *
 * Extracts plain text with document structure from PDF (per-page) and DOCX.
 * Works ONLY on the user's own uploaded academic documents.
 */

import type { ExtractedDocument, ExtractedSection } from "./types";

const MAX_PAGES = 500;

function splitIntoParagraphs(raw: string): string[] {
  return raw
    .split(/\n{2,}|\r\n{2,}|\n|\r\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

function looksLikeHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 120) return false;
  if (/[.!?;:]$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 12) return false;
  // Numbered headings: "1 Introduction", "2.1 Methods", "IV. Results"
  if (/^(\d+(\.\d+)*\.?\s+|[IVXLC]+\.?\s+)/.test(t)) return true;
  // Title case short line without ending punctuation
  if (words.length <= 8 && /^[A-Z]/.test(t)) return true;
  return false;
}

/**
 * Extract text from a PDF buffer, page by page.
 * Returns per-page sections so page numbers stay attached to content.
 */
export async function extractFromPdf(
  buffer: Buffer
): Promise<ExtractedDocument> {
  let pdfParse: (buf: Buffer, opts?: unknown) => Promise<unknown>;
  try {
    const mod = await import("pdf-parse");
    pdfParse = (mod.default ?? mod) as typeof pdfParse;
  } catch {
    throw new Error("PDF parsing library failed to load.");
  }

  const pageTexts: string[] = [];
  const warnings: string[] = [];

  // Use pagerender to collect per-page text. pdf-parse resolves once per page.
  try {
    const collected: string[] = [];
    await pdfParse(buffer, {
      pagerender: async (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) => {
        try {
          const textContent = await pageData.getTextContent();
          collected.push(textContent.items.map((item) => item.str).join(" "));
        } catch {
          collected.push("");
        }
        return "";
      },
      max: MAX_PAGES,
    });
    for (let ti = 0; ti < collected.length; ti += 1) pageTexts.push(collected[ti]);
  } catch (err) {
    throw new Error(
      `Could not extract text from this PDF: ${(err as Error).message}`
    );
  }

  const sections: ExtractedSection[] = [];
  pageTexts.forEach((pageText, idx) => {
    const pageNumber = idx + 1;
    if (!pageText || pageText.trim().length === 0) {
      warnings.push(`Page ${pageNumber} contained no extractable text.`);
      return;
    }
    const paragraphs = splitIntoParagraphs(pageText);
    let current: ExtractedSection | null = null;
    for (let pi = 0; pi < paragraphs.length; pi += 1) {
      const para = paragraphs[pi];
      if (looksLikeHeading(para)) {
        current = { heading: para, paragraphs: [], pageNumber };
        sections.push(current);
      } else {
        if (!current) {
          current = { heading: "", paragraphs: [], pageNumber };
          sections.push(current);
        }
        current.paragraphs.push(para);
      }
    }
  });

  if (sections.length === 0) {
    throw new Error("No readable text was found in this PDF.");
  }

  return { sections, pageCount: pageTexts.length, warnings };
}

/**
 * Extract text with structure from a DOCX buffer via mammoth.
 * Headings come from the document's heading styles; paragraphs are
 * grouped under their nearest preceding heading.
 */
export async function extractFromDocx(
  buffer: Buffer
): Promise<ExtractedDocument> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new Error("DOCX parsing library failed to load.");
  }

  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } catch (err) {
    throw new Error(
      `Could not extract text from this Word document: ${(err as Error).message}`
    );
  }

  const sections: ExtractedSection[] = [];
  let current: ExtractedSection = { heading: "", paragraphs: [], pageNumber: 1 };
  sections.push(current);

  // Walk headings and paragraphs in document order.
  const blockRe =
    /<(h[1-6]|p|table)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let foundContent = false;
  while ((match = blockRe.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    if (inner.length === 0) continue;
    foundContent = true;
    if (tag.startsWith("h")) {
      current = { heading: inner, paragraphs: [], pageNumber: 1 };
      sections.push(current);
    } else {
      current.paragraphs.push(inner);
    }
  }

  // Fallback: raw text split if HTML walk found nothing structured.
  if (!foundContent) {
    const raw = await mammoth.extractRawText({ buffer });
    const fallbackParagraphs = splitIntoParagraphs(raw.value);
    const fallback: ExtractedSection = {
      heading: "",
      paragraphs: [],
      pageNumber: 1,
    };
    for (let pi = 0; pi < fallbackParagraphs.length; pi += 1) {
      const para = fallbackParagraphs[pi];
      if (looksLikeHeading(para)) {
        const s: ExtractedSection = { heading: para, paragraphs: [], pageNumber: 1 };
        sections.push(s);
        fallback.paragraphs.push(para);
      } else {
        fallback.paragraphs.push(para);
      }
    }
    if (fallback.paragraphs.length > 0) sections.push(fallback);
  }

  // Drop empty leading section if a heading followed immediately.
  const cleaned = sections.filter(
    (s, i) => i > 0 || s.paragraphs.length > 0 || s.heading.length > 0
  );

  if (cleaned.every((s) => s.paragraphs.length === 0 && s.heading.length === 0)) {
    throw new Error("No readable text was found in this Word document.");
  }

  return { sections: cleaned, pageCount: 1, warnings: [] };
}

export async function extractDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDocument> {
  if (mimeType === "application/pdf" || buffer.subarray(0, 4).toString() === "%PDF") {
    return extractFromPdf(buffer);
  }
  return extractFromDocx(buffer);
}
