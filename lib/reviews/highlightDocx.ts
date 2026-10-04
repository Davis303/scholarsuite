import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

type XmlDocument = ReturnType<InstanceType<typeof DOMParser>['parseFromString']>;
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
          text: `Highlighted review copy, generated ${date}. Matched passages are highlighted in yellow. The original document is preserved unchanged.`,
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

// ---------------------------------------------------------------------------
// In-place DOCX highlighting
//
// The review copy should keep the original document's formatting as closely
// as possible, so instead of rebuilding the file from extracted text we
// edit word/document.xml inside the original package: matched runs are
// split at the span boundaries and get a real Word highlight. Everything
// else (styles, tables, images, numbering, headers) is preserved as-is.
// The rebuild path below remains as a fallback for files whose XML cannot
// be processed this way.
// ---------------------------------------------------------------------------

function descendantElements(root: Element, tag: string): Element[] {
  const list = root.getElementsByTagName(tag);
  const out: Element[] = [];
  for (let i = 0; i < list.length; i++) out.push(list.item(i) as Element);
  return out;
}

function childElements(el: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes.item(i) as unknown as Element | null;
    if (n && n.nodeType === 1 && n.tagName === tag) out.push(n);
  }
  return out;
}

interface DocxRunInfo {
  run: Element;
  textEl: Element | null;
  text: string;
  start: number;
  end: number;
  /** Runs containing breaks, drawings etc. are never split internally. */
  opaque: boolean;
}

function collectRuns(p: Element): DocxRunInfo[] {
  const infos: DocxRunInfo[] = [];
  let pos = 0;
  for (const run of descendantElements(p, 'w:r')) {
    let simple = true;
    for (let i = 0; i < run.childNodes.length; i++) {
      const n = run.childNodes.item(i) as unknown as Element | null;
      if (n && n.nodeType === 1 && n.tagName !== 'w:rPr' && n.tagName !== 'w:t') {
        simple = false;
        break;
      }
    }
    if (simple) {
      // Merge split w:t nodes so boundary math has one text node per run.
      const ts = descendantElements(run, 'w:t');
      if (ts.length > 1) {
        ts[0].textContent = ts.map((t) => t.textContent ?? '').join('');
        for (const t of ts.slice(1)) t.parentNode?.removeChild(t);
      }
    }
    const ts = descendantElements(run, 'w:t');
    const text = ts.map((t) => t.textContent ?? '').join('');
    infos.push({
      run,
      textEl: ts[0] ?? null,
      text,
      start: pos,
      end: pos + text.length,
      opaque: !simple,
    });
    pos += text.length;
  }
  return infos;
}

function setTextOn(el: Element, text: string): void {
  el.textContent = text;
  if (/^\s|\s$/.test(text)) el.setAttribute('xml:space', 'preserve');
}

/** Ensure a run boundary exists at `offset` within the paragraph text. */
function splitRunAt(p: Element, offset: number): void {
  for (const info of collectRuns(p)) {
    if (info.opaque || !info.textEl) continue;
    if (offset > info.start && offset < info.end) {
      const cut = offset - info.start;
      const clone = info.run.cloneNode(true) as unknown as Element;
      const cloneTs = descendantElements(clone, 'w:t');
      setTextOn(info.textEl, info.text.slice(0, cut));
      if (cloneTs[0]) setTextOn(cloneTs[0], info.text.slice(cut));
      info.run.parentNode?.insertBefore(clone, info.run.nextSibling);
      return;
    }
  }
}

function addHighlightToRun(run: Element, doc: XmlDocument): void {
  let rPr = childElements(run, 'w:rPr')[0];
  if (!rPr) {
    rPr = doc.createElement('w:rPr');
    run.insertBefore(rPr, run.firstChild);
  }
  for (const h of childElements(rPr, 'w:highlight')) rPr.removeChild(h);
  const hl = doc.createElement('w:highlight');
  hl.setAttribute('w:val', 'yellow');
  rPr.appendChild(hl);
}

function applySpansInPlace(p: Element, spans: TextSpan[], doc: XmlDocument): void {
  for (const span of spans) {
    splitRunAt(p, span.end);
    splitRunAt(p, span.start);
    for (const info of collectRuns(p)) {
      if (info.end > info.start && info.start >= span.start && info.end <= span.end) {
        addHighlightToRun(info.run, doc);
      }
    }
  }
}

function noticeRun(
  doc: XmlDocument,
  text: string,
  opts: { bold?: boolean; italic?: boolean; color?: string; size?: number },
): Element {
  const run = doc.createElement('w:r');
  const rPr = doc.createElement('w:rPr');
  if (opts.bold) rPr.appendChild(doc.createElement('w:b'));
  if (opts.italic) rPr.appendChild(doc.createElement('w:i'));
  if (opts.color) {
    const c = doc.createElement('w:color');
    c.setAttribute('w:val', opts.color);
    rPr.appendChild(c);
  }
  if (opts.size) {
    const sz = doc.createElement('w:sz');
    sz.setAttribute('w:val', String(opts.size));
    rPr.appendChild(sz);
  }
  run.appendChild(rPr);
  const t = doc.createElement('w:t');
  t.textContent = text;
  run.appendChild(t);
  return run;
}

function prependNoticeInPlace(doc: XmlDocument, body: Element, title: string): void {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const mk = (run: Element | null): Element => {
    const p = doc.createElement('w:p');
    if (run) p.appendChild(run);
    return p;
  };
  const paras = [
    mk(noticeRun(doc, title, { bold: true, size: 32 })),
    mk(
      noticeRun(
        doc,
        `Highlighted review copy, generated ${date}. Matched passages are highlighted in yellow. The original document is preserved unchanged.`,
        { italic: true, color: '64748B' },
      ),
    ),
    mk(null),
  ];
  for (let i = paras.length - 1; i >= 0; i--) {
    body.insertBefore(paras[i], body.firstChild);
  }
}

async function buildHighlightedDocxInPlace(
  original: Buffer,
  matches: HighlightMatchInput[],
  title: string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(original);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('The document has no main content part.');
  const xml = await file.async('string');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const body = doc.getElementsByTagName('w:body').item(0) as unknown as Element | null;
  if (!body) throw new Error('The document has no body.');

  for (const p of descendantElements(body, 'w:p')) {
    const ts = descendantElements(p, 'w:t');
    if (ts.length === 0) continue;
    const text = ts.map((t) => t.textContent ?? '').join('');
    if (!text.trim()) continue;
    const spans = findMatchSpans(text, matches);
    if (spans.length > 0) applySpansInPlace(p, spans, doc);
  }
  prependNoticeInPlace(doc, body, title);

  const decl = xml.startsWith('<?xml')
    ? xml.slice(0, xml.indexOf('?>') + 2)
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  let out = new XMLSerializer().serializeToString(doc);
  // The serializer may emit its own declaration; keep exactly one, the
  // original file's, at the very start of the document.
  if (out.startsWith('<?xml')) out = out.slice(out.indexOf('?>') + 2);
  zip.file('word/document.xml', decl + out);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Build a highlighted DOCX review copy from an original DOCX buffer.
 *
 * Preferred path: edit the original file in place (see above), which
 * preserves styles, tables, images and layout, and applies real Word
 * highlighting to the matched runs. Falls back to a from-text rebuild
 * when the source XML cannot be processed in place.
 */
export async function buildHighlightedDocx(
  original: Buffer,
  matches: HighlightMatchInput[],
  title: string,
): Promise<Buffer> {
  try {
    return await buildHighlightedDocxInPlace(original, matches, title);
  } catch {
    return buildHighlightedDocxRebuild(original, matches, title);
  }
}

/**
 * Fallback: rebuild the review copy from extracted structure (headings,
 * bold/italic/underline, bullet + numbered lists, simple tables flattened
 * to rows). Images, exact styling and complex tables are not preserved
 * on this path.
 */
async function buildHighlightedDocxRebuild(
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
          text: 'Review copy: layout may differ from the original.',
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
