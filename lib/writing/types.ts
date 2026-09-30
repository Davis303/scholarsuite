/**
 * Shared types for the Writing Assistant module (ScholarSuite).
 * This module edits ONLY the user's own general academic text.
 * It never accepts similarity reports and never references
 * plagiarism detectors, similarity scores, or AI detection.
 */

export interface ExtractedSection {
  heading: string;
  paragraphs: string[];
  pageNumber: number;
}

export interface ExtractedDocument {
  sections: ExtractedSection[];
  pageCount: number;
  warnings: string[];
}

export type CitationStyle = "apa" | "harvard" | "numbered" | "unknown";

export interface StyleProfile {
  avgSentenceLengthWords: number;
  sentenceComplexity: "simple" | "moderate" | "complex";
  avgParagraphLengthSentences: number;
  formalityScore: number; // 0-100
  vocabLevel: "simple" | "moderate" | "advanced";
  tenseDistribution: { past: number; present: number; future: number };
  activePassiveRatio: { active: number; passive: number };
  personUsage: { firstPerson: number; thirdPerson: number };
  technicalTerms: string[];
  spelling: { british: number; american: number };
  connectingPhrases: { phrase: string; count: number }[];
  citationStyle: CitationStyle;
  toneSummary: string;
}

export interface StyleProfileRow {
  label: string;
  value: string;
}

export interface StyleProfileResult {
  profile: StyleProfile;
  displayRows: StyleProfileRow[];
}

export interface EditChunk {
  sectionHeading: string;
  prevSentence: string;
  target: string;
  nextSentence: string;
  paragraph: string;
  surrounding: string[];
  pageNumber: number;
  sectionRef: string;
}

export type ImproveScope = "selection" | "paragraph" | "section" | "document";

export interface ProofreadIssueInput {
  category: string;
  severity: "minor" | "needs_review" | "important";
  pageNumber: number;
  originalText: string;
  explanation: string;
  suggestion: string;
  confidence: string;
}

export interface QualityCheckResult {
  pass: boolean;
  failures: string[];
}

export type RevisionStatus = "suggested" | "accepted" | "rejected" | "edited";
export type IssueStatus = "open" | "accepted" | "rejected" | "ignored";

export interface ChangeItem {
  id: string;
  scope: string;
  sectionRef: string;
  original: string;
  revised: string;
  status: RevisionStatus;
}
