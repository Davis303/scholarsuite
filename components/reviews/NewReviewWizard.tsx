'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileUploader } from "@/components/ui/FileUploader";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ReviewStatusBadge } from './StatusBadge';
import { getBrowserSupabase } from '@/lib/reviews/supabaseBrowser';

const STAGES = [
  { key: 'reading_document', label: 'Reading document' },
  { key: 'reading_report', label: 'Reading similarity report' },
  { key: 'detecting_matches', label: 'Detecting matched passages' },
  { key: 'mapping_matches', label: 'Mapping matches to document' },
  { key: 'finalizing', label: 'Preparing review copy' },
] as const;

interface StatusResponse {
  reviewId: string;
  title: string;
  status: string;
  totalMatches: number;
  stage: string | null;
  pagesAffected: number;
  sourcesCount: number;
  needsManualReview: boolean;
}

// Client-side upload cap mirrors the server MAX_UPLOAD_MB default (server re-validates authoritatively).
const MAX_MB = 25;

export function NewReviewWizard({ initialDocumentId }: { initialDocumentId: string | null }) {
  const [step, setStep] = useState(1);
  const [documentId, setDocumentId] = useState<string | null>(initialDocumentId);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Resolve a preselected library document (?documentId=).
  useEffect(() => {
    if (!initialDocumentId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getBrowserSupabase()
          .from('documents')
          .select('id, name')
          .eq('id', initialDocumentId)
          .single();
        if (cancelled) return;
        const row = data as { id: string; name: string } | null;
        if (row) {
          setDocumentId(row.id);
          setDocumentName(row.name);
        } else {
          setDocumentId(null);
          toast('The selected library document could not be found.', 'error');
        }
      } catch {
        if (!cancelled) {
          setDocumentId(null);
          toast('The selected library document could not be loaded.', 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDocumentId, toast]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const pollStatus = useCallback(
    (id: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const res = await fetch(`/api/reviews/${id}/status`, { cache: 'no-store' });
          const data = (await res.json().catch(() => null)) as StatusResponse | null;
          if (!res.ok || !data) throw new Error('Could not read review status.');
          setStatus(data);
          if (data.status === 'ready' || data.status === 'review_required') {
            stopPolling();
            setStep(4);
          } else if (data.status === 'failed') {
            stopPolling();
            setProcessError('Your document could not be processed. Please check the files and try again.');
          }
        } catch {
          // Keep polling; transient network errors are tolerated.
        }
      };
      void tick();
      pollRef.current = setInterval(tick, 2500);
    },
    [stopPolling],
  );

  const startProcessing = async () => {
    if (!title.trim()) {
      setTitleError('Please give the review a title.');
      return;
    }
    setTitleError(undefined);
    if (!documentId && originalFiles.length === 0) {
      toast('Please upload the original document or choose one from your library.', 'error');
      return;
    }
    if (reportFiles.length === 0) {
      toast('Please upload the similarity report (PDF).', 'error');
      return;
    }
    setSubmitting(true);
    setProcessError(null);
    try {
      const form = new FormData();
      form.set('title', title.trim());
      if (documentId) form.set('documentId', documentId);
      else form.set('originalFile', originalFiles[0]);
      form.set('reportFile', reportFiles[0]);

      const createRes = await fetch('/api/reviews', { method: 'POST', body: form });
      const createData = (await createRes.json().catch(() => null)) as { reviewId?: string; error?: string } | null;
      if (!createRes.ok || !createData?.reviewId) {
        throw new Error(createData?.error ?? 'The review could not be created.');
      }
      const id = createData.reviewId;
      setReviewId(id);
      setStep(3);

      // Kick off real processing, then poll for honest stage updates.
      const processRes = await fetch(`/api/reviews/${id}/process`, { method: 'POST' });
      if (!processRes.ok && processRes.status !== 400) {
        const errData = (await processRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error ?? 'Processing could not start.');
      }
      pollStatus(id);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  };

  const retryProcessing = async () => {
    if (!reviewId) return;
    setProcessError(null);
    setStatus(null);
    setStep(3);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/process`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Processing could not start.');
      }
      pollStatus(reviewId);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : 'Processing could not start.');
    }
  };

  const stageIndex = status?.stage
    ? STAGES.findIndex((s) => s.key === status.stage)
    : -1;

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex items-center gap-2" aria-label="New review progress">
        {['Original document', 'Similarity report', 'Processing', 'Results'].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  done
                    ? 'bg-accent-600 text-white'
                    : active
                      ? 'bg-accent-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done ? '✓' : n}
              </span>
              <span className={`hidden text-sm font-medium sm:inline ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                {label}
              </span>
              {n < 4 && <span aria-hidden="true" className="mx-1 h-px flex-1 bg-slate-200" />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Upload the original document</h2>
          <p className="mt-1 text-sm text-slate-600">
            The academic document you want to review: a Word (.docx) or PDF file.
          </p>
          <div className="mt-4">
            {documentId ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {documentName ?? 'Library document'}
                  </p>
                  <p className="text-xs text-slate-500">Selected from your document library</p>
                </div>
                <Button variant="tertiary" size="sm" onClick={() => { setDocumentId(null); setDocumentName(null); }}>
                  Choose a different file
                </Button>
              </div>
            ) : (
              <FileUploader
                accept=".pdf,.docx"
                maxMB={MAX_MB}
                label="Original document"
                onFiles={setOriginalFiles}
              />
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              disabled={!documentId && originalFiles.length === 0}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Upload the similarity report</h2>
          <p className="mt-1 text-sm text-slate-600">
            The similarity report PDF (for example, from your institution&apos;s similarity checker).
            Matched passages are extracted from it automatically. If the format can&apos;t be
            recognized, you can add passages manually instead.
          </p>
          <div className="mt-4 space-y-4">
            <FileUploader
              accept=".pdf"
              maxMB={MAX_MB}
              label="Similarity report (PDF)"
              onFiles={setReportFiles}
            />
            <Input
              label="Review title"
              placeholder="e.g. Thesis chapter 3, similarity review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={titleError}
              maxLength={200}
            />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" loading={submitting} onClick={startProcessing}>
              Start processing
            </Button>
          </div>
          {processError && (
            <p role="alert" className="mt-4 text-sm text-red-600">{processError}</p>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Processing your review</h2>
          <p className="mt-1 text-sm text-slate-600">
            This usually takes under a minute. Each stage below reflects real progress. Nothing is simulated.
          </p>
          {processError ? (
            <div className="mt-6">
              <EmptyState
                title="Processing failed"
                description={processError}
                action={
                  <Button variant="secondary" className="rounded-full" onClick={retryProcessing}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : (
            <ol className="mt-6 space-y-3">
              {STAGES.map((s, i) => {
                const done = stageIndex > i;
                const current = stageIndex === i;
                const waiting = stageIndex < i && stageIndex !== -1;
                const pending = stageIndex === -1;
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                        done
                          ? 'bg-green-100 text-green-700'
                          : current
                            ? 'bg-accent-50 text-accent-700'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                      aria-hidden="true"
                    >
                      {done ? '✓' : current ? <Spinner /> : '·'}
                    </span>
                    <span
                      className={`text-sm ${done || current ? 'font-medium text-slate-900' : 'text-slate-500'}`}
                    >
                      {s.label}
                    </span>
                    {current && (
                      <span className="sr-only">(in progress)</span>
                    )}
                    {(waiting || pending) && <span className="sr-only">(pending)</span>}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-6 flex justify-between">
            <Button variant="tertiary" onClick={() => { stopPolling(); router.push('/reviews'); }}>
              Leave and check back later
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && status && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Review results</h2>
            <ReviewStatusBadge status={status.status as 'ready' | 'review_required'} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Matched passages', value: String(status.totalMatches) },
              { label: 'Pages affected', value: String(status.pagesAffected) },
              { label: 'Sources detected', value: String(status.sourcesCount) },
              {
                label: 'Needs your review',
                value:
                  status.status === 'review_required'
                    ? 'Yes'
                    : 'No',
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</dd>
              </div>
            ))}
          </dl>
          {status.needsManualReview && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                The similarity report format could not be recognized.
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Open the review workspace and use “Add passage manually” to enter matched
                passages from the report yourself.
              </p>
            </div>
          )}
          {status.status === 'review_required' && !status.needsManualReview && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                Some matches could not be mapped to the document with high confidence.
                Please verify them in the review workspace.
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Link href="/reviews">
              <Button variant="secondary">Back to My Reviews</Button>
            </Link>
            <Link href={reviewId ? `/reviews/${reviewId}` : '/reviews'}>
              <Button variant="primary">Open review workspace</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
