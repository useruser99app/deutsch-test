-- NORAV V0.1 — Migration 0003: Change-set architecture (§6/§6A) + documents (§7)
--
-- Candidates never modify canonical data directly. Every candidate-originated
-- change lives here until an admin approves it. History is never destroyed:
-- change items and superseded documents are kept forever (§30).

-- ---------------------------------------------------------------------------
-- candidate_change_sets: one candidate submission
-- ---------------------------------------------------------------------------

create table public.candidate_change_sets (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null
    references public.candidates (id) on delete cascade,
  source public.change_source not null default 'candidate',
  status public.review_status not null default 'pending',
  submitted_by uuid references public.app_users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.app_users (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_change_sets_candidate on public.candidate_change_sets (candidate_id);
create index idx_change_sets_status on public.candidate_change_sets (status);

create trigger trg_change_sets_updated_at
  before update on public.candidate_change_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- candidate_change_items: individual field changes, JSONB value model (§6A).
-- current_value is the canonical value snapshotted at submission time by
-- submit_candidate_changes() — the client cannot forge it.
-- Items can be approved/rejected individually.
-- ---------------------------------------------------------------------------

create table public.candidate_change_items (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null
    references public.candidate_change_sets (id) on delete cascade,
  candidate_id uuid not null
    references public.candidates (id) on delete cascade,
  field_key text not null,
  field_type public.field_type not null,
  current_value jsonb,
  proposed_value jsonb not null,
  source_language public.locale_code,
  status public.review_status not null default 'pending',
  reviewed_by uuid references public.app_users (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_change_items_set on public.candidate_change_items (change_set_id);
create index idx_change_items_candidate on public.candidate_change_items (candidate_id);
create index idx_change_items_status on public.candidate_change_items (status);

create trigger trg_change_items_updated_at
  before update on public.candidate_change_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- candidate_documents (§7). Files live in the PRIVATE Storage bucket
-- 'candidate-documents' under <candidate_id>/<uuid>-<filename>; access is
-- only ever via short-lived signed URLs generated server-side.
-- ---------------------------------------------------------------------------

create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null
    references public.candidates (id) on delete cascade,
  document_type public.document_type not null,
  file_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  document_language public.locale_code,
  verification_status public.document_status not null default 'pending_review',
  -- Replacement chain: the approved predecessor stays 'approved' until this
  -- document is approved, then becomes 'superseded' (§7).
  replaces_document_id uuid references public.candidate_documents (id),
  uploaded_by uuid references public.app_users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.app_users (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_candidate on public.candidate_documents (candidate_id);
create index idx_documents_status on public.candidate_documents (verification_status);
create index idx_documents_type on public.candidate_documents (document_type);

create trigger trg_documents_updated_at
  before update on public.candidate_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private storage bucket for candidate documents.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('candidate-documents', 'candidate-documents', false)
on conflict (id) do nothing;
