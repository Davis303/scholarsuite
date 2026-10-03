import { NextRequest, NextResponse } from 'next/server';
import {
  docxBlocksToMatchPages,
  extractDocxText,
  extractPdfPages,
  pdfPagesToMatchPages,
  type MatchDocPage,
} from '@/lib/reviews/extract';
import { parseSimilarityReport } from '@/lib/reviews/parseReport';
import { extractHighlightPassagesFromReport } from '@/lib/reviews/highlightExtract';
import { normalizeText } from '@/lib/reviews/textUtils';
import { mapPassagesToDocument } from '@/lib/reviews/match';
import { detectCitationNearby } from '@/lib/reviews/citations';
import type { DocumentRow } from '@/lib/reviews/types';
import {
  authed,
  badRequest,
  downloadStorage,
  getOwnedDocument,
  getOwnedReview,
  notFound,
  serverError,
  writeAudit,
  type AuthedContext,
} from '../../_helpers';

export const maxDuration = 60;

type Stage =
  | 'reading_document'
  | 'reading_report'
  | 'detecting_matches'
  | 'mapping_matches'
  | 'finalizing';

async function reportStage(auth: AuthedContext, reviewId: string, stage: Stage) {
  await writeAudit(auth, 'review.stage', 'review', reviewId, { stage });
}

/**
 * POST /api/reviews/[id]/process
 * Run the real extraction → parse → map pipeline for a review.
 * Stages are recorded in audit_logs so the wizard can poll honest progress.
 * Idempotent: previous matched_passages for the review are replaced.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authed();
  if (auth instanceof NextResponse) return auth;

  const review = await getOwnedReview(auth, params.id);
  if (!review) return notFound();

  if (review.status === 'ready' || review.status === 'completed') {
    return badRequest('This review has already been processed.');
  }

  try {
    await auth.supabase
      .from('reviews')
      .update({ status: 'processing', total_matches: 0 })
      .eq('id', review.id)
      .eq('user_id', auth.user.id);

    // ---- Stage 1: read the original document ----
    await reportStage(auth, review.id, 'reading_document');
    const document = await getOwnedDocument(auth, review.document_id);
    if (!document) {
      throw new Error('The original document could not be found.');
    }
    const docBuffer = await downloadStorage('documents', document.storage_path);
    const mime = (document.mime_type || '').toLowerCase();
    let matchPages: MatchDocPage[];
    let pageCount: number;
    if (mime.includes('wordprocessingml') || document.name.toLowerCase().endsWith('.docx')) {
      const blocks = await extractDocxText(docBuffer);
      if (blocks.length === 0) {
        throw new Error('No text could be extracted from the document.');
      }
      matchPages = docxBlocksToMatchPages(blocks);
      pageCount = matchPages.length;
    } else {
      const pages = await extractPdfPages(docBuffer);
      if (pages.every((p) => !p.text)) {
        throw new Error('No text could be extracted from the document.');
      }
      matchPages = pdfPagesToMatchPages(pages);
      pageCount = pages.length;
    }
    await auth.supabase
      .from('documents')
      .update({ page_count: pageCount })
      .eq('id', document.id)
      .eq('user_id', auth.user.id);

    // ---- Stage 2: read the similarity report ----
    await reportStage(auth, review.id, 'reading_report');
    if (!review.report_id) {
      throw new Error('This review has no similarity report attached.');
    }
    const reportDoc: DocumentRow | null = await getOwnedDocument(auth, review.report_id);
    if (!reportDoc) {
      throw new Error('The similarity report could not be found.');
    }
    const reportBuffer = await downloadStorage('reports', reportDoc.storage_path);
    const reportPages = await extractPdfPages(reportBuffer);
    if (reportPages.every((p) => !p.text)) {
      throw new Error('No text could be extracted from the similarity report.');
    }

    // ---- Stage 3: detect matched passages ----
    await reportStage(auth, review.id, 'detecting_matches');
    let parsed = parseSimilarityReport(reportPages);
    // Turnitin-style reports paint matches as colored highlights instead of
    // listing passage text. Recover those spans from the PDF drawing layer
    // and merge anything the text parser missed.
    const highlighted = await extractHighlightPassagesFromReport(
      reportBuffer,
      reportPages,
    ).catch(() => []);
    if (highlighted.length > 0) {
      const seenKeys = new Set(
        parsed.passages.map((p) => normalizeText(p.text).slice(0, 200)),
      );
      const extra = highlighted.filter(
        (p) => !seenKeys.has(normalizeText(p.text).slice(0, 200)),
      );
      if (extra.length > 0) {
        parsed = {
          passages: [...parsed.passages, ...extra],
          needsManualReview: false,
        };
      }
    }

    // ---- Stage 4: map passages to the document ----
    await reportStage(auth, review.id, 'mapping_matches');
    const mapped = mapPassagesToDocument(parsed.passages, matchPages);

    // ---- Stage 5: persist ----
    await reportStage(auth, review.id, 'finalizing');
    await auth.supabase
      .from('matched_passages')
      .delete()
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id);

    const rows = parsed.passages.map((p, i) => {
      const m = mapped[i];
      const citation = m.paragraphText ? detectCitationNearby(m.paragraphText) : null;
      return {
        user_id: auth.user.id,
        review_id: review.id,
        match_index: i + 1,
        page_number: m.pageNumber,
        passage_text: p.text,
        paragraph_text: m.paragraphText || null,
        source_label: p.sourceLabel ?? null,
        source_detail: p.sourceDetail ?? null,
        similarity_pct: p.similarityPct ?? null,
        citation_detected: citation?.detected ?? false,
        status: 'needs_review',
        reviewer_note: null,
      };
    });

    if (rows.length > 0) {
      const { error: insertError } = await auth.supabase
        .from('matched_passages')
        .insert(rows);
      if (insertError) {
        throw new Error('Matched passages could not be saved.');
      }
    }

    const needsAttention =
      parsed.needsManualReview || mapped.some((m) => !m.verified);
    const nextStatus = needsAttention ? 'review_required' : 'ready';

    await auth.supabase
      .from('reviews')
      .update({ status: nextStatus, total_matches: rows.length })
      .eq('id', review.id)
      .eq('user_id', auth.user.id);

    await writeAudit(auth, 'review.processed', 'review', review.id, {
      totalMatches: rows.length,
      status: nextStatus,
      needsManualReview: parsed.needsManualReview,
      pageCount,
    });

    return NextResponse.json({
      reviewId: review.id,
      status: nextStatus,
      totalMatches: rows.length,
      needsManualReview: parsed.needsManualReview,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'The review could not be processed.';
    try {
      await auth.supabase
        .from('reviews')
        .update({ status: 'failed' })
        .eq('id', review.id)
        .eq('user_id', auth.user.id);
      await writeAudit(auth, 'review.failed', 'review', review.id, { message });
    } catch {
      // ignore secondary failures
    }
    return serverError(message);
  }
}
