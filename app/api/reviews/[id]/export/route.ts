import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/reviews/supabaseServer';
import {
  extractDocxText,
  extractPdfPages,
  type ExtractedPage,
} from '@/lib/reviews/extract';
import {
  buildHighlightedDocx,
  buildReviewCopyDocxFromText,
} from '@/lib/reviews/highlightDocx';
import { buildReviewCopyPdf } from '@/lib/reviews/reviewPdf';
import { exportRequestSchema, sanitizeFilename } from '@/lib/reviews/validate';
import type { MatchedPassageRow, ReviewExportRow } from '@/lib/reviews/types';
import {
  authed,
  badRequest,
  downloadStorage,
  getOwnedDocument,
  getOwnedReview,
  notFound,
  serverError,
  storageObjectPath,
  writeAudit,
} from '../../_helpers';

const SIGNED_URL_SECONDS = 60;

/**
 * GET /api/reviews/[id]/export?kind=docx|pdf
 * Return a short-lived signed URL for the most recent export of that kind,
 * or 404 when no export exists yet.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authed();
  if (auth instanceof NextResponse) return auth;

  const kind = req.nextUrl.searchParams.get('kind');
  const parsed = exportRequestSchema.safeParse({ kind });
  if (!parsed.success) return badRequest('Export kind must be "docx" or "pdf".');

  const review = await getOwnedReview(auth, params.id);
  if (!review) return notFound();

  try {
    const { data } = await auth.supabase
      .from('review_exports')
      .select('*')
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id)
      .eq('kind', parsed.data.kind)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    const latest = data as ReviewExportRow | null;
    if (!latest) {
      return NextResponse.json({ error: 'No export of this kind yet.' }, { status: 404 });
    }
    const svc = getServiceSupabase();
    const { data: signed, error } = await svc.storage
      .from('exports')
      .createSignedUrl(latest.storage_path, SIGNED_URL_SECONDS);
    if (error || !signed) {
      return serverError('The download link could not be created. Please try again.');
    }
    return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_SECONDS });
  } catch {
    return serverError();
  }
}

/**
 * POST /api/reviews/[id]/export
 * Build a highlighted review copy and return a short-lived download URL.
 * Body: { kind: 'docx' | 'pdf' }
 *
 * - DOCX originals → DOCX rebuilt with yellow highlights on matched runs.
 * - PDF originals (or kind=pdf) → review-copy PDF of extracted text with
 *   highlighted matches, honestly labeled as a re-flowed review copy.
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
  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest('Export kind must be "docx" or "pdf".');
  const { kind } = parsed.data;

  try {
    const document = await getOwnedDocument(auth, review.document_id);
    if (!document) return serverError('The original document could not be found.');

    const { data: passageRows } = await auth.supabase
      .from('matched_passages')
      .select('passage_text, paragraph_text, page_number')
      .eq('review_id', review.id)
      .eq('user_id', auth.user.id)
      .order('match_index', { ascending: true });
    const matches = ((passageRows ?? []) as Pick<
      MatchedPassageRow,
      'passage_text' | 'paragraph_text' | 'page_number'
    >[]).map((p) => ({ text: p.passage_text }));

    const original = await downloadStorage('documents', document.storage_path);
    const mime = (document.mime_type || '').toLowerCase();
    const isDocx =
      mime.includes('wordprocessingml') || document.name.toLowerCase().endsWith('.docx');

    let buffer: Buffer;
    let filename: string;

    if (kind === 'docx' && isDocx) {
      buffer = await buildHighlightedDocx(original, matches, review.title);
      filename = `${review.title}-review-copy.docx`;
    } else if (kind === 'docx') {
      // PDF original → text-based DOCX review copy.
      const pages = await extractPdfPages(original);
      buffer = await buildReviewCopyDocxFromText(pages, matches, review.title);
      filename = `${review.title}-review-copy.docx`;
    } else {
      // kind === 'pdf' → re-flowed review-copy PDF with highlights.
      let pages: ExtractedPage[];
      if (isDocx) {
        const blocks = await extractDocxText(original);
        pages = [
          {
            pageNumber: 1,
            text: blocks.map((b) => b.text).join('\n\n'),
          },
        ];
      } else {
        pages = await extractPdfPages(original);
      }
      const pdfMatches = (
        (passageRows ?? []) as Pick<
          MatchedPassageRow,
          'passage_text' | 'paragraph_text' | 'page_number'
        >[]
      ).map((p) => ({
        pageNumber: p.page_number ?? 1,
        text: p.passage_text,
      }));
      buffer = await buildReviewCopyPdf(pages, pdfMatches, review.title);
      filename = `${review.title}-review-copy.pdf`;
    }

    const svc = getServiceSupabase();
    const storagePath = storageObjectPath(auth.user.id, sanitizeFilename(filename));
    const { error: uploadError } = await svc.storage.from('exports').upload(
      storagePath,
      buffer,
      {
        contentType:
          kind === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf',
        upsert: false,
      },
    );
    if (uploadError) {
      return serverError('The export could not be saved. Please try again.');
    }

    await auth.supabase.from('review_exports').insert({
      user_id: auth.user.id,
      review_id: review.id,
      kind,
      storage_path: storagePath,
    });

    const { data: signed, error: signError } = await svc.storage
      .from('exports')
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
    if (signError || !signed) {
      return serverError('The download link could not be created. Please try again.');
    }

    await writeAudit(auth, 'review.exported', 'review', review.id, {
      kind,
      storagePath,
    });

    return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_SECONDS });
  } catch {
    return serverError('The highlighted copy could not be generated. Please try again.');
  }
}
