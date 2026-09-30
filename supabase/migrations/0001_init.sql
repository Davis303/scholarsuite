-- ScholarSuite migration 0001: initial schema
-- Supabase Postgres. Creates all tables from CONTRACTS.md with RLS,
-- storage buckets, updated_at triggers, audit logging, and new-user setup.
-- No demo data is seeded (see ../seed.sql).

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- One profile row per auth user (id = auth.users.id).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared document library: originals, similarity reports, writing uploads.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text check (kind in ('original', 'similarity_report', 'writing')),
  name text not null,
  mime_type text,
  size_bytes integer,
  storage_path text not null,
  status text not null default 'uploaded',
  page_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A similarity review of one document against an optional report.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id),
  report_id uuid references public.documents(id),
  title text,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'review_required', 'completed', 'failed')),
  total_matches integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual extracted matches within a review.
create table public.matched_passages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  match_index integer,
  page_number integer,
  passage_text text,
  paragraph_text text,
  source_label text,
  source_detail text,
  similarity_pct numeric,
  citation_detected boolean not null default false,
  status text not null default 'needs_review'
    check (status in ('needs_review', 'properly_cited', 'direct_quote',
                      'common_knowledge', 'citation_check', 'source_verification')),
  reviewer_note text,
  created_at timestamptz not null default now()
);

-- Generated highlight-export files for a review.
create table public.review_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.reviews(id),
  kind text not null check (kind in ('docx', 'pdf')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- Documents owned by the Writing Assistant module.
create table public.writing_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  mime_type text,
  size_bytes integer,
  storage_path text,
  status text not null default 'uploaded',
  style_profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Revision suggestions produced by the Writing Assistant.
create table public.writing_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  writing_doc_id uuid not null references public.writing_docs(id) on delete cascade,
  scope text,
  section_ref text,
  original_text text,
  revised_text text,
  status text not null default 'suggested'
    check (status in ('suggested', 'accepted', 'rejected', 'edited')),
  created_at timestamptz not null default now()
);

-- Deep Proofread runs over a writing document.
create table public.proofread_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  writing_doc_id uuid not null references public.writing_docs(id),
  scope text,
  status text not null default 'complete',
  summary jsonb,
  created_at timestamptz not null default now()
);

-- Individual issues found by a proofread run.
create table public.proofread_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.proofread_runs(id) on delete cascade,
  writing_doc_id uuid not null references public.writing_docs(id),
  category text,
  severity text check (severity in ('minor', 'needs_review', 'important')),
  page_number integer,
  original_text text,
  explanation text,
  suggestion text,
  confidence text,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'rejected', 'ignored')),
  created_at timestamptz not null default now()
);

-- User-defined terminology preferences (one rule per term per user).
create table public.terminology_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, term)
);

-- Append-only audit trail of document/review/passage activity.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text,
  entity_type text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Per-user settings (one row per auth user, created on sign-up).
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  retention_days integer not null default 90,
  auto_delete boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Every user_id column.
create index if not exists idx_documents_user_id on public.documents (user_id);
create index if not exists idx_reviews_user_id on public.reviews (user_id);
create index if not exists idx_matched_passages_user_id on public.matched_passages (user_id);
create index if not exists idx_review_exports_user_id on public.review_exports (user_id);
create index if not exists idx_writing_docs_user_id on public.writing_docs (user_id);
create index if not exists idx_writing_revisions_user_id on public.writing_revisions (user_id);
create index if not exists idx_proofread_runs_user_id on public.proofread_runs (user_id);
create index if not exists idx_proofread_issues_user_id on public.proofread_issues (user_id);
create index if not exists idx_terminology_rules_user_id on public.terminology_rules (user_id);
-- (profiles.id and user_settings.user_id are primary keys, already indexed.)

-- Join / lookup indexes.
create index if not exists idx_matched_passages_review_id on public.matched_passages (review_id);
create index if not exists idx_proofread_issues_run_doc on public.proofread_issues (run_id, writing_doc_id);
create index if not exists idx_writing_revisions_doc_id on public.writing_revisions (writing_doc_id);
create index if not exists idx_reviews_document_id on public.reviews (document_id);
create index if not exists idx_audit_logs_user_created on public.audit_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.reviews enable row level security;
alter table public.matched_passages enable row level security;
alter table public.review_exports enable row level security;
alter table public.writing_docs enable row level security;
alter table public.writing_revisions enable row level security;
alter table public.proofread_runs enable row level security;
alter table public.proofread_issues enable row level security;
alter table public.terminology_rules enable row level security;
alter table public.audit_logs enable row level security;
alter table public.user_settings enable row level security;

-- ---------------------------------------------------------------------------
-- 5. RLS policies
-- ---------------------------------------------------------------------------

-- profiles: the row id is the auth user id.
drop policy if exists "owner_all" on public.profiles;
create policy "owner_all" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Every other table: owner-only access via user_id.
drop policy if exists "owner_all" on public.documents;
create policy "owner_all" on public.documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.reviews;
create policy "owner_all" on public.reviews
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.matched_passages;
create policy "owner_all" on public.matched_passages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.review_exports;
create policy "owner_all" on public.review_exports
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.writing_docs;
create policy "owner_all" on public.writing_docs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.writing_revisions;
create policy "owner_all" on public.writing_revisions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.proofread_runs;
create policy "owner_all" on public.proofread_runs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.proofread_issues;
create policy "owner_all" on public.proofread_issues
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.terminology_rules;
create policy "owner_all" on public.terminology_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.audit_logs;
create policy "owner_all" on public.audit_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.user_settings;
create policy "owner_all" on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage: users may manage objects inside their own <user_id>/ folder
-- in each private bucket.
drop policy if exists "owner_all_documents" on storage.objects;
create policy "owner_all_documents" on storage.objects
  for all
  using (bucket_id = 'documents'
         and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'documents'
              and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "owner_all_reports" on storage.objects;
create policy "owner_all_reports" on storage.objects
  for all
  using (bucket_id = 'reports'
         and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'reports'
              and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "owner_all_exports" on storage.objects;
create policy "owner_all_exports" on storage.objects
  for all
  using (bucket_id = 'exports'
         and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'exports'
              and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- 6. Storage buckets (all private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('reports', 'reports', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.documents;
create trigger set_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.reviews;
create trigger set_updated_at
  before update on public.reviews
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.writing_docs;
create trigger set_updated_at
  before update on public.writing_docs
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.user_settings;
create trigger set_updated_at
  before update on public.user_settings
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Audit helper: log inserts/deletes on key tables to audit_logs
-- ---------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id)
    values (old.user_id, tg_op, tg_table_name, old.id);
    return old;
  end if;
  insert into public.audit_logs (user_id, action, entity_type, entity_id)
  values (new.user_id, tg_op, tg_table_name, new.id);
  return new;
end;
$$;

drop trigger if exists audit_documents on public.documents;
create trigger audit_documents
  after insert or delete on public.documents
  for each row execute function public.log_audit();

drop trigger if exists audit_reviews on public.reviews;
create trigger audit_reviews
  after insert or delete on public.reviews
  for each row execute function public.log_audit();

drop trigger if exists audit_writing_docs on public.writing_docs;
create trigger audit_writing_docs
  after insert or delete on public.writing_docs
  for each row execute function public.log_audit();

drop trigger if exists audit_matched_passages on public.matched_passages;
create trigger audit_matched_passages
  after insert or delete on public.matched_passages
  for each row execute function public.log_audit();

-- ---------------------------------------------------------------------------
-- 9. New auth user -> profiles row + user_settings row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
