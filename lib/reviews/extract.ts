import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

// ---------------------------------------------------------------------------
// Shared block model
// ---------------------------------------------------------------------------

export interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export type BlockKind = 'heading' | 'paragraph' | 'list-item';

export interface DocBlock {
  kind: BlockKind;
  /** Heading level 1-6 (headings only), 0 otherwise. */
  level: number;
  /** True for ordered (numbered) list items. */
  ordered: boolean;
  segments: TextSegment[];
  /** Plain text of the block (segments joined). */
  text: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

// ---------------------------------------------------------------------------
// DOCX extraction via mammoth
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/**
 * Parse inline HTML (<strong>, <em>, <u>, <a>, <br>) into styled segments.
 * Only inline tags are expected here.
 */
export function parseInlineSegments(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const tagRe = /<(\/?)(strong|b|em|i|u|a|br)(\s[^>]*)?>/gi;
  let bold = false;
  let italic = false;
  let underline = false;
  let buf = '';
  let last = 0;

  const flush = () => {
    if (buf) {
      const text = decodeEntities(buf);
      if (text) segments.push({ text, bold, italic, underline });
      buf = '';
    }
  };

  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    buf += html.slice(last, m.index);
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'br') {
      buf += '\n';
    } else {
      flush();
      const on = !closing;
      if (tag === 'strong' || tag === 'b') bold = on;
      else if (tag === 'em' || tag === 'i') italic = on;
      else if (tag === 'u' || tag === 'a') underline = on;
    }
    last = tagRe.lastIndex;
  }
  buf += html.slice(last);
  flush();
  return segments;
}

function segmentsText(segments: TextSegment[]): string {
  return segments.map((s) => s.text).join('');
}

/** Parse mammoth's HTML output into an ordered list of content blocks. */
export function parseMammothHtml(html: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const blockRe = /<(h[1-6]|p|ul|ol|table)([^>]*)>([\s\S]*?)<\/\1>/gi;

  const pushBlock = (
    kind: BlockKind,
    innerHtml: string,
    level = 0,
    ordered = false,
  ) => {
    const segments = parseInlineSegments(innerHtml);
    const text = segmentsText(segments).replace(/\s+\n/g, '\n').trim();
    if (!text) return;
    blocks.push({ kind, level, ordered, segments, text });
  };

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[3];
    if (tag === 'ul' || tag === 'ol') {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      const ordered = tag === 'ol';
      while ((li = liRe.exec(inner)) !== null) {
        pushBlock('list-item', li[1], 0, ordered);
      }
    } else if (tag === 'table') {
      // Tables: flatten each row into a paragraph with cells joined by " | ".
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let row: RegExpExecArray | null;
      while ((row = rowRe.exec(inner)) !== null) {
        const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cells: string[] = [];
        let cell: RegExpExecArray | null;
        while ((cell = cellRe.exec(row[1])) !== null) {
          cells.push(segmentsText(parseInlineSegments(cell[1])).trim());
        }
        const rowText = cells.filter(Boolean).join(' | ');
        if (rowText) {
          blocks.push({
            kind: 'paragraph',
            level: 0,
            ordered: false,
            segments: [{ text: rowText, bold: false, italic: false, underline: false }],
            text: rowText,
          });
        }
      }
    } else if (/^h[1-6]$/.test(tag)) {
      pushBlock('heading', inner, Number(tag[1]));
    } else {
      pushBlock('paragraph', inner);
    }
  }
  return blocks;
}

/**
 * Extract a DOCX buffer into structured blocks (headings, paragraphs,
 * list items) with inline bold/italic/underline information.
 */
export async function extractDocxText(buffer: Buffer): Promise<DocBlock[]> {
  const result = await mammoth.convertToHtml({ buffer });
  return parseMammothHtml(result.value);
}

// ---------------------------------------------------------------------------
// PDF extraction via pdf-parse (per-page text)
// ---------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
  /** pdf.js text transform matrix; [5] is the baseline Y. */
  transform?: number[];
}

interface PdfPageData {
  getTextContent: (options?: {
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }) => Promise<{ items: PdfTextItem[] }>;
}

/**
 * Extract a PDF buffer into per-page text: [{ pageNumber, text }].
 * Pages are 1-based. Text items are joined with newlines; EOL markers
 * from the PDF text layer are respected when present.
 */
export async function extractPdfPages(buffer: Buffer): Promise<ExtractedPage[]> {
  // Runtime note: pdf-parse's bundled pdf.js reliably parses a plain
  // Uint8Array, but intermittently throws "bad XRef entry" when handed a
  // Node Buffer (its pooled/shared underlying ArrayBuffer confuses the
  // 2017-era parser). The @types/pdf-parse signature declares Buffer, so
  // this casts to the (inaccurate) declared type; the Uint8Array is what
  // actually works. Verified: 10/10 parses vs intermittent failures.
  const data = new Uint8Array(buffer);
  const pages: ExtractedPage[] = [];
  await pdfParse(data as Buffer, {
    pagerender: async (pageData: PdfPageData): Promise<string> => {
      const content = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      // Same line-grouping as pdf-parse's default renderer: items sharing
      // a baseline belong to one line; a baseline change starts a new line.
      // (Joining every item with a newline shreds glyph-positioned PDFs.)
      let lastY: number | undefined;
      let text = '';
      for (const item of content.items) {
        const y = item.transform?.[5];
        if (lastY === undefined || y === lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = y;
      }
      text = text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      pages.push({ pageNumber: pages.length + 1, text });
      return text;
    },
  });
  // Fallback: if the custom renderer produced nothing (older pdf-parse),
  // fall back to the whole-document text as a single page.
  if (pages.length === 0) {
    const dataFallback = await pdfParse(data as Buffer);
    pages.push({ pageNumber: 1, text: (dataFallback.text || '').trim() });
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Matching helpers: turn blocks/pages into matchable page -> paragraphs
// ---------------------------------------------------------------------------

export interface MatchDocPage {
  pageNumber: number;
  paragraphs: string[];
}

/**
 * DOCX has no real pages: chunk blocks into numbered groups so the
 * reviewer can navigate. Chunking is deterministic (12 blocks per page).
 */
export function docxBlocksToMatchPages(
  blocks: DocBlock[],
  perPage = 12,
): MatchDocPage[] {
  const pages: MatchDocPage[] = [];
  for (let i = 0; i < blocks.length; i += perPage) {
    pages.push({
      pageNumber: Math.floor(i / perPage) + 1,
      paragraphs: blocks.slice(i, i + perPage).map((b) => b.text),
    });
  }
  if (pages.length === 0) pages.push({ pageNumber: 1, paragraphs: [] });
  return pages;
}

/** Split PDF page text into paragraphs on blank lines. */
export function pdfPagesToMatchPages(pages: ExtractedPage[]): MatchDocPage[] {
  return pages.map((p) => ({
    pageNumber: p.pageNumber,
    paragraphs: p.text
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0),
  }));
}
