/**
 * Citation detection near matched passages.
 * Regex heuristics only, never treated as proof of proper citation,
 * just a signal for the reviewer to verify.
 */

export type CitationStyle = 'apa' | 'harvard' | 'numbered' | 'author-year';

export interface CitationDetection {
  detected: boolean;
  style: CitationStyle | null;
  match: string | null;
}

// APA: (Smith, 2020), (Smith & Jones, 2021), (Smith et al., 2019), (WHO, 2022)
const APA_RE =
  /\(([A-Z][A-Za-z][A-Za-z\-']*(?:\s+(?:et al\.?|&\s*[A-Z][A-Za-z\-']+))?,\s*\d{4}[a-z]?)\)/;
// Harvard / author-year: Smith (2020), Smith and Jones (2021)
const HARVARD_RE =
  /\b[A-Z][a-z][a-z\-']*(?:\s+(?:and|&)\s+[A-Z][a-z][a-z\-']*)?\s*\(\d{4}[a-z]?\)/;
// Numbered: [12], [3, 4], [5-7]
const NUMBERED_RE = /\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\]/;
// Author-year narrative: "as described by Smith 2020"
const AUTHOR_YEAR_RE =
  /\b(?:by|in|see|cf\.?|e\.g\.?)\s+[A-Z][A-Za-z\-']+(?:\s+et al\.?)?,?\s+\(?\d{4}[a-z]?\)?/i;

/**
 * Look for a citation in (or immediately around) a paragraph of text.
 * Checks the paragraph itself plus an optional trailing window, since
 * citations often sit at the end of the sentence following a passage.
 */
export function detectCitationNearby(paragraph: string): CitationDetection {
  const text = paragraph.slice(0, 4000);
  const checks: Array<[CitationStyle, RegExp]> = [
    ['apa', APA_RE],
    ['numbered', NUMBERED_RE],
    ['harvard', HARVARD_RE],
    ['author-year', AUTHOR_YEAR_RE],
  ];
  for (const [style, re] of checks) {
    const m = re.exec(text);
    if (m) {
      return { detected: true, style, match: m[0].slice(0, 120) };
    }
  }
  return { detected: false, style: null, match: null };
}

export function citationStyleLabel(style: CitationStyle | null): string {
  switch (style) {
    case 'apa':
      return 'APA style';
    case 'harvard':
      return 'Harvard style';
    case 'numbered':
      return 'Numbered style';
    case 'author-year':
      return 'Author–year';
    default:
      return 'Not detected';
  }
}
