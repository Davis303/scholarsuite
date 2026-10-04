/**
 * Highlight-region extraction for similarity report PDFs.
 *
 * Some report formats (notably Turnitin-style downloads) do not list the
 * matched passages as text. Instead, the report PDF reproduces the paper
 * with the matched spans painted as colored rectangles behind the text,
 * plus a numbered "Match Overview" of sources. The plain-text parser in
 * parseReport.ts finds nothing in such files.
 *
 * This module reads the report at the PDF drawing level: it collects
 * filled, tinted rectangles from the content stream, finds the text items
 * sitting on top of them, and rebuilds the matched passages. Number badges
 * (small digits in their own colored squares) are linked to the overview
 * so each passage keeps its source and similarity percentage.
 *
 * Everything here works only from what the report itself contains. When a
 * report has no colored highlights, this returns an empty list and the
 * caller falls back to text parsing / manual entry.
 */

import type { ExtractedPage } from "./extract";
import type { ParsedPassage } from "./parseReport";
import { normalizeText } from "./textUtils";

// ---------------------------------------------------------------------------
// Source overview parsing ("1 example.com Internet Source 14%")
// ---------------------------------------------------------------------------

export interface SourceInfo {
  index: number;
  label: string;
  detail?: string;
  similarityPct?: number;
}

const OVERVIEW_LINE_RE =
  /^\s*(\d{1,3})[.)]?\s+(.+?)\s+(\d{1,3}(?:\.\d+)?)\s*%\s*$/;
const CATEGORY_RE =
  /\s*(internet source|student paper|publication|crossref|submitted works|repository|database)s?\.?$/i;

/** Parse numbered source lines (with percentages) from report text. */
export function parseSourceOverview(pages: ExtractedPage[]): Map<number, SourceInfo> {
  const map = new Map<number, SourceInfo>();
  const lines = pages
    .map((p) => p.text)
    .join("\n")
    .split("\n")
    .map((l) => l.trim());
  for (const line of lines) {
    const m = OVERVIEW_LINE_RE.exec(line);
    if (!m) continue;
    const index = Number(m[1]);
    if (index < 1 || index > 500 || map.has(index)) continue;
    const rawSource = m[2].trim();
    const label = rawSource.replace(CATEGORY_RE, "").trim() || rawSource;
    const pct = Number(m[3]);
    map.set(index, {
      index,
      label: label.slice(0, 300),
      detail: line.slice(0, 500),
      similarityPct: pct >= 0 && pct <= 100 ? pct : undefined,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Geometry model
// ---------------------------------------------------------------------------

interface Rect {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: [number, number, number];
}

interface TextItemBox {
  str: string;
  page: number;
  x: number;
  y: number; // baseline
  w: number;
  h: number;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function isTinted(c: [number, number, number]): boolean {
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 250 && min > 245) return false; // white / near white
  if (max < 45) return false; // black / near black (text, rules)
  return max - min >= 15; // must carry a real color tint
}

// ---------------------------------------------------------------------------
// pdf.js loading (legacy build, server-side only)
// ---------------------------------------------------------------------------

interface PdfJsPage {
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  getTextContent: () => Promise<{
    items: Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;
  }>;
}

interface PdfJsDoc {
  numPages: number;
  getPage: (n: number) => Promise<PdfJsPage>;
}

interface PdfJsLib {
  OPS: Record<string, number>;
  getDocument: (opts: { data: Uint8Array }) => { promise: Promise<PdfJsDoc> };
}

async function loadPdfJs(): Promise<PdfJsLib> {
  // The legacy build runs on the main thread in Node without a worker.
  const mod = (await import(
    /* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.js"
  )) as unknown as PdfJsLib;
  // pdf.js starts a "fake worker" in Node, which loads pdf.worker.js from
  // disk next to pdf.js. In a pruned serverless bundle that sibling file
  // only exists when the module graph references it, so import it here:
  // the explicit import makes the file tracer include it, and loading it
  // in-process registers the worker implementation as a fallback.
  // @ts-ignore - pdfjs-dist ships no type declarations for the worker entry.
  await import("pdfjs-dist/legacy/build/pdf.worker.js").catch(
    () => undefined,
  );
  return mod;
}

// ---------------------------------------------------------------------------
// Operator-list walk: collect tinted filled rectangles per page
// ---------------------------------------------------------------------------

interface GraphicsState {
  ctm: Matrix;
  fill: [number, number, number] | null;
}

function asColor(args: unknown): [number, number, number] | null {
  // setFillRGBColor arrives as an array-like of 0..255 components;
  // setFillColorN / setFillColor use 0..1 floats.
  const vals: number[] = [];
  if (Array.isArray(args)) {
    for (const v of args) if (typeof v === "number") vals.push(v);
  } else if (args && typeof args === "object") {
    for (const v of Object.values(args as Record<string, unknown>)) {
      if (typeof v === "number") vals.push(v);
    }
  }
  if (vals.length === 0) return null;
  if (vals.length === 1) {
    const g = vals[0] <= 1 ? vals[0] * 255 : vals[0];
    return [g, g, g];
  }
  const scale = vals.slice(0, 3).some((v) => v > 1) ? 1 : 255;
  const [r, g, b] = vals.slice(0, 3).map((v) => Math.round(v * scale));
  return [r, g, b];
}

/** Extract bounding boxes from one constructPath args payload. */
function pathBoxes(
  opsArr: number[],
  coords: number[],
  rectOp: number,
  moveOp: number,
  lineOp: number,
  curveOps: Set<number>,
  closeOp: number,
): Array<[number, number, number, number]> {
  const boxes: Array<[number, number, number, number]> = [];
  let i = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let has = false;
  const flush = () => {
    if (has && maxX > minX && maxY > minY) boxes.push([minX, minY, maxX, maxY]);
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    has = false;
  };
  const addPt = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    has = true;
  };
  for (const op of opsArr) {
    if (op === rectOp) {
      flush();
      const [x, y, w, h] = coords.slice(i, i + 4);
      i += 4;
      if ([x, y, w, h].every((v) => typeof v === "number")) {
        boxes.push([
          Math.min(x, x + w),
          Math.min(y, y + h),
          Math.max(x, x + w),
          Math.max(y, y + h),
        ]);
      }
    } else if (op === moveOp || op === lineOp) {
      const [x, y] = coords.slice(i, i + 2);
      i += 2;
      if (typeof x === "number" && typeof y === "number") addPt(x, y);
    } else if (curveOps.has(op)) {
      const pts = coords.slice(i, i + 6);
      i += 6;
      for (let k = 0; k + 1 < pts.length; k += 2) {
        if (typeof pts[k] === "number" && typeof pts[k + 1] === "number") {
          addPt(pts[k], pts[k + 1]);
        }
      }
    } else if (op === closeOp) {
      flush();
    }
  }
  flush();
  return boxes;
}

async function collectPageRects(
  lib: PdfJsLib,
  page: PdfJsPage,
  pageNumber: number,
): Promise<Rect[]> {
  const OPS = lib.OPS;
  const rects: Rect[] = [];
  const opList = await page.getOperatorList();

  const paintOps = new Set([
    OPS.fill,
    OPS.eoFill,
    OPS.closeFill,
    OPS.closeEOFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const curveOps = new Set([OPS.curveTo, OPS.curveTo2, OPS.curveTo3]);

  let state: GraphicsState = { ctm: [...IDENTITY] as Matrix, fill: null };
  const stack: GraphicsState[] = [];
  let pending: Array<[number, number, number, number]> = [];

  for (let idx = 0; idx < opList.fnArray.length; idx++) {
    const fn = opList.fnArray[idx];
    const args = opList.argsArray[idx];
    try {
      if (fn === OPS.save) {
        stack.push({ ctm: [...state.ctm] as Matrix, fill: state.fill });
      } else if (fn === OPS.restore) {
        const prev = stack.pop();
        if (prev) state = prev;
      } else if (fn === OPS.transform) {
        const m = args as number[];
        if (Array.isArray(m) && m.length === 6) {
          state = { ...state, ctm: multiply(state.ctm, m as Matrix) };
        }
      } else if (fn === OPS.paintFormXObjectBegin) {
        stack.push({ ctm: [...state.ctm] as Matrix, fill: state.fill });
        const arr = args as unknown[];
        const m = Array.isArray(arr) ? (arr[1] as number[] | undefined) : undefined;
        if (Array.isArray(m) && m.length === 6) {
          state = { ...state, ctm: multiply(state.ctm, m as Matrix) };
        }
      } else if (fn === OPS.paintFormXObjectEnd) {
        const prev = stack.pop();
        if (prev) state = prev;
      } else if (
        fn === OPS.setFillRGBColor ||
        fn === OPS.setFillGray ||
        fn === OPS.setFillColor ||
        fn === OPS.setFillColorN
      ) {
        const color = asColor(args);
        if (color) state = { ...state, fill: color };
      } else if (fn === OPS.constructPath) {
        const [opsArr, coords] = args as [number[], number[], unknown];
        if (Array.isArray(opsArr) && Array.isArray(coords)) {
          const boxes = pathBoxes(
            opsArr,
            coords,
            OPS.rectangle,
            OPS.moveTo,
            OPS.lineTo,
            curveOps,
            OPS.closePath,
          );
          for (const b of boxes) {
            const [ax, ay] = applyPoint(state.ctm, b[0], b[1]);
            const [bx, by] = applyPoint(state.ctm, b[2], b[3]);
            pending.push([
              Math.min(ax, bx),
              Math.min(ay, by),
              Math.max(ax, bx),
              Math.max(ay, by),
            ]);
          }
        }
      } else if (paintOps.has(fn)) {
        if (state.fill && isTinted(state.fill)) {
          for (const [x0, y0, x1, y1] of pending) {
            if (x1 - x0 >= 6 && y1 - y0 >= 4) {
              rects.push({ page: pageNumber, x0, y0, x1, y1, color: state.fill });
            }
          }
        }
        pending = [];
      } else if (fn === OPS.endPath) {
        pending = [];
      }
    } catch {
      // A single malformed op must not sink the whole page.
      continue;
    }
  }
  return rects;
}

// ---------------------------------------------------------------------------
// Text items
// ---------------------------------------------------------------------------

async function collectPageItems(
  page: PdfJsPage,
  pageNumber: number,
): Promise<TextItemBox[]> {
  const content = await page.getTextContent();
  const items: TextItemBox[] = [];
  for (const item of content.items) {
    if (!item.str) continue;
    const t = item.transform;
    const h =
      item.height > 0
        ? item.height
        : Math.hypot(t[2] ?? 0, t[3] ?? 0) || 10;
    items.push({
      str: item.str,
      page: pageNumber,
      x: t[4],
      y: t[5],
      w: item.width,
      h,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Passage assembly
// ---------------------------------------------------------------------------

interface Fragment {
  page: number;
  rectIndex: number;
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sourceIndex?: number;
}

const DIGITS_ONLY_RE = /^\d{1,3}$/;

function itemInRect(item: TextItemBox, r: Rect, pad: number): boolean {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h * 0.3;
  return (
    cx >= r.x0 - pad &&
    cx <= r.x1 + pad &&
    cy >= r.y0 - pad &&
    cy <= r.y1 + pad
  );
}

function cleanFragmentText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s·•-]+|[\s·•-]+$/g, "")
    .trim();
}

function validHighlightPassage(text: string): boolean {
  if (text.length < 20) return false;
  if (text.split(/\s+/).length < 4) return false;
  if (/^(https?:\/\/|doi:)/i.test(text)) return false;
  return true;
}

/**
 * Extract matched passages from the colored highlights of a report PDF.
 * `reportPages` (already extracted plain text) supplies the Match Overview
 * used to label sources. Returns [] when the report carries no highlights.
 */
export async function extractHighlightPassagesFromReport(
  buffer: Buffer,
  reportPages: ExtractedPage[],
): Promise<ParsedPassage[]> {
  let lib: PdfJsLib;
  try {
    lib = await loadPdfJs();
  } catch {
    return [];
  }

  const overview = parseSourceOverview(reportPages);

  let doc: PdfJsDoc;
  try {
    doc = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch {
    return [];
  }

  const maxPages = Math.min(doc.numPages, 200);
  const fragments: Fragment[] = [];

  for (let p = 1; p <= maxPages; p++) {
    let page: PdfJsPage;
    try {
      page = await doc.getPage(p);
    } catch {
      continue;
    }
    const [rects, items] = await Promise.all([
      collectPageRects(lib, page, p).catch(() => [] as Rect[]),
      collectPageItems(page, p).catch(() => [] as TextItemBox[]),
    ]);
    if (rects.length === 0 || items.length === 0) continue;

    // Badge items: tiny digit strings sitting in their own colored square.
    const badges: Array<{ value: number; x: number; y: number }> = [];
    const bodyItems: TextItemBox[] = [];
    for (const item of items) {
      const trimmed = item.str.trim();
      if (DIGITS_ONLY_RE.test(trimmed)) {
        const inColored = rects.some((r) => itemInRect(item, r, 3));
        if (inColored) {
          badges.push({
            value: Number(trimmed),
            x: item.x + item.w / 2,
            y: item.y + item.h / 2,
          });
          continue;
        }
      }
      bodyItems.push(item);
    }

    // One fragment per highlight rect: the body text painted on top of it.
    rects.forEach((rect, rectIndex) => {
      const inside = bodyItems
        .filter((item) => itemInRect(item, rect, 2.5))
        .sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
      if (inside.length === 0) return;
      // Badge squares also collect as rects holding only a digit: skip.
      const text = cleanFragmentText(inside.map((i) => i.str).join(" "));
      if (!text || DIGITS_ONLY_RE.test(text)) return;
      fragments.push({
        page: p,
        rectIndex,
        text,
        x0: rect.x0,
        y0: rect.y0,
        x1: rect.x1,
        y1: rect.y1,
      });
    });

    // Attach the nearest badge to each fragment on this page.
    for (const frag of fragments) {
      if (frag.page !== p) continue;
      let best: { value: number; dist: number } | undefined;
      for (const badge of badges) {
        const dx = Math.max(frag.x0 - badge.x, 0, badge.x - frag.x1);
        const dy = Math.max(frag.y0 - badge.y, 0, badge.y - frag.y1);
        const dist = Math.hypot(dx, dy);
        if (dist <= 60 && (!best || dist < best.dist)) {
          best = { value: badge.value, dist };
        }
      }
      if (best) frag.sourceIndex = best.value;
    }
  }

  // Merge fragments that continue the same span: same page, vertically
  // adjacent lines (a generator may paint one rect per line), no badge
  // conflict.
  const sorted = fragments.sort(
    (a, b) => a.page - b.page || b.y1 - a.y1 || a.x0 - b.x0,
  );
  const merged: Fragment[] = [];
  for (const frag of sorted) {
    const prev = merged[merged.length - 1];
    const lineGap =
      prev && prev.page === frag.page ? prev.y0 - frag.y1 : Infinity;
    const sameSource =
      !prev ||
      prev.sourceIndex === undefined ||
      frag.sourceIndex === undefined ||
      prev.sourceIndex === frag.sourceIndex;
    if (prev && prev.page === frag.page && lineGap >= -4 && lineGap <= 22 && sameSource) {
      prev.text = `${prev.text} ${frag.text}`;
      prev.y0 = Math.min(prev.y0, frag.y0);
      prev.x0 = Math.min(prev.x0, frag.x0);
      prev.x1 = Math.max(prev.x1, frag.x1);
      if (prev.sourceIndex === undefined) prev.sourceIndex = frag.sourceIndex;
    } else {
      merged.push({ ...frag });
    }
  }

  // Build passages, dedupe, attach overview source info.
  const seen = new Set<string>();
  const passages: ParsedPassage[] = [];
  for (const frag of merged) {
    const text = cleanFragmentText(frag.text);
    if (!validHighlightPassage(text)) continue;
    const key = normalizeText(text).slice(0, 200);
    if (seen.has(key)) continue;
    seen.add(key);
    const src =
      frag.sourceIndex !== undefined ? overview.get(frag.sourceIndex) : undefined;
    passages.push({
      text,
      sourceLabel: src?.label,
      sourceDetail: src?.detail,
      similarityPct: src?.similarityPct,
    });
  }
  return passages;
}
