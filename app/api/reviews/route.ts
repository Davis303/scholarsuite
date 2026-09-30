import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/reviews/supabaseServer';
import {
  detectFileKind,
  getMaxUploadBytes,
  reviewCreateSchema,
  sanitizeFilename,
} from '@/lib/reviews/validate';
import {
  authed,
  badRequest,
  getOwnedDocument,
  serverError,
  storageObjectPath,
  writeAudit,
} from './_helpers';

/**
 * POST /api/reviews
 * Create a similarity review from a multipart form:
 *   - title (required)
 *   - originalFile (DOCX/PDF) OR documentId (existing library document)
 *   - reportFile (PDF, required)
 * Validates magic bytes + size, uploads to private buckets, inserts
 * documents + reviews rows (status 'processing'), returns { reviewId }.
 */
export async function POST(req: NextRequest) {
  const auth = await authed();
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('The upload could not be read. Please try again.');
  }

  const titleParsed = reviewCreateSchema.safeParse({
    title: String(form.get('title') ?? ''),
  });
  if (!titleParsed.success) {
    return badRequest(titleParsed.error.errors[0]?.message ?? 'Please give the review a title.');
  }
  const title = titleParsed.data.title;

  const documentIdRaw = form.get('documentId');
  const documentId = documentIdRaw ? String(documentIdRaw) : null;
  const originalFile = form.get('originalFile');
  const reportFile = form.get('reportFile');

  if (!documentId && !(originalFile instanceof File)) {
    return badRequest('Please upload the original document or choose one from your library.');
  }
  if (!(reportFile instanceof File)) {
    return badRequest('Please upload the similarity report (PDF).');
  }

  const maxBytes = getMaxUploadBytes();

  try {
    const svc = getServiceSupabase();
    const userId = auth.user.id;

    // ---- Resolve / upload the original document ----
    let originalDocId: string;
    if (documentId) {
      const existing = await getOwnedDocument(auth, documentId);
      if (!existing || existing.kind !== 'original') {
        return badRequest('The selected library document could not be found.');
      }
      originalDocId = existing.id;
      await writeAudit(auth, 'review.reused_document', 'review', null, {
        documentId: existing.id,
        title,
      });
    } else {
      const file = originalFile as File;
      if (file.size > maxBytes) {
        return badRequest(
          `The original document is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const kind = detectFileKind(buffer);
      if (kind !== 'pdf' && kind !== 'docx') {
        return badRequest(
          'The original document must be a PDF or Word (DOCX) file. The file contents did not match its type.',
        );
      }
      const storagePath = storageObjectPath(userId, sanitizeFilename(file.name));
      const { error: uploadError } = await svc.storage
        .from('documents')
        .upload(storagePath, buffer, {
          contentType: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        });
      if (uploadError) {
        return serverError('The original document could not be uploaded. Please try again.');
      }
      const { data: docRow, error: docError } = await auth.supabase
        .from('documents')
        .insert({
          user_id: userId,
          kind: 'original',
          name: file.name.slice(0, 255),
          mime_type: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size_bytes: file.size,
          storage_path: storagePath,
          status: 'uploaded',
        })
        .select('id')
        .single();
      if (docError || !docRow) {
        await svc.storage.from('documents').remove([storagePath]);
        return serverError('The original document could not be saved. Please try again.');
      }
      originalDocId = (docRow as { id: string }).id;
      await writeAudit(auth, 'document.uploaded', 'document', originalDocId, {
        name: file.name,
        kind: 'original',
      });
    }

    // ---- Upload the similarity report (PDF required) ----
    const reportBuffer = Buffer.from(await reportFile.arrayBuffer());
    if (reportFile.size > maxBytes) {
      return badRequest(
        `The similarity report is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      );
    }
    if (detectFileKind(reportBuffer) !== 'pdf') {
      return badRequest(
        'The similarity report must be a PDF file. The file contents did not match a PDF.',
      );
    }
    const reportPath = storageObjectPath(userId, sanitizeFilename(reportFile.name));
    const { error: reportUploadError } = await svc.storage
      .from('reports')
      .upload(reportPath, reportBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (reportUploadError) {
      return serverError('The similarity report could not be uploaded. Please try again.');
    }
    const { data: reportRow, error: reportError } = await auth.supabase
      .from('documents')
      .insert({
        user_id: userId,
        kind: 'similarity_report',
        name: reportFile.name.slice(0, 255),
        mime_type: 'application/pdf',
        size_bytes: reportFile.size,
        storage_path: reportPath,
        status: 'uploaded',
      })
      .select('id')
      .single();
    if (reportError || !reportRow) {
      await svc.storage.from('reports').remove([reportPath]);
      return serverError('The similarity report could not be saved. Please try again.');
    }
    const reportId = (reportRow as { id: string }).id;
    await writeAudit(auth, 'document.uploaded', 'document', reportId, {
      name: reportFile.name,
      kind: 'similarity_report',
    });

    // ---- Create the review ----
    const { data: reviewRow, error: reviewError } = await auth.supabase
      .from('reviews')
      .insert({
        user_id: userId,
        document_id: originalDocId,
        report_id: reportId,
        title,
        status: 'processing',
        total_matches: 0,
      })
      .select('id')
      .single();
    if (reviewError || !reviewRow) {
      return serverError('The review could not be created. Please try again.');
    }
    const reviewId = (reviewRow as { id: string }).id;
    await writeAudit(auth, 'review.created', 'review', reviewId, {
      title,
      documentId: originalDocId,
      reportId,
    });

    return NextResponse.json({ reviewId }, { status: 201 });
  } catch {
    return serverError();
  }
}
