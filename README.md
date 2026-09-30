# ScholarSuite

ScholarSuite is a private academic workspace — one product, one sign-in — that
combines two modules around a shared document library:

- **Writing Assistant** (with Deep Proofread mode) — improve the clarity,
  grammar, and style of your own academic writing.
- **Similarity Review Workspace** — upload a document plus its similarity
  report, identify matched passages, and produce a highlighted review copy.

One account (or guest session) works across both modules with no second login
and no re-uploading: a document uploaded in one module can be opened or sent
to the other through the shared library.

## Features

### Writing Assistant (`/writing`)

- Upload academic documents (PDF or DOCX) with heading/paragraph/table
  structure, citations, and page order preserved on extraction.
- Automatic **document style profile** — the app analyzes your document first
  (academic level, formality, tense, vocabulary, citation style, and more)
  and edits in *your* voice instead of a generic academic style.
- Edit at four scopes: selected passage, paragraph, section, or entire document.
- Side-by-side **Original | Improved** view. Per suggestion: Accept, Regenerate,
  Edit manually, or Keep Original.
- **Meaning-preservation and quality checks** run automatically after each
  revision (meaning, facts, numbers, citations, tone, style); failed checks
  regenerate automatically before you ever see them.
- **Citation protection**: citations are never invented, deleted, or
  re-attached to different claims; reference lists are never rewritten as prose.
- Export the finished document as **DOCX or PDF** (only your accepted edits
  are applied); change view shows Original → Improved per passage.
- Requires an `LLM_API_KEY` for the AI editing features; everything else in
  the app keeps working without it.

### Deep Proofread (inside the Writing Assistant)

- A dedicated final-quality review mode: grammar, academic style, meaning and
  logic, citations, references, and numbers/technical information.
- Findings are **suggestions only — nothing is auto-applied**. Each issue shows
  the page number, original text, explanation, suggested correction, and a
  confidence level.
- Severity levels: Minor, Needs Review, Important.
- Per suggestion: Accept, Reject, Edit, Ignore, or add the term to your
  personal **terminology rules**. A final summary tallies what was accepted,
  rejected, and still needs review.

### Similarity Review Workspace (`/reviews`)

- Multi-step **New Review wizard**: upload the original document (DOCX/PDF),
  upload the similarity report (PDF), then watch real processing stages —
  reading the document, reading the report, detecting matched passages,
  mapping matches to the document, preparing the review copy.
- **Review workspace** (split screen): page navigation on the left, the
  document preview with matched passages highlighted in the center, and a
  **Match Details** panel on the right (match number, page, passage text,
  source info, similarity %, citation-detected status, review status).
- Reviewer verdicts per match: Needs Review, Properly Cited, Direct Quote,
  Common Knowledge, Citation Check, Source Verification. Neutral terminology
  throughout — matches are never auto-labeled as plagiarism.
- **Highlighted export**: download a separate review copy as DOCX (or PDF
  where reliable). The original file is never modified.
- Review history with open, download, and delete actions; document search and
  filters.
- Works fully **without any AI/LLM key**.

### Shared document library (`/documents`)

- Lists every document across both modules. From a review, **"Open in Writing
  Assistant"** carries the original document over; from the writing assistant,
  **"Send to similarity review"** preselects it in the New Review wizard.
  The same file is reused — never uploaded twice.

### Auth, sessions & privacy

- Sign up with email verification, sign in, forgot/reset password,
  **"Keep me signed in"** (remember-me), and **guest mode** ("Continue as
  guest") with temporary, session-scoped data and upgrade prompts.
- Account settings show active sessions with per-session revoke and
  "sign out of all devices".
- Per-user isolation via Supabase Row-Level Security on every table; private
  storage buckets with signed temporary download URLs; server-side file
  validation (magic bytes + size limits, never trusting extensions).
- Configurable data retention: `retention_days` + `auto_delete` toggle in
  Settings, enforced by an optional scheduled cleanup job (`/api/cron/cleanup`).
- Audit log for uploads, deletes, exports, and auth events.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** (strict) + **Tailwind CSS**
- **Supabase**: Postgres + Auth + Storage (no separate backend — Next.js
  Route Handlers only)
- Document processing in TypeScript libraries inside the repo
- Single Vercel deployment

## Repo layout

```
app/
  layout.tsx                App shell: fonts, providers, metadata
  globals.css               Tailwind + design tokens + ss-table styles
  page.tsx                  Landing page
  middleware.ts             (root) Supabase session refresh
  (auth)/                   Sign in / sign up / forgot + reset password pages
  (dashboard)/
    layout.tsx              Sidebar nav, top bar
    page.tsx                Dashboard: stats + recent reviews
    settings/               Account, sessions, privacy, retention settings
    writing/                Writing Assistant + Deep Proofread UI
    reviews/                Similarity Review Workspace UI
  api/
    writing/                Writing Assistant API routes (need LLM_API_KEY)
    reviews/                Similarity review API routes
    cron/cleanup/           Scheduled data-deletion endpoint (CRON_SECRET)
components/
  ui/                       Shared design system: Button, Card, Badge, Input,
                            Modal, toasts, EmptyState, Spinner, Skeleton,
                            FileUploader (used by every module)
  layout/                   Sidebar, top bar, page chrome
  writing/                  Writing Assistant components
  reviews/                  Review workspace components
lib/
  supabase/                 Browser, server, and service-role clients + middleware helper
  writing/                  Document extraction, style profiling, quality checks
  reviews/                  Report parsing, fuzzy match mapping, exports
  format.ts                 formatDate, formatBytes, formatRelativeTime
content/
  site.ts                   Brand name, primary nav, footer links
  landing.ts                All landing-page marketing copy (edit text here,
                            never in components)
supabase/
  migrations/0001_init.sql   All tables, RLS policies, storage buckets
  vercel.json                 Vercel Cron schedule for /api/cron/cleanup
public/
  logo.svg / favicon.svg    Brand assets (replace when renaming)
specs/                      Feature specifications (01–05)
CONTRACTS.md                Cross-module build contracts (env, DB, design, product rules)
README.md / DEPLOY.md / .env.example
```

Import alias `@/*` maps to the repo root.

## Local development

Prerequisites: Node.js 18+ and a free Supabase project (see `DEPLOY.md` steps
1–2 to create one and run the migration).

```bash
npm install

# Copy the example env file and fill in your Supabase values
cp .env.example .env.local

# Apply the database schema: in the Supabase Dashboard open the SQL Editor,
# paste the entire contents of supabase/migrations/0001_init.sql and run it.

npm run dev
```

Open http://localhost:3000. Sign up for an account (email verification link
points at `NEXT_PUBLIC_APP_URL`, so for local testing set it to
`http://localhost:3000`).

### Environment variables

| Variable | Exposed to browser? | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | Supabase project API URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes | Supabase anon public key (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — server only** | Yes | Supabase service_role key (Settings → API); bypasses RLS, never expose |
| `LLM_API_KEY` | **No — server only** | No | OpenAI-compatible API key; enables AI writing/proofread features |
| `LLM_MODEL` | No | No | Model name, e.g. `gpt-4o-mini` |
| `LLM_BASE_URL` | No | No | Custom API base URL (defaults to `https://api.openai.com/v1`) |
| `NEXT_PUBLIC_APP_NAME` | Yes | No | Brand name shown in the UI (default `ScholarSuite`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes | Public app URL, used for email verification links |
| `MAX_UPLOAD_MB` | No | No | Max upload size in MB (default `25`) |
| `CRON_SECRET` | **No — server only** | No | Random secret guarding `/api/cron/cleanup`; needed only with Vercel Cron |

Without `LLM_API_KEY`, the AI routes return a 503 with a clear message and the
UI shows an explanatory empty state; the similarity review workflow is
unaffected.

### Checks

```bash
npm run typecheck   # TypeScript strict check (tsc --noEmit)
npm run lint        # ESLint (next lint)
npm run build       # Production build
```

## Renaming the brand

The placeholder brand is **ScholarSuite**. To make it yours:

1. Set `NEXT_PUBLIC_APP_NAME` to your name in `.env.local` (local) and in the
   Vercel project environment variables (production), then redeploy.
2. Replace `public/logo.svg` and `public/favicon.svg` with your own logo and
   favicon (keep the filenames).
3. Update the landing-page copy in `content/landing.ts` (headlines, sections,
   features, FAQ) and the metadata title/description in `app/layout.tsx`
   to match your brand voice. Navigation labels live in `content/site.ts`.
   All marketing copy is plain data in `content/` — intentionally separated
   from components so it can later be moved into a CMS (e.g. WordPress)
   without touching application logic.

## Deploying

See [`DEPLOY.md`](./DEPLOY.md) for a step-by-step guide written for
non-technical owners: creating the Supabase and Vercel accounts, running the
database migration, adding environment variables, deploying, optional AI key
setup, optional scheduled cleanup, custom domains, and troubleshooting.

## Working with Cursor / Lovable

This repo is structured like a conventional Next.js project so AI coding tools
can work with it directly:

- **Open in Cursor**: open the `scholarsuite` folder; everything is standard
  Next.js 14 App Router + TypeScript + Tailwind — no custom build tooling.
  Start with `CONTRACTS.md` (architecture rules) and `specs/` (feature specs),
  then the module you want to change.
- **Import into Lovable**: push this repo to GitHub and import it; the
  `app/`, `components/`, `lib/`, and `content/` separation maps cleanly to
  continued AI-assisted development.
- **Where things live**: pages in `app/`, reusable UI in `components/ui/`,
  module UI in `components/<module>/`, business logic in `lib/<module>/`,
  API routes in `app/api/`, all marketing copy as plain data in `content/`,
  database schema in `supabase/migrations/`.
- **Conventions**: strict TypeScript, `@/*` import alias for the repo root,
  Supabase clients via `lib/supabase/*`, human-readable error messages only,
  no secrets in client code. Brief comments mark non-obvious code.
- **Note**: the final visual design pass is intentionally on hold — change
  structure, logic, and copy freely, but expect UI styling to be revisited
  once the approved design reference is applied.
