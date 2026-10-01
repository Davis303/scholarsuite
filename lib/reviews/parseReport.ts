import type { ExtractedPage } from './extract';
import { normalizeText, tokens } from './textUtils';

export interface ParsedPassage {
  text: string;
  sourceLabel?: string;
  sourceDetail?: string;
  similarityPct?: number;
}

export interface ParsedReport {
  passages: ParsedPassage[];
  /** True when nothing could be parsed, the UI must offer manual entry. */
  needsManualReview: boolean;
}

const SECTION_RE = /^\s*(sources?|matches|text matches|matched sources?|similarity matches)\s*:?\s*$/i;
const NUMBERED_RE = /^\s*(\d{1,3})[.)\]:]\s+(.+)$/;
const SOURCE_LINE_RE = /^\s*(source|matched?\s*source|url|link)\s*[:\-–]\s*(.+)$/i;
const URL_RE = /https?:\/\/[^\s)]+/i;
const PCT_RE = /(\d{1,3}(?:\.\d+)?)\s*%/;
const QUOTED_RE = /["“”]([^"“”]{40,3000})["“”]/g;

interface Candidate {
  text: string;
  sourceLabel?: string;
  sourceDetail?: string;
  similarityPct?: number;
}

function nearestPercent(lines: string[], idx: number): number | undefined {
  for (let d = 0; d <= 3; d++) {
    for (const j of [idx + d, idx - d]) {
      if (j < 0 || j >= lines.length) continue;
      const m = PCT_RE.exec(lines[j]);
      if (m) {
        const v = Number(m[1]);
        if (v >= 0 && v <= 100) return v;
      }
    }
  }
  return undefined;
}

function nearestSource(lines: string[], idx: number): { label?: string; detail?: string } {
  for (let d = 1; d <= 4; d++) {
    for (const j of [idx + d, idx - d]) {
      if (j < 0 || j >= lines.length) continue;
      const line = lines[j];
      const sm = SOURCE_LINE_RE.exec(line);
      if (sm) {
        return { label: sm[2].trim().slice(0, 300), detail: line.trim().slice(0, 500) };
      }
      const um = URL_RE.exec(line);
      if (um) {
        return { label: um[0].slice(0, 300), detail: line.trim().slice(0, 500) };
      }
    }
  }
  return {};
}

function isJunkLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  // Page headers/footers and report boilerplate commonly seen in reports.
  return /^(page\s+\d+|similarity\s+report|turnitin|ithenticate|report\s+generated|generated\s+on|total\s+similarity)/i.test(t);
}

function cleanPassage(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^["“”'']+|["“”'']+$/g, '')
    .trim();
}

function validPassage(text: string): boolean {
  const t = cleanPassage(text);
  if (t.length < 40) return false;
  if (tokens(t).length < 6) return false;
  // Reject lines that are clearly metadata, not prose.
  if (/^(https?:\/\/|doi:|source\b)/i.test(t)) return false;
  return true;
}

/**
 * Parse a similarity report (extracted PDF pages) into matched passages.
 *
 * Heuristics for common report formats:
 *  - numbered match lists ("1. ...", "2) ...")
 *  - "Sources" / "Matches" sections
 *  - quoted passage blocks ("..." / "...")
 *  - similarity percentages near a match (NN%)
 *  - "Source: ..." lines or bare URLs near a match
 *
 * Returns needsManualReview=true when nothing could be parsed so the UI
 * can offer the manual "add passage" fallback and an "unparsed report" state.
 */
export function parseSimilarityReport(pages: ExtractedPage[]): ParsedReport {
  const fullText = pages.map((p) => p.text).join('\n');
  const lines = fullText.split('\n').map((l) => l.trim());
  const candidates: Candidate[] = [];

  // 1) Section-based + numbered-list parsing.
  let inSection = false;
  let current: string[] = [];
  let currentIdx = -1;

  const flushCurrent = () => {
    if (current.length > 0 && currentIdx >= 0) {
      const text = cleanPassage(current.join(' '));
      if (validPassage(text)) {
        const src = nearestSource(lines, currentIdx);
        candidates.push({
          text,
          sourceLabel: src.label,
          sourceDetail: src.detail,
          similarityPct: nearestPercent(lines, currentIdx),
        });
      }
    }
    current = [];
    currentIdx = -1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION_RE.test(line)) {
      flushCurrent();
      inSection = true;
      continue;
    }
    if (isJunkLine(line)) continue;
    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      flushCurrent();
      inSection = true;
      currentIdx = i;
      const rest = numbered[2].trim();
      // The number might prefix a source label line ("1. example.com, 12%").
      if (validPassage(rest) || PCT_RE.test(rest)) {
        current = [rest];
      } else {
        const src = nearestSource(lines, i);
        // Keep it as a source hint even if no passage text follows.
        if (src.label) {
          candidates.push({
            text: '',
            sourceLabel: src.label,
            sourceDetail: src.detail,
            similarityPct: nearestPercent(lines, i),
          });
        }
        current = [];
        currentIdx = -1;
      }
      continue;
    }
    if (inSection && currentIdx >= 0) {
      if (/^\d{1,3}[.)\]:]/.test(line)) {
        // handled above; safety net
        continue;
      }
      // Metadata lines belong to the match but are not passage prose.
      if (SOURCE_LINE_RE.test(line) || URL_RE.test(line) || /^\d{1,3}(?:\.\d+)?\s*%$/.test(line)) {
        continue;
      }
      current.push(line);
    }
  }
  flushCurrent();

  // 2) Quoted passage blocks anywhere in the text.
  let qm: RegExpExecArray | null;
  QUOTED_RE.lastIndex = 0;
  while ((qm = QUOTED_RE.exec(fullText)) !== null) {
    const text = cleanPassage(qm[1]);
    if (!validPassage(text)) continue;
    // Find the line index of this quote for nearby % / source lookup.
    const before = fullText.slice(0, qm.index);
    const lineIdx = before.split('\n').length - 1;
    const src = nearestSource(lines, lineIdx);
    candidates.push({
      text,
      sourceLabel: src.label,
      sourceDetail: src.detail,
      similarityPct: nearestPercent(lines, lineIdx),
    });
  }

  // 3) Merge, drop empty/source-only candidates, dedupe by normalized text.
  const seen = new Set<string>();
  const passages: ParsedPassage[] = [];
  for (const c of candidates) {
    const text = cleanPassage(c.text);
    if (!validPassage(text)) continue;
    const key = normalizeText(text).slice(0, 200);
    if (seen.has(key)) continue;
    seen.add(key);
    passages.push({
      text,
      sourceLabel: c.sourceLabel,
      sourceDetail: c.sourceDetail,
      similarityPct: c.similarityPct,
    });
  }

  // Prefer longer, more passage-like candidates when the report is noisy.
  passages.sort((a, b) => b.text.length - a.text.length);

  return { passages, needsManualReview: passages.length === 0 };
}
