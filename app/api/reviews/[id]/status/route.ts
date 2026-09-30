import { NextRequest, NextResponse } from 'next/server';
import type { AuditLogRow, MatchedPassageRow } from '@/lib/reviews/types';
import { authed, getOwnedReview, notFound, serverError } from '../../_helpers';

/**
 * GET /api/reviews/[id]/status
 * Pollable processing status for the wizard:
 * { reviewId, title, status, totalMatches, stage, pagesAffected, sourcesCount, needsManualReview }
 * `stage` comes from the latest real pipeline stage recorded in audit_logs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authed();
  if (auth instanceof NextResponse) return auth;

  const review = await getOwnedReview(auth, params.id);
  if (!review) return notFound();

  try {
    const { data: passages } = await auth.supabase
      .from('matched_passages')
      .select('page_number, source_label')
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id);
    const rows = (passages ?? []) as Pick<MatchedPassageRow, 'page_number' | 'source_label'>[];
    const pagesAffected = new Set(
      rows.map((r) => r.page_number).filter((n): n is number => n != null),
    ).size;
    const sourcesCount = new Set(
      rows.map((r) => (r.source_label || '').trim()).filter(Boolean),
    ).size;

    let stage: string | null = null;
    const { data: stageLog } = await auth.supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('action', 'review.stage')
      .eq('entity_id', review.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (stageLog) {
      const meta = (stageLog as AuditLogRow).meta;
      if (meta && typeof meta.stage === 'string') stage = meta.stage;
    }

    return NextResponse.json({
      reviewId: review.id,
      title: review.title,
      status: review.status,
      totalMatches: review.total_matches,
      stage,
      pagesAffected,
      sourcesCount,
      needsManualReview:
        review.status === 'review_required' && review.total_matches === 0,
    });
  } catch {
    return serverError();
  }
}
