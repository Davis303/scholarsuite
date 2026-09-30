import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/reviews/supabaseServer';
import type { DocumentRow, ReviewExportRow } from '@/lib/reviews/types';
import {
  authed,
  getOwnedReview,
  notFound,
  serverError,
  writeAudit,
} from '../_helpers';

/**
 * DELETE /api/reviews/[id]
 * Permanently delete a review: storage objects (original, report, exports)
 * plus all related rows. The UI must confirm before calling.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authed();
  if (auth instanceof NextResponse) return auth;

  const review = await getOwnedReview(auth, params.id);
  if (!review) return notFound();

  try {
    const svc = getServiceSupabase();

    // Collect storage objects to remove.
    const { data: documents } = await auth.supabase
      .from('documents')
      .select('id, storage_path, kind')
      .in('id', [review.document_id, review.report_id].filter(Boolean));
    const docs = (documents ?? []) as Pick<DocumentRow, 'id' | 'storage_path' | 'kind'>[];

    const { data: exports } = await auth.supabase
      .from('review_exports')
      .select('storage_path')
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id);
    const exportPaths = ((exports ?? []) as Pick<ReviewExportRow, 'storage_path'>[]).map(
      (e) => e.storage_path,
    );

    const docPaths = docs
      .filter((d) => d.kind === 'original')
      .map((d) => d.storage_path);
    const reportPaths = docs
      .filter((d) => d.kind === 'similarity_report')
      .map((d) => d.storage_path);

    // Remove storage objects (best effort; rows are deleted regardless).
    try {
      if (docPaths.length > 0) await svc.storage.from('documents').remove(docPaths);
      if (reportPaths.length > 0) await svc.storage.from('reports').remove(reportPaths);
      if (exportPaths.length > 0) await svc.storage.from('exports').remove(exportPaths);
    } catch {
      // Continue with row deletion even if some objects are already gone.
    }

    await auth.supabase
      .from('review_exports')
      .delete()
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id);

    await auth.supabase
      .from('reviews')
      .delete()
      .eq('id', review.id)
      .eq('user_id', auth.user.id);

    const docIds = docs.map((d) => d.id);
    if (docIds.length > 0) {
      await auth.supabase
        .from('documents')
        .delete()
        .in('id', docIds)
        .eq('user_id', auth.user.id);
    }

    await writeAudit(auth, 'review.deleted', 'review', review.id, {
      title: review.title,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError('The review could not be deleted. Please try again.');
  }
}
