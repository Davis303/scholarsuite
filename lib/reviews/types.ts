/**
 * Minimal row shapes for the Supabase tables this module touches.
 * (Mirrors the schema described in CONTRACTS.md; the database builder
 * owns the actual migrations.)
 */

export interface ReviewRow {
  id: string;
  user_id: string;
  document_id: string;
  report_id: string | null;
  title: string;
  status: 'processing' | 'ready' | 'review_required' | 'completed' | 'failed';
  total_matches: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  kind: 'original' | 'similarity_report' | 'writing';
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  status: string | null;
  page_count: number | null;
  created_at: string;
  updated_at: string;
}

export type PassageStatus =
  | 'needs_review'
  | 'properly_cited'
  | 'direct_quote'
  | 'common_knowledge'
  | 'citation_check'
  | 'source_verification';

export interface MatchedPassageRow {
  id: string;
  user_id: string;
  review_id: string;
  match_index: number;
  page_number: number | null;
  passage_text: string;
  paragraph_text: string | null;
  source_label: string | null;
  source_detail: string | null;
  similarity_pct: number | null;
  citation_detected: boolean;
  status: PassageStatus;
  reviewer_note: string | null;
  created_at: string;
}

export interface ReviewExportRow {
  id: string;
  user_id: string;
  review_id: string;
  kind: 'docx' | 'pdf';
  storage_path: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}
