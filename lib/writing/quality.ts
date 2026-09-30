/**
 * Rule-based quality check for AI-generated revisions.
 *
 * Runs server-side after every improvement generation, before the revision is
 * saved. Checks: no em dash, citations preserved, numbers/names unchanged.
 * Callers retry generation up to 2 times when the check fails.
 */

import type { QualityCheckResult } from "./types";

const EM_DASH_RE = /—/;

const CITATION_RES = [
  // (Author, Year) and (Author et al., Year)
  /\([A-Z][A-Za-z'’\-]+(?:\s+et al\.?)?(?:\s*,\s*\d{4}[a-z]?)(?:\s*;\s*[^)]+)?\)/g,
  // Author (Year)
  /\b[A-Z][A-Za-z'’\-]+(?:\s+et al\.?)?\s*\(\d{4}[a-z]?\)/g,
  // Numbered [1], [2, 3]
  /\[\d+(?:\s*,\s*\d+)*\]/g,
  // DOI
  /\b10\.\d{4,}\/[^\s)]+/gi,
];

function normalizeToken(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractCitations(text: string): string[] {
  const found = new Set<string>();
  for (let ri = 0; ri < CITATION_RES.length; ri += 1) {
    const re = CITATION_RES[ri];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      found.add(normalizeToken(m[0]));
    }
  }
  return Array.from(found);
}

function extractNumbers(text: string): string[] {
  const m = text.match(/\b\d[\d,.\-/%]*\b/g);
  return (m ?? []).map(normalizeToken);
}

function extractNames(text: string): string[] {
  // Capitalized words of length >= 3 that are not sentence starts.
  const names = new Set<string>();
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (let si = 0; si < sentences.length; si += 1) {
    const s = sentences[si];
    const m = s.match(/\b[A-Z][a-z]{2,}\b/g);
    if (!m) continue;
    for (let i = 0; i < m.length; i += 1) {
      if (i === 0) continue; // skip sentence-initial word
      names.add(normalizeToken(m[i]));
    }
  }
  return Array.from(names);
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "these", "those",
  "which", "when", "where", "while", "their", "there", "they", "them",
]);

function keywordOverlap(original: string, revised: string): number {
  const origWords = new Set(
    original
      .toLowerCase()
      .match(/[a-z0-9'-]+/g)
      ?.filter((w) => w.length > 4 && !STOPWORDS.has(w)) ?? []
  );
  if (origWords.size === 0) return 1;
  const revisedText = revised.toLowerCase();
  let kept = 0;
  const origWordList = Array.from(origWords);
  for (let wi = 0; wi < origWordList.length; wi += 1) {
    if (revisedText.includes(origWordList[wi])) kept += 1;
  }
  return kept / origWords.size;
}

export function qualityCheck(
  originalText: string,
  revisedText: string
): QualityCheckResult {
  const failures: string[] = [];
  const original = originalText.trim();
  const revised = revisedText.trim();

  if (revised.length === 0) {
    return { pass: false, failures: ["The revision came back empty."] };
  }

  if (EM_DASH_RE.test(revised)) {
    failures.push("The revision contains an em dash, which is not allowed.");
  }

  // Citation preservation: every citation token in the original must appear
  // in the revision.
  const citations = extractCitations(original);
  for (let ci = 0; ci < citations.length; ci += 1) {
    const cite = citations[ci];
    if (!normalizeToken(revised).includes(cite)) {
      failures.push(`A citation from the original is missing in the revision: ${cite}`);
    }
  }

  // Numbers: every number token in the original must appear in the revision.
  const origNumbers = extractNumbers(original);
  const revisedNumbers = new Set(extractNumbers(revised));
  for (let ni = 0; ni < origNumbers.length; ni += 1) {
    const n = origNumbers[ni];
    if (!revisedNumbers.has(n)) {
      failures.push(`A number from the original is missing or changed in the revision: ${n}`);
    }
  }

  // Names: capitalized names in the original should survive the revision.
  const origNames = extractNames(original);
  const revisedLower = normalizeToken(revised);
  for (let nmi = 0; nmi < origNames.length; nmi += 1) {
    const name = origNames[nmi];
    if (!revisedLower.includes(name)) {
      failures.push(`A name from the original is missing in the revision: ${name}`);
      break; // one failure entry is enough for names
    }
  }

  // Meaning proxy: substantial keyword overlap between original and revision.
  const overlap = keywordOverlap(original, revised);
  if (overlap < 0.4) {
    failures.push(
      "The revision diverges too far from the original wording; meaning may not be preserved."
    );
  }

  return { pass: failures.length === 0, failures };
}

/**
 * Generate a revision with automatic retry: on quality-check failure,
 * regenerate up to `maxRetries` (default 2) before surfacing the result.
 */
export async function generateWithQualityRetry(
  generate: () => Promise<string>,
  originalText: string,
  maxRetries = 2
): Promise<{ revisedText: string; quality: QualityCheckResult; attempts: number }> {
  let lastRevised = "";
  let lastQuality: QualityCheckResult = {
    pass: false,
    failures: ["No revision was generated."],
  };
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    lastRevised = (await generate()).trim();
    lastQuality = qualityCheck(originalText, lastRevised);
    if (lastQuality.pass) {
      return { revisedText: lastRevised, quality: lastQuality, attempts: attempt + 1 };
    }
  }
  return { revisedText: lastRevised, quality: lastQuality, attempts: maxRetries + 1 };
}
