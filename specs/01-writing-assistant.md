# Spec 1 — Academic Writing Assistant

General academic writing/editing tool for the user's OWN research writing.
HARD SCOPE: it must NOT analyze, target, optimize, or modify text based on plagiarism
detectors, similarity reports, Turnitin scores, or AI-detection scores. It works
independently on user-provided academic text. The writing module must not offer any
similarity-report upload or mention detectors anywhere.

## Core workflow
1. Upload academic document (PDF or DOCX).
2. Extract preserving headings, paragraphs, tables (where possible), citations,
   references, page order, document structure.
3. Analyze the complete document BEFORE suggestions; build an internal
   document-specific writing style profile.
4. User chooses scope: selected passage | paragraph | section | entire document.
5. System processes the selected content automatically (background for large docs).

## Document style profile (computed locally, no LLM needed)
Academic level, formality, vocabulary level, sentence length, sentence complexity,
paragraph length, sentence patterns, tense usage, active/passive voice,
first/third-person usage, technical terminology, British vs American English,
connecting phrases, citation style, overall tone. Displayed as "Document Style Profile"
with detected values. The document is the primary style reference — never replace the
author's style with a generic academic style.

## Writing requirements (LLM prompt constraints)
Preserve original meaning, argument, details, technical terminology; match vocabulary
level, sentence structure, academic tone; maintain tense and paragraph flow; natural and
readable; no unnecessary sophistication, long sentences, or explanations; never add
unsupported claims; never invent facts/sources/citations; never change meaning to sound
better; NEVER use em dashes. Avoid: generic AI phrases, repetitive structures,
overly polished language, unnecessary academic vocabulary, formulaic intros, artificial
transitions, repeated conclusions, overuse of furthermore/moreover/therefore,
unnecessary passive voice, robotic patterns, verbosity. If the author uses simple
academic English, keep it simple.

## Context-aware editing
For each edit the model receives: section heading, previous sentence, selected
sentence(s), following sentence, complete paragraph, relevant surrounding paragraphs,
document style profile. Revised text must fit naturally into the paragraph.

## Meaning preservation / quality check (server-side, automatic)
After generating a revision, verify: meaning, facts, numbers, names, technical
terminology, claims, citations, tense, context, writing style. Also: natural grammar,
academic tone maintained, original style maintained, citation preserved, no unsupported
info, no invented sources, no em dash, no unnecessary wording, no robotic phrasing.
If a check fails, regenerate automatically (max 2 retries, then surface to user).

## Citation protection
Citations are protected content. Never invent/delete citations; never change author
names, years, DOIs; never invent references; keep citation attached to its claim.
Never rewrite the bibliography/reference list as prose. A separate
citation-formatting analysis may flag inconsistencies but must not invent missing info.

## Editing interface
Side-by-side: ORIGINAL | IMPROVED VERSION. Actions per suggestion: Accept, Regenerate,
Edit (manual), Keep Original. Text selection by highlighting in document; paragraph/
section pickers. Full-document mode: process section by section, preserve headings/
structure/citations/references; only change what improves clarity/grammar/readability.

## Output
[Download DOCX] [Download PDF] [View Changes] — change view shows Original → Improved
per edited passage. Only accepted/edited revisions are applied to exports.

## Dashboard (writing docs table)
Columns: Document Name, Status (Uploaded/Analyzing/Processing/Review Ready/Completed/
Error), Pages, Sections Processed, Edits Made, Date, Download. Search + filter.

## Processing progress (real states)
"Analyzing document" → "Building writing style profile" → "Processing Section X of Y"
→ "Checking citations" → "Running quality checks" → "Preparing document" → "Complete".

## Privacy
Per-user isolation (RLS), private storage, auto-deletion settings, no public URLs,
separate user workspaces. Audit log on upload/delete/export.

## Error handling
If a PDF page can't be extracted, say which page. If a citation can't be confidently
identified, don't guess. Large docs processed in sections with the same style profile.
LLM key missing → clear notice that AI features need configuration (DEPLOY.md), all
other features keep working.
