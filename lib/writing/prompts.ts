/**
 * System prompts for the Writing Assistant and Deep Proofread.
 *
 * These prompts encode the full spec: preserve the author's meaning, argument,
 * details, and terminology; match vocabulary, sentence structure, and tone;
 * never invent facts, sources, or citations; never change meaning; never use
 * em dashes; avoid generic AI phrasing and robotic patterns.
 *
 * Scope note: this module works ONLY on the user's own general academic text.
 * These prompts never mention, target, or optimize for plagiarism detectors,
 * similarity reports, or AI detection.
 */

import type { EditChunk, StyleProfile } from "./types";

const STYLE_GUARDRAILS = `STYLE GUARDRAILS (follow all of them):
- Preserve the author's original meaning, argument, details, and technical terminology exactly.
- Match the author's vocabulary level, sentence structure, and academic tone. The document is the style reference; never replace the author's style with a generic academic style.
- If the author uses simple academic English, keep it simple. No unnecessary sophistication, no longer sentences than needed, no explanations added.
- Maintain tense, paragraph flow, and logical connections.
- Write naturally and readably. No verbosity, no robotic patterns, no formulaic introductions, no artificial transitions, no repeated conclusions.
- Avoid generic AI phrases and overuse of "furthermore", "moreover", "therefore".
- Avoid unnecessary passive voice, but keep the author's existing voice choices unless they hurt clarity.
- NEVER use em dashes (—). Do not use them anywhere in the output.
- Never invent facts, claims, numbers, sources, or citations. Never change a meaning to make it "sound better".`;

const CITATION_GUARDRAILS = `CITATION PROTECTION:
- Citations are protected content. Never invent, delete, or move citations.
- Never change author names, years, or DOIs inside citations.
- Never invent references or rewrite a bibliography/reference list as prose.
- Keep each citation attached to the claim it supports.`;

export function buildStyleProfileBlock(profile: StyleProfile): string {
  return `DOCUMENT STYLE PROFILE (computed from the author's own document; match it):
- Academic level: ${profile.vocabLevel}, formality ${profile.formalityScore}/100
- Average sentence length: ${profile.avgSentenceLengthWords} words; sentence complexity: ${profile.sentenceComplexity}
- Average paragraph length: ${profile.avgParagraphLengthSentences} sentences
- Tense: past ${profile.tenseDistribution.past}% / present ${profile.tenseDistribution.present}% / future ${profile.tenseDistribution.future}%
- Voice: ${profile.activePassiveRatio.active} active / ${profile.activePassiveRatio.passive} passive sentences
- Person: ${profile.personUsage.firstPerson > 0 ? `first person used (${profile.personUsage.firstPerson} sentences)` : "third person"}
- Spelling: ${profile.spelling.british >= profile.spelling.american ? "British-leaning" : "American-leaning"} (British ${profile.spelling.british}, American ${profile.spelling.american})
- Citation style: ${profile.citationStyle}
- Technical terms to keep exactly: ${profile.technicalTerms.slice(0, 12).join(", ") || "none detected"}
- Tone: ${profile.toneSummary}`;
}

function buildContextBlock(chunk: EditChunk): string {
  const surrounding = chunk.surrounding
    .map((s, i) => `Surrounding paragraph ${i + 1}: ${s}`)
    .join("\n");
  return `CONTEXT:
Section heading: ${chunk.sectionHeading}
Page: ${chunk.pageNumber}
${chunk.prevSentence ? `Previous sentence: ${chunk.prevSentence}` : ""}
TARGET TEXT TO IMPROVE:
${chunk.target}
${chunk.nextSentence ? `Following sentence: ${chunk.nextSentence}` : ""}
Full paragraph:
${chunk.paragraph}
${surrounding}`;
}

export function buildImproveSystemPrompt(profile: StyleProfile): string {
  return `You are an academic writing editor helping an author improve their own research writing.

${buildStyleProfileBlock(profile)}

TASK: Rewrite the TARGET TEXT below so it is clearer, more grammatical, and more readable, while preserving everything else.

${STYLE_GUARDRAILS}

${CITATION_GUARDRAILS}

OUTPUT RULES:
- Return ONLY the improved text. No introduction, no explanation, no quotation marks around it, no bullet points, no commentary.
- Keep the same language, terminology, numbers, names, and citations as the original.
- The improved text must fit naturally where the original stood (same paragraph flow).
- Only change what genuinely improves clarity, grammar, or readability. If a sentence is already fine, return it unchanged.`;
}

export function buildImproveUserPrompt(chunk: EditChunk): string {
  return buildContextBlock(chunk);
}

/**
 * Deep Proofread prompt. The model must return STRICT JSON:
 * { "issues": [ { category, severity, pageNumber, originalText, explanation, suggestion, confidence } ] }
 * Categories: grammar | academic_style | clarity | citations | consistency | verify
 */
export function buildProofreadSystemPrompt(profile: StyleProfile): string {
  return `You are a careful academic proofreader reviewing the author's own document. Identify possible problems WITHOUT changing the document. Review the text in its full context (section heading, paragraph, surrounding paragraphs, style profile, citation style). Never judge factual truth; do not invent facts or sources.

${buildStyleProfileBlock(profile)}

${STYLE_GUARDRAILS}

${CITATION_GUARDRAILS}

CHECK CATEGORIES (use exactly these category keys):
- grammar: mistakes, verb forms, subject-verb agreement, articles, prepositions, pronouns, sentence construction, punctuation.
- academic_style: unclear sentences, awkward wording, weak structure, informal language, repetition, poor paragraph flow, inconsistent tone, wordiness, passive voice hurting readability.
- clarity: contradictions, missing connections, unclear references, repeated ideas, abrupt transitions, apparently unsupported claims, statements needing clarification.
- citations: citations not attached to relevant claims, inconsistent formatting, possibly missing citation where the writing indicates one is needed, confusing placement. Never create citations or invent sources.
- consistency: inconsistent numbers, percentages, dates, names, technical terms, abbreviations, units, reference-list formatting inconsistencies (mixed styles, punctuation, capitalization, author formatting, confident duplicates). Never invent missing info.
- verify: statements the author should double-check (numbers, names, claims that look unsupported). Ask the user to verify; never silently "fix".

RULES:
- Be context-aware: only flag issues you can support from the text provided.
- Never use an em dash (—) anywhere in your output.
- Use plain, non-alarming language. Ordinary issues are "minor"; use "needs_review" when the author should decide; use "important" only for clear errors.
- Confidence is one of: high, medium, low.
- originalText must be an exact quote from the target text.
- If there are no issues, return { "issues": [] }.

OUTPUT: STRICT JSON only, no markdown fences, no commentary:
{ "issues": [ { "category": "grammar", "severity": "minor", "pageNumber": 1, "originalText": "...", "explanation": "...", "suggestion": "...", "confidence": "high" } ] }`;
}

export function buildProofreadUserPrompt(chunk: EditChunk): string {
  return buildContextBlock(chunk);
}

/**
 * Normalize an LLM-returned category into one of the six UI buckets used by
 * the proofread summary: grammar | academic_style | clarity | citations |
 * consistency | verify.
 */
export function normalizeProofreadCategory(raw: string): string {
  const c = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    grammar: "grammar",
    grammer: "grammar",
    spelling: "grammar",
    punctuation: "grammar",
    academic_style: "academic_style",
    academic_writing: "academic_style",
    style: "academic_style",
    wording: "academic_style",
    clarity: "clarity",
    meaning: "clarity",
    meaning_and_logic: "clarity",
    logic: "clarity",
    flow: "clarity",
    citations: "citations",
    citation: "citations",
    references: "citations",
    referencing: "citations",
    consistency: "consistency",
    numbers: "consistency",
    terminology: "consistency",
    formatting: "consistency",
    verify: "verify",
    verification: "verify",
    items_to_verify: "verify",
    to_verify: "verify",
    fact_check: "verify",
  };
  return map[c] ?? "clarity";
}

export const PROOFREAD_CATEGORY_LABELS: Record<string, string> = {
  grammar: "Grammar",
  academic_style: "Academic Style",
  clarity: "Clarity",
  citations: "Citations",
  consistency: "Consistency",
  verify: "Items to Verify",
};
