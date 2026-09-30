/**
 * Document style profile for the Writing Assistant.
 *
 * PURE local computation: no network calls, no LLM. The profile is built from
 * the author's own extracted text and is used to keep AI revisions matched to
 * the author's natural style. It is never based on, and never references,
 * any plagiarism detector, similarity score, or AI detector.
 */

import type {
  CitationStyle,
  ExtractedDocument,
  StyleProfile,
  StyleProfileResult,
  StyleProfileRow,
} from "./types";

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'“(\[])/;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function words(text: string): string[] {
  const m = text.toLowerCase().match(/[a-z0-9'-]+/g);
  return m ?? [];
}

const SUBORDINATORS = new Set([
  "although", "though", "because", "since", "while", "whereas", "if", "unless",
  "until", "after", "before", "when", "whenever", "as", "so", "therefore",
  "thus", "however", "moreover", "furthermore", "consequently", "whereby",
  "which", "that", "who", "whom", "whose",
]);

const PAST_MARKERS = /\b(was|were|had|did|said|showed|found|reported|conducted|observed|indicated|suggested|demonstrated)\b/;
const FUTURE_MARKERS = /\b(will|shall|'ll|going to|plan to|aim to|intend to)\b/;
const PASSIVE_RE = /\b(am|is|are|was|were|be|been|being)\s+\w+(ed|en)\b/i;
const FIRST_PERSON_RE = /\b(i|we|my|our|us|mine|ours)\b/i;
const THIRD_PERSON_RE = /\b(he|she|it|they|his|her|its|their|theirs)\b/i;

const BRITISH_WORDS = new Set([
  "colour", "colours", "favour", "favours", "behaviour", "behaviours", "organisation",
  "organisations", "realise", "realised", "recognise", "recognised", "analyse",
  "analysed", "centre", "centres", "metre", "litre", "defence", "licence",
  "cheque", "programme", "travelling", "cancelled", "labour", "neighbour",
  "fibre", "theatre", "grey", "mould", "plough", "manoeuvre", "finalise",
]);
const AMERICAN_WORDS = new Set([
  "color", "colors", "favor", "favors", "behavior", "behaviors", "organization",
  "organizations", "realize", "realized", "recognize", "recognized", "analyze",
  "analyzed", "center", "centers", "meter", "liter", "defense", "license",
  "check", "program", "traveling", "canceled", "labor", "neighbor",
  "fiber", "theater", "gray", "mold", "plow", "maneuver", "finalize",
]);

const CONNECTING_PHRASES = [
  "however", "furthermore", "moreover", "therefore", "in addition",
  "in contrast", "for example", "for instance", "consequently",
  "nevertheless", "nonetheless", "in particular", "as a result",
  "on the other hand", "firstly", "secondly", "finally", "in conclusion",
  "in summary", "notably", "specifically", "accordingly", "hence",
  "although", "whereas", "despite", "in spite of",
];

const INFORMAL_MARKERS = new Set([
  "really", "very", "pretty", "quite", "stuff", "things", "a lot", "lots",
  "get", "got", "gonna", "wanna", "yeah", "ok", "okay", "awesome", "cool",
  "basically", "actually", "well",
]);

const AUTHOR_YEAR_RE = /\([A-Z][A-Za-z'’\-]+(?:\s+et al\.?)?(?:\s*,\s*\d{4}[a-z]?)(?:\s*;\s*[A-Z][A-Za-z'’\-]+(?:\s+et al\.?)?(?:\s*,\s*\d{4}[a-z]?))*\)/g;
const NUMBERED_RE = /\[\d+(?:\s*,\s*\d+)*\]/g;
const HARVARD_INLINE_RE = /\b[A-Z][A-Za-z'’\-]+(?:\s+et al\.?)?\s*\(\d{4}[a-z]?\)/g;

function detectCitationStyle(text: string): CitationStyle {
  const authorYear = (text.match(AUTHOR_YEAR_RE) ?? []).length;
  const numbered = (text.match(NUMBERED_RE) ?? []).length;
  const harvard = (text.match(HARVARD_INLINE_RE) ?? []).length;
  const total = authorYear + numbered + harvard;
  if (total === 0) return "unknown";
  if (authorYear >= numbered && authorYear >= harvard) return "apa";
  if (harvard > authorYear && harvard >= numbered) return "harvard";
  if (numbered > authorYear && numbered > harvard) return "numbered";
  return "unknown";
}

function extractTechnicalTerms(text: string): string[] {
  // Frequent multi-word noun phrases: sequences of capitalized or
  // domain-specific words appearing repeatedly.
  const counts = new Map<string, number>();
  const phraseRe = /\b([A-Z][a-z]{2,}(?:\s+[A-Za-z][a-z]{2,}){1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(text)) !== null) {
    const phrase = m[1].replace(/\s+/g, " ").trim();
    if (phrase.split(" ").length < 2) continue;
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  // Also frequent lowercase bigrams of longer words.
  const bigramRe = /\b([a-z]{5,})\s+([a-z]{5,})\b/g;
  while ((m = bigramRe.exec(text)) !== null) {
    const phrase = `${m[1]} ${m[2]}`;
    if (SUBORDINATORS.has(m[1]) || SUBORDINATORS.has(m[2])) continue;
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([phrase]) => phrase);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export function computeStyleProfile(doc: ExtractedDocument): StyleProfileResult {
  const fullText = doc.sections
    .map((s) => [s.heading, ...s.paragraphs].join(" "))
    .join(" ");

  const sentences = doc.sections.flatMap((s) =>
    s.paragraphs.flatMap((p) => splitSentences(p))
  );
  const allWords = words(fullText);
  const wordCount = allWords.length || 1;

  const sentenceLengths = sentences.map((s) => words(s).length);
  const avgSentenceLengthWords =
    sentences.length === 0
      ? 0
      : Math.round(
          (sentenceLengths.reduce((a, b) => a + b, 0) / sentences.length) * 10
        ) / 10;

  const complexCount = sentences.filter((s) => {
    const ws = words(s);
    const hasSub = ws.some((w) => SUBORDINATORS.has(w));
    const commas = (s.match(/,/g) ?? []).length;
    return (hasSub && ws.length > 14) || commas >= 2 || ws.length > 28;
  }).length;
  const complexRatio =
    sentences.length === 0 ? 0 : complexCount / sentences.length;
  const sentenceComplexity: StyleProfile["sentenceComplexity"] =
    complexRatio > 0.45 ? "complex" : complexRatio > 0.2 ? "moderate" : "simple";

  const paragraphSentenceCounts = doc.sections.flatMap((s) =>
    s.paragraphs.map((p) => splitSentences(p).length)
  );
  const avgParagraphLengthSentences =
    paragraphSentenceCounts.length === 0
      ? 0
      : Math.round(
          (paragraphSentenceCounts.reduce((a, b) => a + b, 0) /
            paragraphSentenceCounts.length) *
            10
        ) / 10;

  const longWordRatio =
    allWords.filter((w) => w.length >= 8).length / wordCount;
  const informalHits = allWords.filter((w) => INFORMAL_MARKERS.has(w)).length;
  const formalityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(45 + longWordRatio * 160 - (informalHits / wordCount) * 900)
    )
  );
  const vocabLevel: StyleProfile["vocabLevel"] =
    longWordRatio > 0.22 ? "advanced" : longWordRatio > 0.14 ? "moderate" : "simple";

  let past = 0,
    present = 0,
    future = 0;
  for (let si = 0; si < sentences.length; si += 1) {
    const s = sentences[si];
    const lower = s.toLowerCase();
    if (PAST_MARKERS.test(lower)) past += 1;
    else if (FUTURE_MARKERS.test(lower)) future += 1;
    else present += 1;
  }
  const totalTense = past + present + future || 1;
  const tenseDistribution = {
    past: Math.round((past / totalTense) * 100),
    present: Math.round((present / totalTense) * 100),
    future: Math.round((future / totalTense) * 100),
  };

  const passive = sentences.filter((s) => PASSIVE_RE.test(s)).length;
  const activePassiveRatio = {
    active: sentences.length - passive,
    passive,
  };

  const personUsage = {
    firstPerson: sentences.filter((s) => FIRST_PERSON_RE.test(s)).length,
    thirdPerson: sentences.filter((s) => THIRD_PERSON_RE.test(s)).length,
  };

  const technicalTerms = extractTechnicalTerms(fullText);

  let british = 0,
    american = 0;
  for (let wi = 0; wi < allWords.length; wi += 1) {
    const w = allWords[wi];
    if (BRITISH_WORDS.has(w)) british += 1;
    else if (AMERICAN_WORDS.has(w)) american += 1;
  }

  const lowerFull = fullText.toLowerCase();
  const connectingPhrases = CONNECTING_PHRASES.map((phrase) => {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "g");
    return { phrase, count: (lowerFull.match(re) ?? []).length };
  })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const citationStyle = detectCitationStyle(fullText);

  const toneBits: string[] = [];
  toneBits.push(
    formalityScore >= 70
      ? "formal"
      : formalityScore >= 45
        ? "moderately formal"
        : "plain and direct"
  );
  toneBits.push(
    vocabLevel === "advanced"
      ? "advanced vocabulary"
      : vocabLevel === "moderate"
        ? "moderate vocabulary"
        : "simple, accessible vocabulary"
  );
  toneBits.push(
    `predominantly ${tenseDistribution.past >= tenseDistribution.present && tenseDistribution.past >= tenseDistribution.future ? "past" : tenseDistribution.present >= tenseDistribution.future ? "present" : "future"} tense`
  );
  if (passive > sentences.length * 0.3) toneBits.push("frequent passive voice");
  if (personUsage.firstPerson > sentences.length * 0.1)
    toneBits.push("first-person voice present");
  const toneSummary = `A ${toneBits.join(", ")} academic writing style. Revisions will preserve this style rather than replace it with a generic one.`;

  const profile: StyleProfile = {
    avgSentenceLengthWords,
    sentenceComplexity,
    avgParagraphLengthSentences,
    formalityScore,
    vocabLevel,
    tenseDistribution,
    activePassiveRatio,
    personUsage,
    technicalTerms,
    spelling: { british, american },
    connectingPhrases,
    citationStyle,
    toneSummary,
  };

  const citationLabel =
    citationStyle === "unknown"
      ? "Not detected"
      : capitalize(citationStyle) +
        (citationStyle === "apa" ? " (author, year)" : citationStyle === "harvard" ? " (Author year)" : " ([1], [2])");

  const spellingLabel =
    british === 0 && american === 0
      ? "No distinctive markers"
      : british >= american
        ? `British (${british}) / American (${american})`
        : `American (${american}) / British (${british})`;

  const academicLevel =
    formalityScore >= 70 && vocabLevel !== "simple"
      ? "Advanced academic"
      : formalityScore >= 45
        ? "Standard academic"
        : "Plain academic";

  const displayRows: StyleProfileRow[] = [
    { label: "Academic level", value: academicLevel },
    { label: "Formality", value: `${formalityScore}/100` },
    { label: "Vocabulary level", value: capitalize(vocabLevel) },
    {
      label: "Sentence length",
      value: `${avgSentenceLengthWords} words (avg)`,
    },
    {
      label: "Sentence complexity",
      value: capitalize(sentenceComplexity),
    },
    {
      label: "Paragraph length",
      value: `${avgParagraphLengthSentences} sentences (avg)`,
    },
    {
      label: "Tense usage",
      value: `Past ${tenseDistribution.past}% / Present ${tenseDistribution.present}% / Future ${tenseDistribution.future}%`,
    },
    {
      label: "Active / passive voice",
      value: `${activePassiveRatio.active} active / ${activePassiveRatio.passive} passive sentences`,
    },
    {
      label: "First / third person",
      value:
        personUsage.firstPerson > 0
          ? `First person (${personUsage.firstPerson}) and third person (${personUsage.thirdPerson})`
          : `Third person (${personUsage.thirdPerson} sentences)`,
    },
    {
      label: "Spelling",
      value: spellingLabel,
    },
    {
      label: "Citation style",
      value: citationLabel,
    },
    { label: "Overall tone", value: toneSummary },
  ];

  return { profile, displayRows };
}
