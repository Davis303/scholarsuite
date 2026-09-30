# Spec 5 — Product Shape: One Product, Two Modules, One Auth

ScholarSuite is ONE product at ONE URL with ONE auth system. A single sign-up /
sign-in / remember-me / guest account works across everything — no second login,
no re-uploading between modules.

Inside it are TWO modules, like "two buildings, each with its own stairs, plus a
bridge between them":

## The two buildings (own top-level nav entry, own complete workflow)
1. **Writing Assistant** (+ Deep Proofread) — module home at `/writing`.
   A user can live entirely here: upload own documents, style profile, improve
   flows, proofread, exports.
2. **Similarity Review Workspace** — module home at `/reviews`.
   A user can live entirely here: upload original + report, wizard, review
   workspace, highlighted exports, history.

## The bridge (both directions, no re-upload)
- **Shared document library** at `/documents`, visible/linked from both modules.
  Lists every user document regardless of kind (`original`, `similarity_report`,
  `writing`) with per-kind actions.
- From any similarity review: **"Open in Writing Assistant"** — carries the
  original document over. Implementation: `POST /api/writing/from-document`
  `{ documentId }` → creates a `writing_docs` row reusing the SAME storage path
  (bucket `documents`), returns `{ writingDocId }`; UI routes to
  `/writing/{writingDocId}`. No file re-upload.
- From the writing assistant: **"Send to similarity review"** — ensures a
  `documents` row (`kind='original'`) exists for the file (create if missing,
  reusing the same storage path), returns `{ documentId }`; UI routes to
  `/reviews/new?documentId={documentId}` which preselects it in the wizard.
- Shared user context throughout: same session, same RLS identity, same audit log.

## Unified guest mode
One guest session (Supabase anonymous auth) can use both modules under the same
temporary-data rules (session-scoped, auto-deleted, single upgrade prompt to
create an account). Guest → account conversion preserves rows in both modules
(same `user_id`).

## Navigation (sidebar)
Dashboard · Writing Assistant · New Review · My Reviews · Documents · Settings.
"New Review" and "My Reviews" both route into the reviews module (`/reviews/new`,
`/reviews`). Each module home has cross-links to the other ("bridge" links).
