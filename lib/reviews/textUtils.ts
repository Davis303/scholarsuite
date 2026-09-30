/**
 * Text normalization helpers shared by the similarity-review module.
 * Used for fuzzy matching, span location, and highlight rendering.
 */

// Built via `new RegExp` (rather than literals) so the file compiles under
// older TS targets while still using full Unicode property escapes at runtime.
const PUNCT_OR_SPACE_RE = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
const WHITESPACE_RUN_RE = /\s+/g;
const WORD_CHAR_RE = new RegExp('[\\p{L}\\p{N}]', 'u');
const WHITESPACE_CHAR_RE = /\s/;

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(PUNCT_OR_SPACE_RE, ' ')
    .replace(WHITESPACE_RUN_RE, ' ')
    .trim();
}

/** Split normalized text into tokens. */
export function tokens(s: string): string[] {
  const n = normalizeText(s);
  return n ? n.split(' ') : [];
}

interface NormMap {
  /** Normalized text. */
  norm: string;
  /** normMap[i] = index in the original string of the char that produced norm[i]. */
  map: number[];
}

/**
 * Normalize a string while keeping a map from each normalized character
 * back to its position in the original string. Punctuation is dropped,
 * runs of whitespace collapse to a single space.
 */
export function normalizeWithMap(s: string): NormMap {
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (WORD_CHAR_RE.test(ch)) {
      norm += ch.toLowerCase();
      map.push(i);
    } else if (WHITESPACE_CHAR_RE.test(ch)) {
      if (norm.length > 0 && norm[norm.length - 1] !== ' ') {
        norm += ' ';
        map.push(i);
      }
    }
    // other characters (punctuation) are dropped
  }
  // Trim leading/trailing collapsed spaces and keep the map aligned.
  let start = 0;
  let end = norm.length;
  while (start < end && norm[start] === ' ') start++;
  while (end > start && norm[end - 1] === ' ') end--;
  return { norm: norm.slice(start, end), map: map.slice(start, end) };
}

export interface TextSpan {
  /** Start offset in the ORIGINAL string (inclusive). */
  start: number;
  /** End offset in the ORIGINAL string (exclusive). */
  end: number;
}

/**
 * Locate `needle` inside `haystack` using normalized (case/whitespace/
 * punctuation-insensitive) matching, returning offsets in the original
 * haystack string. Falls back to progressively shorter prefixes of the
 * needle so wrapped/truncated lines can still be located.
 * Returns null when nothing plausible is found.
 */
export function findSpan(haystack: string, needle: string): TextSpan | null {
  const h = normalizeWithMap(haystack);
  const n = normalizeWithMap(needle);
  if (n.norm.length < 10 || h.norm.length < 10) return null;

  // Try the full needle first, then shorter prefixes (for wrapped lines).
  let len = n.norm.length;
  const minLen = Math.min(40, n.norm.length);
  while (len >= minLen) {
    const sub = n.norm.slice(0, len);
    const idx = h.norm.indexOf(sub);
    if (idx >= 0) {
      const start = h.map[idx] ?? 0;
      const lastIdx = idx + sub.length - 1;
      const end = (h.map[lastIdx] ?? haystack.length - 1) + 1;
      if (end > start) return { start, end };
      return null;
    }
    if (len === minLen) break;
    len = Math.max(minLen, Math.floor(len * 0.75));
  }
  return null;
}
