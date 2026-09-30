import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import {
  extractDocxText,
  type DocBlock,
  type ExtractedPage,
  type TextSegment,
} from './extract';
import { findSpan, type TextSpan } from './textUtils';

export interface HighlightMatchInput {
  text: string;
}

const NUMBERING_REFERENCE = 'review-numbering';

interface StyledChar {
  ch: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: boolean;
}

/** Expand a block's segments to per-character styles (UTF-16 offsets). */
function expandChars(segments: TextSegment[]): StyledChar[] {
  const chars: StyledChar[] = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.text.length; i++) {
      chars.push({
        ch: seg.text[i],
        bold: seg.bold,
        italic: seg.italic,
        underline: seg.underline,
        highlight: false,
      });
    }
  }
  return chars;
}

/** Merge consecutive same-style characters into TextRuns. */
function charsToRuns(chars: StyledChar[]): TextRun[] {
  const runs: TextRun[] = [];
  let buf = '';
  let cur: StyledChar | null = null;

  const sameStyle = (a: StyledChar, b: StyledChar) =>
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.highlight === b.highlight;

  const flush = () => {
    if (buf && cur) {
      runs.push(
        new TextRun({
          text: buf,
          bold: cur.bold ? true : undefined,
          italics: cur.italic ? true : undefined,
          underline: cur.underline ? {} : undefined,
          highlight: cur.highlight ? 'yellow' : undefined,
        }),
      );
      buf = '';
    }
  };

  for (const c of chars) {
    if (c.ch === '\n') {
      flush();
      cur = null;
      runs.push(new TextRun({ break: 1 }));
      continue;
    }
    if (!cur || !sameStyle(cur, c)) {
      flush();
      cur = c;
    }
    buf += c.ch;
  }
  flush();
  return runs;
}

/**
 * Find highlight spans for a paragraph's plain text given the matched
 * passage texts. Falls back to matching the full paragraph when the
 * passage text itself can't be located inside it.
 */
export function findMatchSpans(
  paragraphText: string,
  matches: HighlightMatchInput[],
  paragraphFallback?: string,
): TextSpan[] {
  const spans: TextSpan[] = [];
  for (const m of matches) {
    if (!m.text || m.text.length < 10) continue;
    let span = findSpan(paragraphText, m.text);
    if (!span && paragraphFallback) {
      span = findSpan(paragraphText, paragraphFallback);
    }
    if (span) spans.push(span);
  }
  // Merge overlapping spans so runs don't nest.
  spans.sort((a, b) => a.start - b.start);
  const merged: TextSpan[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

function blockToParagraph(
  block: DocBlock,
  matches: HighlightMatchInput[],
): Paragraph {
  const chars = expandChars(block.segments);
  const spans = findMatchSpans(block.text, matches);
  for (const span of spans) {
    for (let i = span.start; i < Math.min(span.end, chars.length); i++) {
      chars[i].highlight = true;
    }
  }
  const runs = charsToRuns(chars);
  const children = runs.length > 0 ? runs : [new TextRun('')];

  if (block.kind === 'heading') {
    const levels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ];
    const idx = Math.min(Math.max(block.level, 1), 6) - 1;
    return new Paragraph({ heading: levels[idx], children });
  }
  if (block.kind === 'list-item') {
    if (block.ordered) {
      return new Paragraph({
        numbering: { reference: NUMBERING_REFERENCE, level: 0 },
        children,
      });
    }
    return new Paragraph({ bullet: { level: 0 }, children });
  }
  return new Paragraph({ children });
}

function noticeParagraphs(title: string): Paragraph[] {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Highlighted review copy — generated ${date}. Matched passages are highlighted in yellow. The original document is preserved unchanged.`,
          italics: true,
          color: '64748B',
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  ];
}

function assembleDocument(paragraphs: Paragraph[]): Document {
  return new Document({
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });
}

/**
 * Build a highlighted DOCX review copy from an original DOCX buffer.
 * Rebuilds paragraphs from the extracted structure (headings, bold/italic/
 * underline, bullet + numbered lists, simple tables flattened to rows) and
 * applies yellow highlighting to matched runs.
 *
 * Fidelity notes (documented for the docs builder):
 * - Images are not carried over (mammoth extraction is text/structure only).
 * - Complex tables are flattened: one paragraph per row, cells joined with " | ".
 * - Headers/footers, footnotes, text boxes and exact page layout are not preserved.
 * - Fonts/sizes fall back to the document defaults.
 */
export async function buildHighlightedDocx(
  original: Buffer,
  matches: HighlightMatchInput[],
  title: string,
): Promise<Buffer> {
  const blocks = await extractDocxText(original);
  const children: Paragraph[] = [...noticeParagraphs(title)];
  for (const block of blocks) {
    children.push(blockToParagraph(block, matches));
  }
  const doc = assembleDocument(children);
  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Build a DOCX review copy from extracted plain-text pages (used when the
 * original is a PDF). Honestly labeled as a review copy: text-only, layout
 * will differ from the original.
 */
export async function buildReviewCopyDocxFromText(
  pages: ExtractedPage[],
  matches: HighlightMatchInput[],
  title: string,
): Promise<Buffer> {
  const children: Paragraph[] = [
    ...noticeParagraphs(title),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Review copy — layout may differ from the original.',
          bold: true,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  ];
  for (const page of pages) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(`Page ${page.pageNumber}`)],
      }),
    );
    const paragraphs = page.text
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0);
    for (const text of paragraphs) {
      const block: DocBlock = {
        kind: 'paragraph',
        level: 0,
        ordered: false,
        segments: [{ text, bold: false, italic: false, underline: false }],
        text,
      };
      children.push(blockToParagraph(block, matches));
    }
    children.push(new Paragraph({ text: '' }));
  }
  const doc = assembleDocument(children);
  return Buffer.from(await Packer.toBuffer(doc));
}
