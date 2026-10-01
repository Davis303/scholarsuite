import Link from 'next/link';
import { getServiceSupabase, requireUser } from '@/lib/reviews/supabaseServer';
import type {
  DocumentRow,
  ReviewExportRow,
  ReviewRow,
} from '@/lib/reviews/types';
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ToastProvider } from "@/components/ui/Toast";
import { ReviewsTable, type ReviewListItem } from '@/components/reviews/ReviewsTable';

export const metadata = {
  title: 'My Reviews',
};

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * My Reviews, search, status/date/match-count filters, and per-review
 * actions (open, download highlighted copy, delete with confirmation).
 */
export default async function ReviewsPage() {
  const auth = await requireUser();
  if (!auth) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-600">We couldn&apos;t start your free session. Please refresh the page.</p>
      </Card>
    );
  }

  const { data: reviewsData } = await auth.supabase
    .from('reviews')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false })
    .limit(200);
  const reviews = (reviewsData ?? []) as ReviewRow[];

  const docIds = Array.from(new Set(reviews.map((r) => r.document_id)));
  const { data: docsData } = await auth.supabase
    .from('documents')
    .select('id, name')
    .in('id', docIds.length > 0 ? docIds : [EMPTY_UUID]);
  const docNames = new Map(
    ((docsData ?? []) as Pick<DocumentRow, 'id' | 'name'>[]).map((d) => [d.id, d.name]),
  );

  const reviewIds = reviews.map((r) => r.id);
  const { data: exportsData } =
    reviewIds.length > 0
      ? await auth.supabase
          .from('review_exports')
          .select('*')
          .in('review_id', reviewIds)
          .order('created_at', { ascending: false })
      : { data: null };
  const latestByReview = new Map<string, ReviewExportRow>();
  for (const e of (exportsData ?? []) as ReviewExportRow[]) {
    if (!latestByReview.has(e.review_id)) latestByReview.set(e.review_id, e);
  }

  // Short-lived signed URLs for the latest export of each review.
  const svc = getServiceSupabase();
  const urlByReview = new Map<string, { url: string; kind: 'docx' | 'pdf' }>();
  await Promise.all(
    Array.from(latestByReview.entries()).map(async ([reviewId, exp]) => {
      try {
        const { data: signed, error } = await svc.storage
          .from('exports')
          .createSignedUrl(exp.storage_path, 60);
        if (!error && signed) {
          urlByReview.set(reviewId, { url: signed.signedUrl, kind: exp.kind });
        }
      } catch {
        // Leave the review without a pre-signed URL; the table builds one on demand.
      }
    }),
  );

  const items: ReviewListItem[] = reviews.map((r) => {
    const latest = urlByReview.get(r.id);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      total_matches: r.total_matches,
      documentName: docNames.get(r.document_id) ?? 'Document',
      created_at: r.created_at,
      updated_at: r.updated_at,
      latestExportUrl: latest?.url ?? null,
      latestExportKind: latest?.kind ?? null,
    };
  });

  return (
    <ToastProvider>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Reviews</h1>
          <p className="mt-1 text-sm text-slate-600">
            Similarity reviews of your documents, with matched passages and highlighted copies.
          </p>
        </div>
        <Link href="/reviews/new">
          <Button variant="primary">Start new review</Button>
        </Link>
      </div>
      <ReviewsTable initialReviews={items} />
    </ToastProvider>
  );
}
