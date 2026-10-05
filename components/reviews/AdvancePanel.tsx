'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import {
  buildCitation,
  extractKeyTerms,
  suggestFix,
  wordingOverlap,
  CITATION_STYLES,
  type CitationStyleId,
} from '@/lib/reviews/fixSuggestions';
import type { PassageStatus } from '@/lib/reviews/types';
import type { WorkspacePassage } from './WorkspaceClient';

interface Props {
  passage: WorkspacePassage;
  referencesText: string | null;
  saving: boolean;
  onSetStatus: (status: PassageStatus) => void;
}

function load(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode, draft just will not persist */
  }
}

export function AdvancePanel({ passage, referencesText, saving, onSetStatus }: Props) {
  const suggestion = useMemo(
    () =>
      suggestFix({
        passageText: passage.passageText,
        paragraphText: passage.paragraphText,
        sourceLabel: passage.sourceLabel,
        sourceDetail: passage.sourceDetail,
        similarityPct: passage.similarityPct,
        citationDetected: passage.citationDetected,
        verified: passage.verified,
        confidence: passage.confidence,
        referencesText,
      }),
    [passage, referencesText],
  );

  const [style, setStyle] = useState<CitationStyleId>('apa');
  const citation = useMemo(
    () => buildCitation(style, passage.sourceLabel),
    [style, passage.sourceLabel],
  );
  const [copied, setCopied] = useState(false);

  const draftKey = `advance:${passage.id}:draft`;
  const termsKey = `advance:${passage.id}:terms`;
  const [draft, setDraft] = useState<string>(() => load(draftKey));
  const keyTerms = useMemo(
    () => extractKeyTerms(passage.passageText),
    [passage.passageText],
  );
  const [covered, setCovered] = useState<string[]>(() => {
    try {
      return JSON.parse(load(termsKey) || '[]') as string[];
    } catch {
      return [];
    }
  });
  const overlap = wordingOverlap(draft, passage.passageText);

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(
        `In text: ${citation.inText}\nReference: ${citation.reference}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const toggleTerm = (term: string) => {
    setCovered((prev) => {
      const next = prev.includes(term)
        ? prev.filter((t) => t !== term)
        : [...prev, term];
      save(termsKey, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="mt-4 space-y-4 border-t-2 border-amber-300 pt-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">
          Advance: Instant Fix Suggestions
        </h4>
        <p className="mt-0.5 text-xs text-slate-500">
          Built only from the report and this document. Nothing here rewrites
          text or changes the original file.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-900">{suggestion.title}</p>
        <p className="mt-1 text-xs leading-5 text-amber-800">{suggestion.reason}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-amber-900">
          {suggestion.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {suggestion.quotedPreview && (
          <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-amber-200 bg-white p-2 text-[13px] leading-6 text-slate-800">
            {suggestion.quotedPreview}
          </div>
        )}
        {suggestion.applyStatus && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={saving}
            onClick={() => onSetStatus(suggestion.applyStatus!)}
          >
            {suggestion.applyLabel}
          </Button>
        )}
        {suggestion.mappingNote && (
          <p className="mt-2 text-xs text-amber-800">{suggestion.mappingNote}</p>
        )}
      </div>

      {suggestion.reference.label && (
        <div
          className={
            suggestion.reference.status === 'found'
              ? 'rounded-lg border border-green-200 bg-green-50 p-3 text-xs leading-5 text-green-800'
              : suggestion.reference.status === 'missing'
                ? 'rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800'
                : 'rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600'
          }
        >
          {suggestion.reference.label}
        </div>
      )}

      <div>
        <Select
          label="Citation builder"
          value={style}
          onChange={(e) => setStyle(e.target.value as CitationStyleId)}
        >
          {CITATION_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <div className="mt-2 space-y-2 text-[13px] leading-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <span className="font-medium text-slate-700">In text: </span>
            <span className="text-slate-800">{citation.inText}</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <span className="font-medium text-slate-700">Reference: </span>
            <span className="text-slate-800">{citation.reference}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{citation.note}</p>
        <Button variant="tertiary" size="sm" className="mt-1" onClick={copyCitation}>
          {copied ? 'Copied' : 'Copy citation'}
        </Button>
      </div>

      <div>
        <Textarea
          label="Write It Yourself"
          rows={4}
          placeholder="If this passage needs your own words, write them here yourself. Use the checklist so the main points are covered."
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            save(draftKey, e.target.value);
          }}
        />
        {keyTerms.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-slate-600">
              Main points to cover in your own words ({covered.length} of{' '}
              {keyTerms.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {keyTerms.map((t) => {
                const on = covered.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTerm(t)}
                    className={
                      on
                        ? 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'
                        : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600'
                    }
                  >
                    {on ? '✓ ' : ''}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {overlap !== null && (
          <p className="mt-2 text-xs text-slate-500">
            Wording overlap with the matched text: {overlap}%. Lower means the
            wording is more your own. This is guidance for your writing, not a
            score to aim at.
          </p>
        )}
      </div>
    </div>
  );
}
