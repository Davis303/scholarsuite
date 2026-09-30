# Spec 3 — Similarity Review Workspace (premium SaaS)

Document analysis + review tool. Upload original (DOCX/PDF) + similarity report (PDF);
identify matched passages; produce a highlighted review copy. PRESERVES the original as
much as technically possible. NEVER rewrites, paraphrases, or alters academic content.
FORBIDDEN: auto-paraphrasing/rewriting of matched passages, AI-detector bypassing,
similarity-score manipulation, evasion instructions, fake scores, fake processing.

## Brand
Premium SaaS, academic/research focused, clean minimal, trustworthy, high-quality
typography, whitespace, subtle borders, soft shadows, cards, slightly rounded corners,
subtle micro-interactions. Sophisticated neutral + ONE strong primary brand color
(see CONTRACTS.md tokens). No childish illustrations, no gratuitous gradients, no
generic AI-robot graphics. Equally appropriate for researchers, editors, consultants,
university staff.

## Landing page
Hero: headline like "Review Academic Similarity Reports With Precision"; subheading
explaining upload → identify matches → highlighted review copy; CTAs "Start New Review"
(primary) and "View Demo" (secondary); professional product preview of the review UI.
Sections: How it works, Key features, Document review workflow, Security and privacy,
Supported file formats, Professional use cases, FAQ, Final CTA. No exaggerated claims.

## Main dashboard (after auth)
Left sidebar: Dashboard, New Review, My Reviews, Documents, Reports, Settings; bottom:
profile, account settings, sign out. Top nav: page title, search, notifications, avatar.
"Start New Review" prominent button. Stat cards: Total Reviews, Documents Reviewed,
Matched Passages, Recent Reviews. Recent reviews table: Document, Status, Matches,
Created, Last Updated, Actions. Status badges: Processing, Ready, Review Required,
Completed, Failed. Polished responsive table.

## New Review wizard (multi-step, real backend states)
Step 1: Upload Original Document (DOCX/PDF). Step 2: Upload Similarity Report (PDF).
Step 3: Processing — real stages: Reading document → Reading report → Detecting matched
passages → Mapping matches to document → Preparing review copy. Never fake progress.
Step 4: Review Results — total matched passages, pages affected, sources detected,
passages requiring review.
Drag-and-drop uploader: large drop zone, browse button, file type + size validation,
upload progress, cancel, remove/replace, error messages, success state; file card shows
icon, filename, type, size, status.

## Review workspace (most important screen) — split screen
Left: document navigation — page thumbnails, page numbers, search, match navigation,
match count. Center: document preview as close to original as possible, matched
passages highlighted. Right: "Match Details" panel — match number, page number,
matched passage, source info, similarity % (if in report), citation detected status,
review status. Statuses: Needs Review, Properly Cited, Direct Quote, Common Knowledge,
Citation Check, Source Verification. Neutral terminology only ("Matched Text",
"Similarity Match", "Source Match") — never auto-label plagiarism.
Match navigation: Previous/Next Match buttons, "Match 7 of 24" counter; selecting a
match scrolls the document to it and emphasizes it (distinct treatment vs others).

## Highlighted export
"Export Highlighted Document" → separate review copy (never modify original).
Preserve as much as possible: fonts, sizes, headings, spacing, alignment, tables,
images, page structure, headers/footers, citations, references, numbering, lists,
bold/italics/underline. "Download Highlighted DOCX"; PDF export when reliable.
For PDF originals where in-place highlighting is unreliable, generate a clearly-labeled
review-copy PDF (extracted text + highlighted matches) and say so honestly in the UI.

## Document safety & history
Maintain Original Document / Similarity Report / Generated Review Copy; never
overwrite original; show file relationships per review. History page: document name,
date, matches, status, last activity, exported files; actions Open Review, Download
Highlighted Copy, View Report, Delete Review (confirm before permanent delete).

## Search & filters
Document search, date filter, status filter, match count filter (client-side for small
sets, server-side pagination for large).

## Security & privacy
Auth + authorization, per-user isolation (RLS), secure storage, private file URLs,
signed temporary download URLs, server-side validation (magic bytes, never trust
extensions), file size limits, rate limiting, secure endpoints, audit logging for
document actions, no public indexing, auto cleanup of temp files, dedicated Privacy
section/page explaining: documents are private, belong to the user, not publicly
accessible, deletable, temp files auto-removed, never used for training without consent.

## Responsive & accessibility
Desktop-first review workspace; side panels become collapsible drawers on small
screens. Keyboard navigation, visible focus states, proper labels, accessible dialogs,
contrast, clear errors, no color-only information. Breadcrumbs, tooltips, confirmation
dialogs, copy-to-clipboard for matched text, download history, recent activity.

## Design system & states
Typography scale, buttons (Primary/Secondary/Tertiary/Destructive), inputs, cards,
tables, badges, modals, dropdowns, tooltips, toasts, empty/loading/error states —
build once in components/ui, reuse. Human-readable errors, e.g. "Your document could
not be processed.", "The similarity report format could not be recognized.",
"The uploaded file is too large." Never expose raw backend errors.

## Report parsing (lib/reviews)
Extract PDF text with page numbers. Heuristics for common report formats: quoted
passage blocks, numbered match lists ("1. ..."), "Sources"/"Matches" sections,
similarity percentages near matches. Always offer manual "add passage" fallback and an
"unparsed report" state with guidance. Match passages into the original document with
normalized fuzzy matching (whitespace/case/punctuation-insensitive, token-overlap
scoring); record page number + surrounding paragraph; mark low-confidence mappings for
reviewer verification. Detect citations near each passage (APA/Harvard/numbered regex).
