import { NextRequest, NextResponse } from 'next/server';
import {
  docxBlocksToMatchPages,
  extractDocxText,
  extractPdfPages,
  pdfPagesToMatchPages,
  type MatchDocPage,
} from '@/lib/reviews/extract';
import { mapPassagesToDocument } from '@/lib/reviews/match';
import { detectCitationNearby } from '@/lib/reviews/citations';
import { manualPassageSchema } from '@/lib/reviews/validate';
import {
  authed,
  badRequest,
  downloadStorage,
  getOwnedDocument,
  getOwnedReview,
  notFound,
  serverError,
  writeAudit,
} from '../../../_helpers';

/**
 * POST /api/reviews/[id]/passages/manual
 * Manually add a matched passage (the fallback when a report format
 * cannot be parsed automatically, or for reviewer-added matches).
 * Body: { passageText, sourceLabel?, sourceDetail?, similarityPct?, pageNumber? }
 * The passage is fuzzy-matched against the document server-side so it
 * appears in the workspace with a page number and confidence.
 */
export async function POST(
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
  const parsed = manualPassageSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.errors[0]?.message ?? 'The supplied values are not valid.',
    );
  }
  const { passageText, sourceLabel, sourceDetail, similarityPct, pageNumber } =
    parsed.data;

  try {
    // Extract the document so we can map the new passage to a page.
    const document = await getOwnedDocument(auth, review.document_id);
    if (!document) {
      return serverError('The original document could not be found.');
    }
    const docBuffer = await downloadStorage('documents', document.storage_path);
    const mime = (document.mime_type || '').toLowerCase();
    let matchPages: MatchDocPage[];
    if (mime.includes('wordprocessingml') || document.name.toLowerCase().endsWith('.docx')) {
      matchPages = docxBlocksToMatchPages(await extractDocxText(docBuffer));
    } else {
      matchPages = pdfPagesToMatchPages(await extractPdfPages(docBuffer));
    }

    const [mapped] = mapPassagesToDocument(
      [{ text: passageText }],
      matchPages,
    );
    const citation = mapped.paragraphText
      ? detectCitationNearby(mapped.paragraphText)
      : null;

    const { data: existing } = await auth.supabase
      .from('matched_passages')
      .select('match_index')
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id)
      .order('match_index', { ascending: false })
      .limit(1);
    const nextIndex =
      ((existing as Array<{ match_index: number }> | null)?.[0]?.match_index ?? 0) + 1;

    const { data: inserted, error: insertError } = await auth.supabase
      .from('matched_passages')
      .insert({
        user_id: auth.user.id,
        review_id: review.id,
        match_index: nextIndex,
        page_number: pageNumber ?? mapped.pageNumber,
        passage_text: passageText,
        paragraph_text: mapped.paragraphText || null,
        source_label: sourceLabel ?? null,
        source_detail: sourceDetail ?? null,
        similarity_pct: similarityPct ?? null,
        citation_detected: citation?.detected ?? false,
        status: 'needs_review',
        reviewer_note: null,
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      return serverError('The passage could not be added. Please try again.');
    }

    const updates: Record<string, unknown> = {
      total_matches: review.total_matches + 1,
    };
    if (review.status === 'completed') updates.status = 'ready';
    if (review.status === 'failed') updates.status = 'review_required';
    await auth.supabase
      .from('reviews')
      .update(updates)
      .eq('id', review.id)
      .eq('user_id', auth.user.id);

    await writeAudit(auth, 'passage.added_manual', 'matched_passage', (inserted as { id: string }).id, {
      reviewId: review.id,
      verified: mapped.verified,
    });

    return NextResponse.json(
      {
        passageId: (inserted as { id: string }).id,
        pageNumber: pageNumber ?? mapped.pageNumber,
        verified: mapped.verified,
        totalMatches: review.total_matches + 1,
      },
      { status: 201 },
    );
  } catch {
    return serverError();
  }
}
