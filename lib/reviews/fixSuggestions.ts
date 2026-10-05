/**
 * Advance: Instant Fix Suggestions.
 *
 * Deterministic, rule based suggestions for a matched passage. Every
 * suggestion is derived only from data that already exists in the app:
 * the similarity report (matched text, source label, percentage), the
 * document itself (paragraph the match was found in, citation detected
 * nearby) and fixed citation style templates. Nothing is invented:
 * source details the report does not carry are left as clearly marked
 * placeholders for the human to fill from the source itself.
 *
 * This module never rewrites text and never changes the document. It
 * tells the reviewer what kind of fix a passage needs, and the human
 * decides and applies it.
 */

import type { PassageStatus } from './types';

export type FixKind =
  | 'verify_location'
  | 'common_phrase'
  | 'properly_handled'
  | 'add_quotes'
  | 'cited_ok'
  | 'add_citation';

export interface FixSuggestionInput {
  passageText: string;
  paragraphText: string | null;
  sourceLabel: string | null;
  sourceDetail: string | null;
  similarityPct: number | null;
  citationDetected: boolean;
  verified: boolean;
}

export interface FixSuggestion {
  kind: FixKind;
  title: string;
  reason: string;
  steps: string[];
  /** Verdict the reviewer can apply once the fix is done by hand. */
  applyStatus: PassageStatus | null;
  applyLabel: string | null;
  /** Passage wrapped in quotation marks, shown when quotes are the fix. */
  quotedPreview: string | null;
}

const QUOTE_CHARS = ['"', '“', '”', '‘', '’', "'"];

/** Is the matched passage already wrapped in quotation marks in its paragraph? */
export function isQuotedInParagraph(
  paragraph: string | null,
  passage: string,
): boolean {
  if (!paragraph) return false;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const para = norm(paragraph);
  const pass = norm(passage);
  if (pass.length < 12) return false;
  const probe = pass.slice(0, 40);
  const idx = para.indexOf(probe);
  if (idx < 0) return false;
  const before = idx > 0 ? para[idx - 1] : '';
  const afterIdx = idx + pass.length;
  const after = afterIdx < para.length ? para[afterIdx] : '';
  return QUOTE_CHARS.includes(before) && QUOTE_CHARS.includes(after);
}

export function suggestFix(input: FixSuggestionInput): FixSuggestion {
  const { passageText, paragraphText, similarityPct, citationDetected } = input;

  if (!paragraphText || !input.verified) {
    return {
      kind: 'verify_location',
      title: 'Verify this match by hand',
      reason:
        'This match could not be located in the document with enough confidence, so no fix is suggested automatically.',
      steps: [
        'Find this text in the original document yourself.',
        'If the same text is there, check its citation by hand, then set the review status.',
        'If the text is not in the document, leave it as needs review and note why.',
      ],
      applyStatus: 'source_verification',
      applyLabel: 'Mark as source verification',
      quotedPreview: null,
    };
  }

  if (
    similarityPct !== null &&
    similarityPct <= 3 &&
    passageText.trim().length < 90
  ) {
    return {
      kind: 'common_phrase',
      title: 'Short, common phrase',
      reason:
        'This is a short match with a low share of the document. Phrases like this are often common academic wording rather than copied text.',
      steps: [
        'Read the phrase in context and decide if it is common knowledge or standard wording in the field.',
        'If it is, mark it as common knowledge. If it came from the source, add the citation instead.',
      ],
      applyStatus: 'common_knowledge',
      applyLabel: 'Mark as common knowledge',
      quotedPreview: null,
    };
  }

  const quoted = isQuotedInParagraph(paragraphText, passageText);

  if (citationDetected && quoted) {
    return {
      kind: 'properly_handled',
      title: 'Looks properly quoted and cited',
      reason:
        'The passage sits inside quotation marks and a citation was detected nearby. Check the citation is complete and matches the source.',
      steps: [
        'Confirm the quotation is exact and the citation names this source.',
        'Confirm the source also appears in the reference list.',
      ],
      applyStatus: 'direct_quote',
      applyLabel: 'Mark as direct quote',
      quotedPreview: null,
    };
  }

  if (citationDetected && !quoted) {
    const longOrHigh =
      passageText.trim().length >= 120 || (similarityPct ?? 0) >= 8;
    if (longOrHigh) {
      return {
        kind: 'add_quotes',
        title: 'Add quotation marks',
        reason:
          'This text follows the source closely and a citation was detected nearby, but the text is not inside quotation marks, so it reads as the writer\'s own words.',
        steps: [
          'Put the matched text inside quotation marks in the document, exactly as shown below.',
          'Keep the existing citation right after the closing quote.',
          'Make sure the source is also in the reference list.',
        ],
        applyStatus: 'direct_quote',
        applyLabel: 'Done, mark as direct quote',
        quotedPreview: `“${passageText.trim()}”`,
      };
    }
    return {
      kind: 'cited_ok',
      title: 'Citation found nearby',
      reason:
        'A citation was detected near this match. Confirm it names this source and that the wording is the writer\'s own summary, not a copy.',
      steps: [
        'Check the nearby citation matches the source named in the report.',
        'Check the source appears in the reference list.',
      ],
      applyStatus: 'properly_cited',
      applyLabel: 'Mark as properly cited',
      quotedPreview: null,
    };
  }

  return {
    kind: 'add_citation',
    title: 'Citation missing',
    reason:
      'No citation was detected near this match. Copied or closely followed text without a citation is the item that most needs attention.',
    steps: [
      'Either add a citation for this source, using the builder below, or rewrite the passage in your own words using the Write It Yourself box below.',
      'If you quote the source word for word, use quotation marks as well.',
      'Add the source to the reference list if it is not there.',
    ],
    applyStatus: 'citation_check',
    applyLabel: 'Mark as citation check',
    quotedPreview: null,
  };
}

/* ---------------- Citation builder ---------------- */

export type CitationStyleId = 'apa' | 'harvard' | 'mla' | 'numbered';

export const CITATION_STYLES: Array<{ id: CitationStyleId; label: string }> = [
  { id: 'apa', label: 'APA 7' },
  { id: 'harvard', label: 'Harvard' },
  { id: 'mla', label: 'MLA 9' },
  { id: 'numbered', label: 'Numbered (IEEE)' },
];

type SourceKind = 'website' | 'journal' | 'unpublished' | 'unknown';

function classifySource(sourceLabel: string | null): { kind: SourceKind; name: string; url: string | null; institution: string | null } {
  const label = (sourceLabel ?? '').trim();
  if (!label) return { kind: 'unknown', name: '', url: null, institution: null };
  if (/^submitted to\s+/i.test(label)) {
    return {
      kind: 'unpublished',
      name: label,
      url: null,
      institution: label.replace(/^submitted to\s+/i, ''),
    };
  }
  const domainMatch = label.match(/^((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\s|$)/i);
  if (domainMatch || /^[a-z0-9-]+\.[a-z]{2,}$/i.test(label)) {
    const domain = domainMatch ? domainMatch[1] : label;
    return { kind: 'website', name: domain, url: `https://${domain}`, institution: null };
  }
  if (/journal/i.test(label)) {
    return { kind: 'journal', name: label, url: null, institution: null };
  }
  return { kind: 'unknown', name: label, url: null, institution: null };
}

/**
 * Build an in-text citation hint and a reference entry for a source.
 * Only facts present in the report are filled in. Everything else is a
 * bracketed placeholder the human must complete from the source itself.
 */
export function buildCitation(
  style: CitationStyleId,
  sourceLabel: string | null,
): { inText: string; reference: string; note: string } {
  const { kind, name, url, institution } = classifySource(sourceLabel);
  const note =
    'Parts in [brackets] are not in the similarity report. Fill them from the source itself, the tool never guesses them.';

  if (kind === 'website' && url) {
    switch (style) {
      case 'apa':
        return {
          inText: '([Author Surname], [Year])',
          reference: `[Author, A. A.]. ([Year]). [Title of page]. ${name}. ${url}`,
          note,
        };
      case 'harvard':
        return {
          inText: '([Author Surname], [Year])',
          reference: `[Author Surname, Initial]. ([Year]) [Title of page]. Available at: ${url} [Accessed Day Month Year].`,
          note,
        };
      case 'mla':
        return {
          inText: '([Author Surname] [page, if any])',
          reference: `[Author]. "[Title of Page]." ${name}, [Day Month Year], ${url}.`,
          note,
        };
      case 'numbered':
        return {
          inText: '[[n]]',
          reference: `[[n]] [Author], "[Title of page]," ${name}. [Online]. Available: ${url}`,
          note,
        };
    }
  }

  if (kind === 'journal') {
    switch (style) {
      case 'apa':
        return {
          inText: '([Author Surname], [Year])',
          reference: `[Author, A. A.]. ([Year]). [Article title]. ${name}, [volume]([issue]), [pages].`,
          note,
        };
      case 'harvard':
        return {
          inText: '([Author Surname], [Year])',
          reference: `[Author Surname, Initial]. ([Year]) '[Article title]', ${name}, [volume]([issue]), pp. [pages].`,
          note,
        };
      case 'mla':
        return {
          inText: '([Author Surname] [page])',
          reference: `[Author]. "[Article Title]." ${name}, vol. [volume], no. [issue], [Year], pp. [pages].`,
          note,
        };
      case 'numbered':
        return {
          inText: '[[n]]',
          reference: `[[n]] [Author], "[Article title]," ${name}, vol. [volume], no. [issue], pp. [pages], [Year].`,
          note,
        };
    }
  }

  if (kind === 'unpublished') {
    const inst = institution ?? '[Institution]';
    switch (style) {
      case 'apa':
        return {
          inText: '([Author Surname], [Year])',
          reference: `[Author, A. A.]. ([Year]). [Title of work] [Unpublished work]. ${inst}.`,
          note,
        };
      case 'harvard':
        return {
          inText: '([Author Surname], [Year])',
          reference: `[Author Surname, Initial]. ([Year]) [Title of work]. Unpublished work, ${inst}.`,
          note,
        };
      case 'mla':
        return {
          inText: '([Author Surname] [page, if any])',
          reference: `[Author]. "[Title of Work]." [Year]. Unpublished work, ${inst}.`,
          note,
        };
      case 'numbered':
        return {
          inText: '[[n]]',
          reference: `[[n]] [Author], "[Title of work]," unpublished work, ${inst}, [Year].`,
          note,
        };
    }
  }

  const genericName = name || '[Source name from the report]';
  return {
    inText: '([Author Surname], [Year])',
    reference: `[Author]. ([Year]). [Title]. Source as named in the report: ${genericName}. Add the publisher or site and link from the source itself.`,
    note,
  };
}

/* ---------------- Write It Yourself helpers ---------------- */

const STOPWORDS = new Set(
  ('the a an and or but if while of at by for with about against between into through during before after above below to from up down in out on off over under again further then once is are was were be been being have has had having do does did doing would should could ought i you he she it we they this that these those am as so than too very can will just not no nor').split(' '),
);

/** Key terms of the matched passage, as a coverage checklist for the writer. */
export function extractKeyTerms(text: string, max = 8): string[] {
  const counts = new Map<string, { count: number; display: string }>();
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'-]{4,}/g)) {
    const w = m[0];
    const lower = w.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    const entry = counts.get(lower);
    if (entry) entry.count += 1;
    else counts.set(lower, { count: 1, display: w });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .slice(0, max)
    .map((e) => e.display);
}

function significantTokens(text: string): Set<string> {
  const set = new Set<string>();
  for (const m of text.toLowerCase().matchAll(/[a-z][a-z'-]{3,}/g)) {
    if (!STOPWORDS.has(m[0])) set.add(m[0]);
  }
  return set;
}

/**
 * Share of the matched passage's key wording that also appears in the
 * writer's own draft. Guidance for the writer only, it shows how close
 * the draft still sits to the source wording. It is not a target score.
 */
export function wordingOverlap(draft: string, passage: string): number | null {
  if (!draft.trim()) return null;
  const source = significantTokens(passage);
  if (source.size === 0) return null;
  const mine = significantTokens(draft);
  let shared = 0;
  for (const t of source) if (mine.has(t)) shared += 1;
  return Math.round((shared / source.size) * 100);
}
