/**
 * Context window chunking for the Writing Assistant.
 *
 * Splits extracted sections into context windows so the LLM always sees the
 * target text together with its section heading, neighbouring sentences, the
 * full paragraph, and surrounding paragraphs, never isolated sentences.
 */

import type { EditChunk, ExtractedDocument } from "./types";

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'“(\[])/;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Build one chunk per section: the whole section text as the target with
 * neighbouring-section context. Used for section/document scope.
 */
export function chunkDocument(doc: ExtractedDocument): EditChunk[] {
  const chunks: EditChunk[] = [];
  doc.sections.forEach((section, idx) => {
    const paragraph = section.paragraphs.join("\n\n");
    if (paragraph.trim().length === 0) return;
    const sentences = splitSentences(paragraph);
    const prevSection = doc.sections[idx - 1];
    const nextSection = doc.sections[idx + 1];
    chunks.push({
      sectionHeading: section.heading || `Section ${idx + 1}`,
      prevSentence: sentences[0] ?? "",
      target: paragraph,
      nextSentence: sentences[sentences.length - 1] ?? "",
      paragraph,
      surrounding: [
        prevSection
          ? `Previous section "${prevSection.heading}": ${prevSection.paragraphs.slice(-1).join(" ")}`.slice(0, 600)
          : "",
        nextSection
          ? `Next section "${nextSection.heading}": ${nextSection.paragraphs[0] ?? ""}`.slice(0, 600)
          : "",
      ].filter((s) => s.length > 0),
      pageNumber: section.pageNumber,
      sectionRef: `section-${idx}`,
    });
  });
  return chunks;
}

/**
 * Build a chunk around an explicit target text (selection or paragraph scope).
 * The target is located inside the extracted sections when possible so real
 * context is attached; otherwise the caller-supplied paragraph is used.
 */
export function chunkAroundTarget(
  doc: ExtractedDocument,
  targetText: string,
  sectionRef?: string
): EditChunk {
  const target = targetText.trim();
  for (let si = 0; si < doc.sections.length; si += 1) {
    const section = doc.sections[si];
    if (sectionRef && sectionRef !== `section-${si}`) continue;
    for (let pi = 0; pi < section.paragraphs.length; pi += 1) {
      const paragraph = section.paragraphs[pi];
      if (!paragraph.includes(target.slice(0, 40))) continue;
      const sentences = splitSentences(paragraph);
      const targetSentences = splitSentences(target);
      const firstTarget = targetSentences[0] ?? "";
      const idx = sentences.findIndex((s) =>
        s.includes(firstTarget.slice(0, 40))
      );
      return {
        sectionHeading: section.heading || `Section ${si + 1}`,
        prevSentence: idx > 0 ? sentences[idx - 1] : "",
        target,
        nextSentence:
          idx >= 0 && idx + targetSentences.length < sentences.length
            ? sentences[idx + targetSentences.length]
            : "",
        paragraph,
        surrounding: [
          section.paragraphs[pi - 1] ?? "",
          section.paragraphs[pi + 1] ?? "",
        ].filter((s) => s.length > 0),
        pageNumber: section.pageNumber,
        sectionRef: `section-${si}`,
      };
    }
  }
  // Target not found in extraction: return it with whatever context exists.
  const first = doc.sections[0];
  return {
    sectionHeading: first?.heading ?? "",
    prevSentence: "",
    target,
    nextSentence: "",
    paragraph: target,
    surrounding: [],
    pageNumber: first?.pageNumber ?? 1,
    sectionRef: sectionRef ?? "selection",
  };
}

/**
 * Paragraph picker helper: every paragraph with a stable reference.
 */
export function listParagraphs(
  doc: ExtractedDocument
): { ref: string; sectionHeading: string; pageNumber: number; text: string }[] {
  const out: { ref: string; sectionHeading: string; pageNumber: number; text: string }[] = [];
  doc.sections.forEach((section, si) => {
    section.paragraphs.forEach((text, pi) => {
      out.push({
        ref: `section-${si}:para-${pi}`,
        sectionHeading: section.heading || `Section ${si + 1}`,
        pageNumber: section.pageNumber,
        text,
      });
    });
  });
  return out;
}
