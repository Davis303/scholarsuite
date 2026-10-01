import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase, requireUser } from '@/lib/reviews/supabaseServer';
import {
  docxBlocksToMatchPages,
  extractDocxText,
  extractPdfPages,
  pdfPagesToMatchPages,
} from '@/lib/reviews/extract';
import { mapPassagesToDocument } from '@/lib/reviews/match';
import type { DocumentRow, MatchedPassageRow, ReviewRow } from '@/lib/reviews/types';
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider } from "@/components/ui/Toast";
import {
  WorkspaceClient,
  type WorkspaceBlock,
  type WorkspacePage,
  type WorkspacePassage,
} from '@/components/reviews/WorkspaceClient';

export const metadata = {
  title: 'Review Workspace',
};

/**
 * The similarity review workspace: document preview with highlighted
 * matched passages, match navigation, and per-match review controls.
 * The original file is re-extracted from private storage on each load 
 * the stored original is never modified.
 */
export default async function ReviewWorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const auth = await requireUser();
  if (!auth) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-600">Please sign in to view this review.</p>
      </Card>
    );
  }

  const { data: reviewData } = await auth.supabase
    .from('reviews')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', auth.user.id)
    .single();
  const review = (reviewData ?? null) as ReviewRow | null;
  if (!review) notFound();

  if (review.status === 'processing') {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex justify-center text-accent-600">
          <Spinner />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">This review is still processing</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          The document and similarity report are being analyzed. This usually takes
          under a minute. Open the review again shortly.
        </p>
        <div className="mt-6">
          <Link href="/reviews">
            <Button variant="secondary">Back to My Reviews</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (review.status === 'failed') {
    return (
      <EmptyState
        title="This review could not be processed"
        description="The document or similarity report could not be analyzed. You can start a new review with different files."
        action={
          <Link href="/reviews/new">
            <Button variant="primary">Start new review</Button>
          </Link>
        }
      />
    );
  }

  const { data: docData } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', review.document_id)
    .eq('user_id', auth.user.id)
    .single();
  const document = (docData ?? null) as DocumentRow | null;
  if (!document) notFound();

  const { data: passagesData } = await auth.supabase
    .from('matched_passages')
    .select('*')
    .eq('review_id', review.id)
    .eq('user_id', auth.user.id)
    .order('match_index', { ascending: true });
  const passageRows = (passagesData ?? []) as MatchedPassageRow[];

  // Re-extract the original document for preview + mapping.
  const svc = getServiceSupabase();
  const { data: fileData, error: fileError } = await svc.storage
    .from('documents')
    .download(document.storage_path);
  if (fileError || !fileData) {
    return (
      <EmptyState
        title="The original document could not be loaded"
        description="Its file is missing from storage. The review data is intact. Try again later or start a new review."
        action={
          <Link href="/reviews">
            <Button variant="secondary">Back to My Reviews</Button>
          </Link>
        }
      />
    );
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mime = (document.mime_type || '').toLowerCase();
  const isDocx =
    mime.includes('wordprocessingml') || document.name.toLowerCase().endsWith('.docx');

  // Extract once; reuse for display pages and for mapping confidence.
  const docxBlocks = isDocx ? await extractDocxText(buffer) : null;
  const pdfExtracted = isDocx ? null : await extractPdfPages(buffer);

  let pages: WorkspacePage[] = [];
  if (docxBlocks) {
    const perPage = 12;
    for (let i = 0; i < docxBlocks.length; i += perPage) {
      const pageNumber = Math.floor(i / perPage) + 1;
      const pageBlocks: WorkspaceBlock[] = docxBlocks
        .slice(i, i + perPage)
        .map((b, j) => ({
          key: `p${pageNumber}-b${j}`,
          kind: b.kind,
          level: b.level,
          ordered: b.ordered,
          text: b.text,
        }));
      pages.push({ pageNumber, blocks: pageBlocks });
    }
    if (pages.length === 0) pages = [{ pageNumber: 1, blocks: [] }];
  } else {
    const pdfPages = pdfExtracted ?? [];
    pages = pdfPages.map((p) => {
      const paragraphs = p.text
        .split(/\n\s*\n/)
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length > 0);
      const blocks: WorkspaceBlock[] = paragraphs.map((text, j) => ({
        key: `p${p.pageNumber}-b${j}`,
        kind: 'paragraph' as const,
        level: 0,
        ordered: false,
        text,
      }));
      if (blocks.length === 0) {
        blocks.push({
          key: `p${p.pageNumber}-b0`,
          kind: 'paragraph',
          level: 0,
          ordered: false,
          text: '(No extractable text on this page.)',
        });
      }
      return { pageNumber: p.pageNumber, blocks };
    });
    if (pages.length === 0) pages = [{ pageNumber: 1, blocks: [] }];
  }

  // Deterministically recompute mapping confidence (same inputs as the
  // process route) so low-confidence matches are flagged for verification.
  const matchPages = docxBlocks
    ? docxBlocksToMatchPages(docxBlocks)
    : pdfPagesToMatchPages(pdfExtracted ?? []);
  const mapped = mapPassagesToDocument(
    passageRows.map((p) => ({ text: p.passage_text })),
    matchPages,
  );

  const passages: WorkspacePassage[] = passageRows.map((p, i) => ({
    id: p.id,
    matchIndex: p.match_index,
    pageNumber: p.page_number,
    passageText: p.passage_text,
    paragraphText: p.paragraph_text,
    sourceLabel: p.source_label,
    sourceDetail: p.source_detail,
    similarityPct: p.similarity_pct != null ? Number(p.similarity_pct) : null,
    citationDetected: p.citation_detected,
    status: p.status,
    reviewerNote: p.reviewer_note,
    verified: mapped[i]?.verified ?? false,
  }));

  return (
    <ToastProvider>
      <WorkspaceClient
        review={{
          id: review.id,
          title: review.title,
          status: review.status,
          documentId: review.document_id,
        }}
        documentName={document.name}
        originalKind={isDocx ? 'docx' : 'pdf'}
        pages={pages}
        initialPassages={passages}
      />
    </ToastProvider>
  );
}
