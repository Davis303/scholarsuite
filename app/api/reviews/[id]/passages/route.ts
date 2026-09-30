import { NextRequest, NextResponse } from 'next/server';
import { passagePatchSchema } from '@/lib/reviews/validate';
import type { MatchedPassageRow } from '@/lib/reviews/types';
import {
  authed,
  badRequest,
  getOwnedReview,
  notFound,
  serverError,
  writeAudit,
} from '../../_helpers';

/**
 * PATCH /api/reviews/[id]/passages
 * Update a passage's review status and/or reviewer note.
 * Body: { passageId, status, reviewerNote? }
 *
 * When every passage of a review leaves 'needs_review', the review is
 * marked 'completed'; moving any passage back to 'needs_review' reopens it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authed();
  if (auth instanceof NextResponse) return auth;

  const review = await getOwnedReview(auth, params.id);
  if (!review) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('The request body could not be read.');
  }
  const parsed = passagePatchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.errors[0]?.message ?? 'The supplied values are not valid.',
    );
  }
  const { passageId, status, reviewerNote } = parsed.data;

  try {
    // Verify the passage belongs to this review and this user.
    const { data: existing } = await auth.supabase
      .from('matched_passages')
      .select('id, review_id')
      .eq('id', passageId)
      .eq('user_id', auth.user.id)
      .single();
    const row = existing as { id: string; review_id: string } | null;
    if (!row || row.review_id !== review.id) {
      return notFound('Matched passage not found.');
    }

    const { error: updateError } = await auth.supabase
      .from('matched_passages')
      .update({
        status,
        reviewer_note: reviewerNote ?? null,
      })
      .eq('id', passageId)
      .eq('user_id', auth.user.id);
    if (updateError) {
      return serverError('The passage could not be updated. Please try again.');
    }

    // Roll the review status forward/back based on remaining work.
    const { data: allPassages } = await auth.supabase
      .from('matched_passages')
      .select('status')
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id);
    const statuses = ((allPassages ?? []) as Pick<MatchedPassageRow, 'status'>[]).map(
      (p) => p.status,
    );
    const openCount = statuses.filter((s) => s === 'needs_review').length;

    let nextReviewStatus: typeof review.status | null = null;
    if (openCount === 0 && (review.status === 'ready' || review.status === 'review_required')) {
      nextReviewStatus = 'completed';
    } else if (openCount > 0 && review.status === 'completed') {
      nextReviewStatus = 'ready';
    }
    if (nextReviewStatus) {
      await auth.supabase
        .from('reviews')
        .update({ status: nextReviewStatus })
        .eq('id', review.id)
        .eq('user_id', auth.user.id);
      await writeAudit(auth, 'review.status_changed', 'review', review.id, {
        status: nextReviewStatus,
      });
    }

    await writeAudit(auth, 'passage.reviewed', 'matched_passage', passageId, {
      status,
      reviewId: review.id,
    });

    return NextResponse.json({
      ok: true,
      reviewStatus: nextReviewStatus ?? review.status,
    });
  } catch {
    return serverError();
  }
}
