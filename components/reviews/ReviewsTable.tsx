'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ReviewStatusBadge } from './StatusBadge';
import { formatDate, formatRelativeTime } from '@/lib/reviews/format';

export interface ReviewListItem {
  id: string;
  title: string;
  status: 'processing' | 'ready' | 'review_required' | 'completed' | 'failed';
  total_matches: number;
  documentName: string;
  created_at: string;
  updated_at: string;
  latestExportUrl: string | null;
  latestExportKind: 'docx' | 'pdf' | null;
}

const MATCH_FILTERS = [
  { value: 'any', label: 'Any matches' },
  { value: 'none', label: 'No matches' },
  { value: '1-10', label: '1–10 matches' },
  { value: '11-50', label: '11–50 matches' },
  { value: '51+', label: '51+ matches' },
];

const DATE_FILTERS = [
  { value: 'any', label: 'Any time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export function ReviewsTable({ initialReviews }: { initialReviews: ReviewListItem[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('any');
  const [matchFilter, setMatchFilter] = useState('any');
  const [dateFilter, setDateFilter] = useState('any');
  const [deleting, setDeleting] = useState<ReviewListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return reviews.filter((r) => {
      if (q && !`${r.title} ${r.documentName}`.toLowerCase().includes(q)) return false;
      if (status !== 'any' && r.status !== status) return false;
      if (matchFilter === 'none' && r.total_matches !== 0) return false;
      if (matchFilter === '1-10' && (r.total_matches < 1 || r.total_matches > 10)) return false;
      if (matchFilter === '11-50' && (r.total_matches < 11 || r.total_matches > 50)) return false;
      if (matchFilter === '51+' && r.total_matches < 51) return false;
      if (dateFilter !== 'any') {
        const days = Number(dateFilter);
        if (now - new Date(r.created_at).getTime() > days * 86400000) return false;
      }
      return true;
    });
  }, [reviews, query, status, matchFilter, dateFilter]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/reviews/${deleting.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'The review could not be deleted.');
      }
      setReviews((prev) => prev.filter((r) => r.id !== deleting.id));
      toast('Review deleted.', 'success');
      setDeleting(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The review could not be deleted.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const downloadCopy = async (review: ReviewListItem) => {
    setDownloadingId(review.id);
    try {
      // Prefer the most recent existing export; otherwise build a fresh DOCX.
      const kind = review.latestExportKind ?? 'docx';
      let url = review.latestExportUrl;
      if (!url) {
        const res = await fetch(`/api/reviews/${review.id}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? 'The export could not be created.');
        url = data.url as string;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Download started.', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The download could not start.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          placeholder="Search by title or document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="any">All statuses</option>
          <option value="processing">Processing</option>
          <option value="ready">Ready</option>
          <option value="review_required">Review required</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
        <Select label="Matches" value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
          {MATCH_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
        <Select label="Created" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          {DATE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={reviews.length === 0 ? 'No reviews yet' : 'No reviews match your filters'}
          description={
            reviews.length === 0
              ? 'Upload an original document and a similarity report to create your first review.'
              : 'Try adjusting your search or filters.'
          }
          action={
            reviews.length === 0 ? (
              <Link href="/reviews/new">
                <Button variant="primary">Start new review</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-card">
          <table className="ss-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Matches</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.title}</p>
                    <p className="truncate text-xs text-slate-500" title={r.documentName}>
                      {r.documentName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <ReviewStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.total_matches}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-slate-600" title={formatDate(r.updated_at)}>
                    {formatRelativeTime(r.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link href={`/reviews/${r.id}`}>
                        <Button variant="tertiary" size="sm">Open</Button>
                      </Link>
                      <Button
                        variant="tertiary"
                        size="sm"
                        loading={downloadingId === r.id}
                        onClick={() => downloadCopy(r)}
                      >
                        Download copy
                      </Button>
                      <Button variant="tertiary" size="sm" onClick={() => setDeleting(r)}>
                        <span className="text-red-600">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => (deleteLoading ? undefined : setDeleting(null))}
        title="Delete review"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" loading={deleteLoading} onClick={confirmDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This will permanently delete <strong className="text-slate-900">{deleting?.title}</strong>,
          including the uploaded original, the similarity report, all matched passages, and any
          generated review copies. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
