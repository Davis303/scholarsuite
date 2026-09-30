/**
 * Client-side types for the writing editor page.
 */

export interface EditorDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  heading: string;
  paragraphs: string[];
  pageNumber: number;
}

export interface ParaRef {
  ref: string;
  sectionHeading: string;
  pageNumber: number;
  text: string;
}

export interface Revision {
  id: string;
  scope: string;
  section_ref: string;
  original_text: string;
  revised_text: string;
  status: "suggested" | "accepted" | "rejected" | "edited";
  created_at: string;
}

export interface ProofreadRun {
  id: string;
  scope: string;
  status: string;
  summary: {
    counts: Record<string, number>;
    total: number;
    chunks: number;
  } | null;
  created_at: string;
}

export interface ProofreadIssue {
  id: string;
  run_id: string;
  category: string;
  severity: "minor" | "needs_review" | "important";
  page_number: number;
  original_text: string;
  explanation: string;
  suggestion: string;
  confidence: string;
  status: "open" | "accepted" | "rejected" | "ignored";
}

export type Scope = "selection" | "paragraph" | "section" | "document";

export interface DetailPayload {
  document: EditorDoc;
  pageCount: number | null;
  warnings: string[];
  sections: Section[];
  paragraphs: ParaRef[];
  styleProfile: unknown;
  styleProfileRows: { label: string; value: string }[];
  revisions: Revision[];
  proofreadRuns: ProofreadRun[];
  llmConfigured: boolean;
}
