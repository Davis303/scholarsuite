'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  PASSAGE_STATUS_OPTIONS,
  PassageStatusBadge,
  ReviewStatusBadge,
} from './StatusBadge';
import { ExportButtons } from './ExportButtons';
import { AddPassageModal, type AddedPassage } from './AddPassageModal';
import { findSpan, normalizeText } from '@/lib/reviews/textUtils';
import type { PassageStatus } from '@/lib/reviews/types';

export interface WorkspaceBlock {
  key: string;
  kind: 'heading' | 'paragraph' | 'list-item';
  level: number;
  ordered: boolean;
  text: string;
}

export interface WorkspacePage {
  pageNumber: number;
  blocks: WorkspaceBlock[];
}

export interface WorkspacePassage {
  id: string;
  matchIndex: number;
  pageNumber: number | null;
  passageText: string;
  paragraphText: string | null;
  sourceLabel: string | null;
  sourceDetail: string | null;
  similarityPct: number | null;
  citationDetected: boolean;
  status: PassageStatus;
  reviewerNote: string | null;
  verified: boolean;
}

export interface WorkspaceReview {
  id: string;
  title: string;
  status: 'processing' | 'ready' | 'review_required' | 'completed' | 'failed';
  documentId: string;
}

interface Span {
  start: number;
  end: number;
  matchIdx: number;
}

function renderHighlighted(
  text: string,
  spans: Span[],
  selectedIdx: number,
  onSelect: (idx: number) => void,
): ReactNode {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const nodes: ReactNode[] = [];
  let pos = 0;
  sorted.forEach((s, i) => {
    const start = Math.max(s.start, pos);
    if (start > pos) {
      nodes.push(<span key={`t-${i}`}>{text.slice(pos, start)}</span>);
    }
    if (s.end > start) {
      const selected = s.matchIdx === selectedIdx;
      nodes.push(
        <mark
          key={`m-${i}`}
          onClick={() => onSelect(s.matchIdx)}
          title={`Similarity Match ${s.matchIdx + 1} — select to review`}
          className={
            selected
              ? 'cursor-pointer rounded-sm bg-amber-300 ring-2 ring-amber-500'
              : 'cursor-pointer rounded-sm bg-yellow-200/70 hover:bg-yellow-300/70'
          }
        >
          {text.slice(start, s.end)}
        </mark>,
      );
      pos = s.end;
    }
  });
  if (pos < text.length) {
    nodes.push(<span key="t-end">{text.slice(pos)}</span>);
  }
  return <>{nodes}</>;
}

export function WorkspaceClient({
  review,
  documentName,
  originalKind,
  pages,
  initialPassages,
}: {
  review: WorkspaceReview;
  documentName: string;
  originalKind: 'docx' | 'pdf';
  pages: WorkspacePage[];
  initialPassages: WorkspacePassage[];
}) {
  const [passages, setPassages] = useState<WorkspacePassage[]>(initialPassages);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const blockRefs = useRef(new Map<string, HTMLElement>());
  const router = useRouter();
  const { toast } = useToast();

  const selected = passages[selectedIdx] ?? null;

  // Reset the note draft when the selection changes.
  useEffect(() => {
    setNoteDraft(selected?.reviewerNote ?? '');
  }, [selectedIdx, selected?.reviewerNote]);

  // Precompute normalized block text once.
  const blockNorms = useMemo(
    () => pages.map((p) => p.blocks.map((b) => normalizeText(b.text))),
    [pages],
  );

  // Map each document block to the highlight spans it contains.
  const spansByBlock = useMemo(() => {
    const map = new Map<string, Span[]>();
    passages.forEach((p, matchIdx) => {
      if (!p.paragraphText) return;
      const paraNorm = normalizeText(p.paragraphText);
      if (!paraNorm) return;
      pages.forEach((page, pi) => {
        page.blocks.forEach((block, bi) => {
          const bn = blockNorms[pi]?.[bi] ?? '';
          if (!bn) return;
          if (bn.includes(paraNorm) || (paraNorm.length > 60 && paraNorm.includes(bn))) {
            const span =
              findSpan(block.text, p.passageText) ??
              findSpan(block.text, p.paragraphText ?? '');
            if (span) {
              const arr = map.get(block.key) ?? [];
              arr.push({ ...span, matchIdx });
              map.set(block.key, arr);
            }
          }
        });
      });
    });
    return map;
  }, [pages, passages, blockNorms]);

  // First block containing each match (for scroll-to-match).
  const firstBlockForMatch = useMemo(() => {
    const m = new Map<number, string>();
    spansByBlock.forEach((spans, key) => {
      for (const s of spans) {
        if (!m.has(s.matchIdx)) m.set(s.matchIdx, key);
      }
    });
    return m;
  }, [spansByBlock]);

  // Scroll the selected match into view.
  useEffect(() => {
    const key = firstBlockForMatch.get(selectedIdx);
    if (!key) return;
    const el = blockRefs.current.get(key);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedIdx, firstBlockForMatch]);

  const goNext = useCallback(() => {
    setSelectedIdx((i) => (passages.length === 0 ? 0 : Math.min(i + 1, passages.length - 1)));
  }, [passages.length]);

  const goPrev = useCallback(() => {
    setSelectedIdx((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation: j/k and arrow keys move between matches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return passages
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          !q ||
          p.passageText.toLowerCase().includes(q) ||
          (p.sourceLabel ?? '').toLowerCase().includes(q),
      );
  }, [passages, query]);

  const pageMatchCounts = useMemo(() => {
    const m = new Map<number, number>();
    passages.forEach((p) => {
      if (p.pageNumber != null) m.set(p.pageNumber, (m.get(p.pageNumber) ?? 0) + 1);
    });
    return m;
  }, [passages]);

  const scrollToPage = (pageNumber: number) => {
    const el = document.getElementById(`review-page-${pageNumber}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setLeftOpen(false);
  };

  const selectMatch = (idx: number) => {
    setSelectedIdx(idx);
    setLeftOpen(false);
    setRightOpen(true);
  };

  const patchPassage = async (passageId: string, status: PassageStatus, note: string | null) => {
    const res = await fetch(`/api/reviews/${review.id}/passages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passageId, status, reviewerNote: note }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      reviewStatus?: WorkspaceReview['status'];
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? 'The passage could not be updated.');
    }
    return data;
  };

  const handleStatusChange = async (newStatus: PassageStatus) => {
    if (!selected) return;
    setStatusSaving(true);
    try {
      await patchPassage(selected.id, newStatus, noteDraft || null);
      setPassages((prev) =>
        prev.map((p, i) => (i === selectedIdx ? { ...p, status: newStatus, reviewerNote: noteDraft || null } : p)),
      );
      toast('Review status updated.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The passage could not be updated.', 'error');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selected) return;
    setNoteSaving(true);
    try {
      await patchPassage(selected.id, selected.status, noteDraft || null);
      setPassages((prev) =>
        prev.map((p, i) => (i === selectedIdx ? { ...p, reviewerNote: noteDraft || null } : p)),
      );
      toast('Reviewer note saved.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The note could not be saved.', 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.passageText);
      toast('Matched text copied to clipboard.', 'success');
    } catch {
      toast('Could not copy to clipboard.', 'error');
    }
  };

  const handleAdded = (added: AddedPassage) => {
    const newIdx = passages.length;
    const next: WorkspacePassage = {
      id: added.id,
      matchIndex: Math.max(0, ...passages.map((p) => p.matchIndex)) + 1,
      pageNumber: added.pageNumber,
      passageText: added.passageText,
      paragraphText: added.paragraphText,
      sourceLabel: added.sourceLabel,
      sourceDetail: added.sourceDetail,
      similarityPct: added.similarityPct,
      citationDetected: false,
      status: 'needs_review',
      reviewerNote: null,
      verified: added.verified,
    };
    setPassages((prev) => [...prev, next]);
    setSelectedIdx(newIdx);
  };

  const openInWriting = async () => {
    setBridgeLoading(true);
    try {
      const res = await fetch('/api/writing/from-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: review.documentId }),
      });
      const data = (await res.json().catch(() => null)) as {
        writingDocId?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.writingDocId) {
        throw new Error(data?.error ?? 'The Writing Assistant bridge is not available right now.');
      }
      router.push(`/writing/${data.writingDocId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The Writing Assistant bridge is not available right now.', 'error');
    } finally {
      setBridgeLoading(false);
    }
  };

  const setBlockRef = (key: string) => (el: HTMLElement | null) => {
    if (el) blockRefs.current.set(key, el);
    else blockRefs.current.delete(key);
  };

  const renderBlock = (block: WorkspaceBlock) => {
    const spans = spansByBlock.get(block.key) ?? [];
    const content = renderHighlighted(block.text, spans, selectedIdx, selectMatch);
    const ref = setBlockRef(block.key);
    if (block.kind === 'heading') {
      const Tag = (block.level <= 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      const cls =
        Tag === 'h2'
          ? 'mt-6 text-xl font-bold text-slate-900'
          : Tag === 'h3'
            ? 'mt-5 text-lg font-semibold text-slate-900'
            : 'mt-4 text-base font-semibold text-slate-900';
      return (
        <Tag key={block.key} ref={ref} className={`${cls} scroll-mt-24`}>
          {content}
        </Tag>
      );
    }
    if (block.kind === 'list-item') {
      return (
        <div key={block.key} ref={ref} className="flex scroll-mt-24 gap-2">
          <span aria-hidden="true" className="text-slate-500">
            {block.ordered ? '–' : '•'}
          </span>
          <p className="text-[15px] leading-7 text-slate-800">{content}</p>
        </div>
      );
    }
    return (
      <p key={block.key} ref={ref} className="scroll-mt-24 text-[15px] leading-7 text-slate-800">
        {content}
      </p>
    );
  };

  const leftPanel = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <Input
          label="Search matches"
          placeholder="Search passage or source…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="mt-2 text-xs text-slate-500">
          {passages.length} Similarity Match{passages.length === 1 ? '' : 'es'} · Tip: use{' '}
          <kbd className="rounded border border-slate-300 bg-slate-100 px-1">j</kbd> /{' '}
          <kbd className="rounded border border-slate-300 bg-slate-100 px-1">k</kbd> to move
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pages</h3>
        <ul className="mb-6 space-y-1">
          {pages.map((page) => (
            <li key={page.pageNumber}>
              <button
                type="button"
                onClick={() => scrollToPage(page.pageNumber)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              >
                <span>Page {page.pageNumber}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {pageMatchCounts.get(page.pageNumber) ?? 0} matches
                </span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Matches
        </h3>
        {filteredMatches.length === 0 ? (
          <p className="text-sm text-slate-500">No matches found.</p>
        ) : (
          <ul className="space-y-1">
            {filteredMatches.map(({ p, i }) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectMatch(i)}
                  aria-current={i === selectedIdx ? 'true' : undefined}
                  className={`w-full rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${
                    i === selectedIdx
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      Match {p.matchIndex}
                    </span>
                    <PassageStatusBadge status={p.status} />
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    Page {p.pageNumber ?? '—'}
                    {p.sourceLabel ? ` · ${p.sourceLabel}` : ''}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs text-slate-600">
                    {p.passageText.slice(0, 120)}
                    {p.passageText.length > 120 ? '…' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const rightPanel = selected ? (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Match Details</h3>
        <Button variant="tertiary" size="sm" onClick={handleCopy}>
          Copy text
        </Button>
      </div>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Match</dt>
          <dd className="font-semibold text-slate-900">
            Match {selected.matchIndex} of {passages.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Page</dt>
          <dd className="text-slate-800">{selected.pageNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Matched text
          </dt>
          <dd className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-6 text-slate-800">
            {selected.passageText}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Source</dt>
          <dd className="text-slate-800">
            {selected.sourceLabel || <span className="text-slate-400">Not specified in report</span>}
            {selected.sourceDetail && (
              <span className="mt-1 block text-xs text-slate-500">{selected.sourceDetail}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Similarity</dt>
          <dd className="text-slate-800">
            {selected.similarityPct != null ? `${selected.similarityPct}%` : 'Not in report'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Citation</dt>
          <dd>
            {selected.citationDetected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <span aria-hidden="true">✓</span> Citation detected nearby
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                <span aria-hidden="true">○</span> No citation detected
              </span>
            )}
          </dd>
        </div>
        {!selected.verified && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-900">Needs verification</p>
            <p className="mt-0.5 text-xs text-amber-800">
              This match was located with low confidence. Please verify the highlighted
              text is the intended passage.
            </p>
          </div>
        )}
      </dl>
      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
        <Select
          label="Review status"
          value={selected.status}
          disabled={statusSaving}
          onChange={(e) => handleStatusChange(e.target.value as PassageStatus)}
        >
          {PASSAGE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Textarea
          label="Reviewer note"
          rows={3}
          placeholder="Add a note about this match…"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
        />
        <Button variant="secondary" size="sm" loading={noteSaving} onClick={handleSaveNote}>
          Save note
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div>
      {/* Workspace header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{review.title}</h1>
            <ReviewStatusBadge status={review.status} />
          </div>
          <p className="mt-1 truncate text-sm text-slate-500" title={documentName}>
            {documentName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" loading={bridgeLoading} onClick={openInWriting}>
            Open in Writing Assistant
          </Button>
          <ExportButtons reviewId={review.id} originalKind={originalKind} />
          <Button variant="tertiary" onClick={() => setAddOpen(true)}>
            + Add passage manually
          </Button>
        </div>
      </div>

      {passages.length === 0 ? (
        <EmptyState
          title="No matched passages yet"
          description="The similarity report format could not be recognized automatically, or no matches were found. Add passages manually from the report to review them here."
          action={
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add passage manually
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile panel toggles */}
          <div className="mb-3 flex gap-2 lg:hidden">
            <Button variant="secondary" size="sm" onClick={() => setLeftOpen(true)}>
              ☰ Navigation
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRightOpen(true)}>
              Match details
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_330px]">
            {/* Left: navigation (desktop) */}
            <Card className="hidden lg:block">
              <div className="sticky top-4 max-h-[calc(100vh-8rem)] overflow-hidden">
                {leftPanel}
              </div>
            </Card>

            {/* Center: document */}
            <Card className="min-w-0 p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={goPrev} disabled={selectedIdx === 0}>
                    ← Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goNext}
                    disabled={selectedIdx >= passages.length - 1}
                  >
                    Next →
                  </Button>
                </div>
                <p className="text-sm font-medium text-slate-700" aria-live="polite">
                  Match {selectedIdx + 1} of {passages.length}
                </p>
              </div>

              <div className="space-y-8">
                {pages.map((page) => (
                  <section
                    key={page.pageNumber}
                    id={`review-page-${page.pageNumber}`}
                    aria-label={`Page ${page.pageNumber}`}
                    className="scroll-mt-24"
                  >
                    <p className="mb-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Page {page.pageNumber}
                    </p>
                    <div className="space-y-3">{page.blocks.map(renderBlock)}</div>
                  </section>
                ))}
              </div>
            </Card>

            {/* Right: match details (desktop) */}
            <Card className="hidden xl:block">
              <div className="sticky top-4 max-h-[calc(100vh-8rem)] overflow-hidden">
                {rightPanel}
              </div>
            </Card>
          </div>

          {/* Mobile drawers */}
          {leftOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Review navigation">
              <div className="absolute inset-0 bg-slate-900/50" onClick={() => setLeftOpen(false)} aria-hidden="true" />
              <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-hidden bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 p-3">
                  <span className="text-sm font-semibold">Navigation</span>
                  <Button variant="tertiary" size="sm" onClick={() => setLeftOpen(false)}>
                    Close
                  </Button>
                </div>
                <div className="h-[calc(100%-57px)]">{leftPanel}</div>
              </div>
            </div>
          )}
          {rightOpen && (
            <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Match details">
              <div className="absolute inset-0 bg-slate-900/50" onClick={() => setRightOpen(false)} aria-hidden="true" />
              <div className="absolute inset-y-0 right-0 w-80 max-w-[85vw] overflow-hidden bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 p-3">
                  <span className="text-sm font-semibold">Match details</span>
                  <Button variant="tertiary" size="sm" onClick={() => setRightOpen(false)}>
                    Close
                  </Button>
                </div>
                <div className="h-[calc(100%-57px)]">{rightPanel}</div>
              </div>
            </div>
          )}
        </>
      )}

      <AddPassageModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        reviewId={review.id}
        onAdded={handleAdded}
      />
    </div>
  );
}
