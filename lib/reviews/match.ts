import type { MatchDocPage } from './extract';
import type { ParsedPassage } from './parseReport';
import { normalizeText, tokens } from './textUtils';

export interface MappedPassage {
  /** 1-based page number in the match-page model. */
  pageNumber: number;
  /** Surrounding paragraph text where the passage was found ('' if not found). */
  paragraphText: string;
  /** 0..1 confidence score. */
  confidence: number;
  /** True when confidence is high enough to trust without verification. */
  verified: boolean;
}

/** Minimum confidence to consider a mapping trustworthy. */
export const VERIFIED_CONFIDENCE = 0.55;
/** Below this, the passage is treated as unmapped. */
const MIN_CONFIDENCE = 0.3;

function tokenOverlapScore(passageTokens: Set<string>, paraTokens: string[]): number {
  if (passageTokens.size === 0) return 0;
  let hits = 0;
  const paraSet = new Set(paraTokens);
  passageTokens.forEach((t) => {
    if (paraSet.has(t)) hits++;
  });
  return hits / passageTokens.size;
}

function scorePassageInParagraph(
  passageNorm: string,
  passageTokenSet: Set<string>,
  paraText: string,
): number {
  const paraNorm = normalizeText(paraText);
  if (!paraNorm) return 0;
  // Strong signal: the passage appears verbatim (modulo case/whitespace/punct).
  if (paraNorm.includes(passageNorm.slice(0, Math.min(passageNorm.length, 400)))) {
    return 0.98;
  }
  // Partial containment of a long prefix also scores well.
  const prefixLen = Math.min(120, passageNorm.length);
  if (prefixLen >= 60 && paraNorm.includes(passageNorm.slice(0, prefixLen))) {
    return 0.9;
  }
  // Fallback: token overlap, fraction of passage tokens present in paragraph.
  return tokenOverlapScore(passageTokenSet, tokens(paraNorm));
}

/**
 * Map parsed report passages onto document pages/paragraphs with
 * normalized fuzzy matching (case/whitespace/punctuation-insensitive,
 * token-overlap scoring). Low-confidence mappings are flagged via
 * `verified: false` so the reviewer verifies them manually.
 */
export function mapPassagesToDocument(
  passages: ParsedPassage[],
  docPages: MatchDocPage[],
): MappedPassage[] {
  return passages.map((passage) => {
    const passageNorm = normalizeText(passage.text);
    const passageTokenSet = new Set(tokens(passageNorm));

    let best = { pageNumber: 1, paragraphText: '', confidence: 0 };

    for (const page of docPages) {
      for (const para of page.paragraphs) {
        if (para.length < 10) continue;
        const score = scorePassageInParagraph(passageNorm, passageTokenSet, para);
        if (score > best.confidence) {
          best = { pageNumber: page.pageNumber, paragraphText: para, confidence: score };
        }
      }
    }

    if (best.confidence < MIN_CONFIDENCE) {
      return {
        pageNumber: docPages[0]?.pageNumber ?? 1,
        paragraphText: '',
        confidence: best.confidence,
        verified: false,
      };
    }

    return {
      pageNumber: best.pageNumber,
      paragraphText: best.paragraphText,
      confidence: Math.min(1, best.confidence),
      verified: best.confidence >= VERIFIED_CONFIDENCE,
    };
  });
}
