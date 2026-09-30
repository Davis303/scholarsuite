import { z } from 'zod';

/** Upload size limit in MB (env MAX_UPLOAD_MB, default 25). */
export function getMaxUploadMB(): number {
  const raw = Number(process.env.MAX_UPLOAD_MB ?? '25');
  return Number.isFinite(raw) && raw > 0 ? raw : 25;
}

export function getMaxUploadBytes(): number {
  return getMaxUploadMB() * 1024 * 1024;
}

export type UploadKind = 'pdf' | 'docx' | 'unknown';

/**
 * Detect file kind from magic bytes. Never trust the extension.
 * PDF:  %PDF (25 50 44 46)
 * DOCX: ZIP container PK\x03\x04 (50 4B 03 04)
 */
export function detectFileKind(buffer: Buffer): UploadKind {
  if (buffer.length < 4) return 'unknown';
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'docx';
  }
  return 'unknown';
}

/** Strip path components and unsafe characters for storage object names. */
export function sanitizeFilename(name: string): string {
  const base =
    name.split('/').pop()?.split('\\').pop()?.trim() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  const sliced = cleaned.slice(0, 120);
  return sliced.length > 0 ? sliced : 'file';
}

export function humanKindLabel(kind: UploadKind): string {
  if (kind === 'pdf') return 'PDF';
  if (kind === 'docx') return 'Word document (DOCX)';
  return 'file';
}

// ---------------------------------------------------------------------------
// Zod schemas for the reviews API
// ---------------------------------------------------------------------------

export const passageStatusSchema = z.enum([
  'needs_review',
  'properly_cited',
  'direct_quote',
  'common_knowledge',
  'citation_check',
  'source_verification',
]);

export const passagePatchSchema = z.object({
  passageId: z.string().uuid(),
  status: passageStatusSchema,
  reviewerNote: z.string().max(2000).optional().nullable(),
});

export const manualPassageSchema = z.object({
  passageText: z.string().trim().min(20, 'Passage text must be at least 20 characters.').max(10000),
  sourceLabel: z.string().trim().max(300).optional().nullable(),
  sourceDetail: z.string().trim().max(1000).optional().nullable(),
  similarityPct: z.number().min(0).max(100).optional().nullable(),
  pageNumber: z.number().int().positive().max(100000).optional().nullable(),
});

export const exportRequestSchema = z.object({
  kind: z.enum(['docx', 'pdf']),
});

export const reviewCreateSchema = z.object({
  title: z.string().trim().min(1, 'Please give the review a title.').max(200),
});

export const uuidSchema = z.string().uuid();
