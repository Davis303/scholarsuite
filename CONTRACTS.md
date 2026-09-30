# ScholarSuite — Build Contracts

All module builders MUST follow this file. Product: **ScholarSuite** (placeholder brand,
easily renameable via `NEXT_PUBLIC_APP_NAME`). Zero Muse/Meta branding anywhere: no
"Built with Muse", no Muse names/logos, in UI, footers, auth pages, exports, emails,
code comments, package.json, or docs.

## Stack

- Next.js 14 App Router + TypeScript (strict) + Tailwind CSS. Single Vercel deployment.
- Supabase: Postgres + Auth + Storage. No separate backend; Next.js Route Handlers only.
- Document processing in TypeScript libs inside the repo.

## Directory ownership (do not write outside your area)

- shell: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/(auth)/**`,
  `app/(dashboard)/layout.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/settings/**`,
  `components/ui/**`, `components/layout/**`, `lib/supabase/**`, `lib/format.ts`,
  `middleware.ts`, `public/**`
- reviews: `app/(dashboard)/reviews/**`, `app/api/reviews/**`, `components/reviews/**`, `lib/reviews/**`
- writing: `app/(dashboard)/writing/**`, `app/api/writing/**`, `components/writing/**`, `lib/writing/**`
- database: `supabase/**` only
- docs: `README.md`, `DEPLOY.md`, `.env.example` only
- Coordinator owns: `package.json`, `tsconfig.json`, `next.config.mjs`,
  `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `CONTRACTS.md`, `specs/**`

Shared import alias: `@/*` maps to repo root.

## Supabase client conventions (`lib/supabase/`)

- `lib/supabase/client.ts`: browser client via `@supabase/ssr` `createBrowserClient`.
- `lib/supabase/server.ts`: `createServerClient` reading cookies (for Route Handlers /
  Server Components); `createServiceClient` using `SUPABASE_SERVICE_ROLE_KEY` (server only,
  never imported into client components).
- `lib/supabase/middleware.ts`: session refresh helper used by root `middleware.ts`.
- Every server route: `const supabase = createServerClient(); const { data: { user } } =
  await supabase.auth.getUser(); if (!user) return 401`. Never trust client-supplied user ids.

## Database tables (database builder creates these; others reference by name)

All tables have `user_id uuid not null references auth.users(id) on delete cascade`
(unless noted) and RLS enabled with `auth.uid() = user_id` policies for all operations.

- `profiles`: `id uuid PK` (= auth.users.id, no separate user_id), `email text`,
  `full_name text`, `created_at timestamptz default now()`, `updated_at timestamptz`
- `documents`: `id uuid PK default gen_random_uuid()`, `user_id`, `kind text` check
  `kind in ('original','similarity_report','writing')`, `name text not null`,
  `mime_type text`, `size_bytes int`, `storage_path text not null`, `status text default 'uploaded'`,
  `page_count int`, `created_at`, `updated_at`
- `reviews`: `id uuid PK`, `user_id`, `document_id uuid fk documents`, `report_id uuid fk documents nullable`,
  `title text`, `status text default 'processing'`
  check `status in ('processing','ready','review_required','completed','failed')`,
  `total_matches int default 0`, `created_at`, `updated_at`
- `matched_passages`: `id uuid PK`, `user_id`, `review_id uuid fk reviews on delete cascade`,
  `match_index int`, `page_number int`, `passage_text text`, `paragraph_text text`,
  `source_label text`, `source_detail text`, `similarity_pct numeric nullable`,
  `citation_detected boolean default false`, `status text default 'needs_review'`
  check `status in ('needs_review','properly_cited','direct_quote','common_knowledge','citation_check','source_verification')`,
  `reviewer_note text`, `created_at`
- `review_exports`: `id uuid PK`, `user_id`, `review_id uuid fk reviews`,
  `kind text check (kind in ('docx','pdf'))`, `storage_path text`, `created_at`
- `writing_docs`: `id uuid PK`, `user_id`, `name text`, `mime_type text`, `size_bytes int`,
  `storage_path text`, `status text default 'uploaded'`, `style_profile jsonb`,
  `created_at`, `updated_at`
- `writing_revisions`: `id uuid PK`, `user_id`, `writing_doc_id uuid fk writing_docs on delete cascade`,
  `scope text`, `section_ref text`, `original_text text`, `revised_text text`,
  `status text default 'suggested'` check `status in ('suggested','accepted','rejected','edited')`, `created_at`
- `proofread_runs`: `id uuid PK`, `user_id`, `writing_doc_id uuid fk writing_docs`,
  `scope text`, `status text default 'complete'`, `summary jsonb`, `created_at`
- `proofread_issues`: `id uuid PK`, `user_id`, `run_id uuid fk proofread_runs on delete cascade`,
  `writing_doc_id uuid fk writing_docs`, `category text`, `severity text`
  check `severity in ('minor','needs_review','important')`, `page_number int`,
  `original_text text`, `explanation text`, `suggestion text`, `confidence text`,
  `status text default 'open'` check `status in ('open','accepted','rejected','ignored')`, `created_at`
- `terminology_rules`: `id uuid PK`, `user_id`, `term text`, `note text`,
  `created_at`, unique(`user_id`,`term`)
- `audit_logs`: `id uuid PK`, `user_id`, `action text`, `entity_type text`,
  `entity_id uuid nullable`, `meta jsonb`, `created_at`
- `user_settings`: `user_id uuid PK references auth.users(id) on delete cascade`,
  `retention_days int default 90`, `auto_delete boolean default false`, `updated_at`

Storage buckets (all private): `documents`, `reports`, `exports`. Object paths MUST be
`<user_id>/<uuid>-<sanitized-filename>`. Use signed URLs (short expiry) for downloads.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # server only
LLM_API_KEY=                          # server only, optional; OpenAI-compatible API
LLM_MODEL=                            # optional, e.g. gpt-4o-mini
LLM_BASE_URL=                         # optional, defaults to https://api.openai.com/v1
NEXT_PUBLIC_APP_NAME=ScholarSuite
NEXT_PUBLIC_APP_URL=                  # e.g. https://scholarsuite.vercel.app (email redirects)
MAX_UPLOAD_MB=25
CRON_SECRET=                        # server only; guards /api/cron/cleanup (Vercel Cron)
```

## Design tokens (Tailwind theme extension)

- Font: Inter via `next/font/google`.
- Brand primary (trustworthy academic blue): `#1D4ED8` (brand-600), hover `#1E40AF`
  (brand-700), soft bg `brand-50 #EFF4FF`. Neutrals: slate scale.
- One strong brand color only; otherwise neutral. No gradients, no childish illustration.
- Radius: `rounded-lg` default; cards `border border-slate-200 shadow-sm bg-white`.
- Match highlight: `bg-yellow-200/70`; selected match: `bg-amber-300 ring-2 ring-amber-500`.
- Focus: always visible (`focus-visible:ring-2 focus-visible:ring-brand-600`).
- Severity: minor = slate badge, needs_review = amber badge, important = red badge —
  never color alone; always include text label + icon.
- Toasts, modals, empty states, skeletons: build once in `components/ui`, reuse everywhere.

## Product shape (see specs/05-product-shape.md)

One product, one URL, one auth. Two modules: `/writing` (Writing Assistant +
Deep Proofread) and `/reviews` (Similarity Review Workspace). Shared document
library at `/documents`. Bridge contracts:

- `POST /api/writing/from-document` `{ documentId }` → `{ writingDocId }`
  (writing builder implements; creates `writing_docs` reusing the same storage path).
- `/reviews/new?documentId={id}` preselects a shared-library document in the wizard
  (reviews builder implements).
- "Send to similarity review" from writing: writing builder ensures a `documents`
  row (`kind='original'`) exists reusing the storage path, then links to
  `/reviews/new?documentId=`.
- Sidebar: Dashboard · Writing Assistant · New Review · My Reviews · Documents · Settings.

## Shared UI component API (shell builder implements; others code against this)

- `Button`: `{ variant: 'primary'|'secondary'|'tertiary'|'destructive', size?: 'sm'|'md'|'lg', loading?: boolean }` + native button props.
- `Card`: `{ className?, children }` → `<section class="rounded-lg border border-slate-200 bg-white shadow-card ...">`.
- `Badge`: `{ tone: 'neutral'|'brand'|'amber'|'red'|'green', children }`.
- `Input`, `Textarea`, `Select`: `{ label?, error?, hint? }` + native props, accessible labels.
- `Modal`: `{ open: boolean, onClose: () => void, title: string, children, actions?: ReactNode }`.
- `useToast()`: `{ toast(message: string, tone?: 'success'|'error'|'info') }`; shell provides `<ToastProvider>`.
- `EmptyState`: `{ title: string, description?: string, action?: ReactNode }`.
- `Spinner`, `Skeleton`: no props (Skeletons: `{ className? }`).
- `FileUploader`: `{ accept: string, maxMB: number, multiple?: boolean, onFiles: (files: File[]) => void, label?: string }` — drag-drop, type/size validation, progress display handled by caller.
- Tables: use native `<table>` with class `ss-table` (shell defines styles in globals.css).
- `lib/format.ts`: `formatDate`, `formatBytes`, `formatRelativeTime`.

If a component you need is missing, build a local minimal version inside your own
`components/<module>/` directory — never write to `components/ui/`.

## Product rules (non-negotiable)

1. NEVER auto-paraphrase or auto-rewrite similarity-matched passages. No similarity-score
   manipulation, no AI-detector bypassing, no fake scores, no fake processing.
2. The Writing Assistant edits only the user's own general text. It must NEVER accept a
   similarity report as input, never reference detectors/scores, never optimize for them.
   No upload path in the writing module may mention similarity/Turnitin/AI detection.
3. AI routes (`/api/writing/*`) require `LLM_API_KEY`; without it they return 503 with a
   clear message and the UI shows an informative empty state. The review/highlighting
   workflow must work fully with no LLM key.
4. Server-side file validation: check magic bytes + size, never trust extensions.
5. Never expose raw backend errors to the client; human-readable messages only.
6. `SUPABASE_SERVICE_ROLE_KEY` and `LLM_API_KEY` never leave the server.
7. Neutral terminology in review UI: "Matched Text" / "Similarity Match" / "Source Match".
   Never auto-label matches as plagiarism.

## Code quality

- TypeScript strict, no `any` without justification, no unused imports/vars.
- No TODO/FIXME/placeholder stubs: every exported function and route must work.
- Client components: `'use client'` only where interactivity requires it; prefer Server Components.
- All user-facing strings in plain professional English; no lorem ipsum.
