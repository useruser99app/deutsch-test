-- =====================================================================
-- NORAV V0.1 — Komplettes Datenbank-Setup (Einmal-Ausführung)
-- =====================================================================
--
-- Diese Datei fasst alle Migrationen (0001-0008) und die Seed-Daten
-- zusammen, damit das Setup im Supabase SQL Editor mit EINEM Durchlauf
-- erledigt ist.
--
-- ANLEITUNG:
--   1. Supabase Dashboard oeffnen -> linkes Menue -> "SQL Editor"
--   2. "New query" klicken
--   3. Den GESAMTEN Inhalt dieser Datei einfuegen
--   4. "Run" klicken (dauert einige Sekunden)
--   5. Erwartete Meldung: "Success. No rows returned"
--
-- Diese Datei ist nur fuer die ERSTE Einrichtung eines leeren Projekts.
-- Fuer spaetere Aenderungen gelten die einzelnen Dateien in
-- supabase/migrations/ als verbindliche Quelle.
-- =====================================================================



-- =====================================================================
-- TEIL: 20260818000001_foundation.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0001: Foundation
-- Extensions, enums, app_users, auth trigger, shared helper functions.
--
-- All canonical values are language-neutral keys (NORAV principle §23).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'candidate', 'employer');

create type public.account_status as enum
  ('invited', 'active', 'suspended', 'pending_verification');

create type public.candidate_type as enum
  ('apprenticeship_candidate', 'skilled_worker');

create type public.candidate_status as enum
  ('draft', 'active', 'inactive', 'archived');

create type public.german_level as enum
  ('none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native');

-- Shared review status for change sets, change items and skills sources.
create type public.review_status as enum ('pending', 'approved', 'rejected');

create type public.document_type as enum
  ('cv', 'school_certificate', 'diploma', 'work_certificate',
   'internship_certificate', 'language_certificate', 'passport', 'other');

create type public.document_status as enum
  ('pending_review', 'approved', 'rejected', 'superseded');

create type public.profile_status as enum ('draft', 'published', 'unpublished');

create type public.job_type as enum ('apprenticeship', 'skilled_position');

create type public.job_status as enum ('draft', 'open', 'closed', 'archived');

create type public.employment_type as enum
  ('full_time', 'part_time', 'apprenticeship', 'other');

create type public.interest_request_status as enum
  ('new', 'reviewing', 'approved', 'rejected', 'introduced');

-- Origin of a proposed change / data point. 'ai_extraction' is reserved for
-- the future AI pipeline (§8) which must reuse the same approval workflow.
create type public.change_source as enum ('candidate', 'admin', 'ai_extraction');

create type public.field_type as enum
  ('string', 'number', 'date', 'boolean', 'array', 'json');

create type public.locale_code as enum ('de', 'en', 'fr', 'ar');

create type public.translation_source as enum ('human', 'ai', 'candidate');

create type public.translation_status as enum
  ('draft', 'pending_review', 'approved');

create type public.proficiency_level as enum
  ('basic', 'intermediate', 'advanced', 'expert');

create type public.member_role as enum ('owner', 'member');

create type public.subscription_status as enum
  ('active', 'canceled', 'expired', 'paused');

create type public.payment_status as enum
  ('pending', 'succeeded', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- app_users: application role + account status per auth user.
-- Written only by the auth trigger, admins and SECURITY DEFINER functions —
-- never directly by the user themselves.
-- ---------------------------------------------------------------------------

create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.user_role not null,
  account_status public.account_status not null default 'invited',
  preferred_locale public.locale_code not null default 'de',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

-- Mirror new auth users into app_users. Role/status/locale are taken from
-- metadata set at account creation time (admin-provisioned accounts, §3A).
-- The trigger only runs on INSERT, so later user_metadata edits by the user
-- can never change the authoritative role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.app_users (id, email, role, account_status, preferred_locale)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'norav_role', ''),
      nullif(new.raw_user_meta_data ->> 'norav_role', ''),
      'candidate'
    )::public.user_role,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'norav_account_status', ''),
      nullif(new.raw_user_meta_data ->> 'norav_account_status', ''),
      'invited'
    )::public.account_status,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'norav_locale', ''),
      nullif(new.raw_user_meta_data ->> 'norav_locale', ''),
      'de'
    )::public.locale_code
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions.
-- SECURITY DEFINER with a pinned search_path; they read app_users directly
-- (avoiding policy recursion) and ALWAYS require account_status = 'active',
-- which enforces §3A (suspended/invited accounts get no protected data).
-- ---------------------------------------------------------------------------

create or replace function public.active_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.app_users
  where id = auth.uid() and account_status = 'active';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.active_role() = 'admin', false);
$$;

create or replace function public.is_employer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.active_role() = 'employer', false);
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.active_role() is not null;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
grant execute on function public.active_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_employer() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Account lifecycle RPCs
-- ---------------------------------------------------------------------------

-- Invited user finished setting their password: invited -> active (§3A).
create or replace function public.complete_invite()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.app_users
  set account_status = 'active'
  where id = auth.uid() and account_status = 'invited';
end;
$$;

-- Users may change their own UI locale preference (nothing else).
create or replace function public.set_preferred_locale(p_locale public.locale_code)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.app_users
  set preferred_locale = p_locale
  where id = auth.uid();
end;
$$;

revoke all on function public.complete_invite() from public;
revoke all on function public.set_preferred_locale(public.locale_code) from public;
grant execute on function public.complete_invite() to authenticated;
grant execute on function public.set_preferred_locale(public.locale_code) to authenticated;


-- =====================================================================
-- TEIL: 20260818000002_candidates.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0002: Canonical candidate model
-- candidates, apprenticeship_details, skilled_worker_details,
-- candidate_target_occupations, skills, candidate_skills.
--
-- Canonical single-source fields (german_level, availability_date,
-- relocation_ready, drivers_license) live ONLY on candidates to avoid a
-- second source of truth. Free-text fields keep their source language (§24).

-- ---------------------------------------------------------------------------
-- candidates (canonical, §9)
-- ---------------------------------------------------------------------------

create sequence public.candidate_code_seq;

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.app_users (id) on delete set null,
  candidate_code text not null unique
    default ('NOR-' || lpad(nextval('public.candidate_code_seq')::text, 5, '0')),
  candidate_type public.candidate_type not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  date_of_birth date,
  nationality text,
  country_of_residence text,
  german_level public.german_level not null default 'none',
  availability_date date,
  drivers_license boolean,
  relocation_ready boolean,
  status public.candidate_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.candidate_code_seq owned by public.candidates.candidate_code;

create index idx_candidates_user_id on public.candidates (user_id);
create index idx_candidates_status on public.candidates (status);
create index idx_candidates_type on public.candidates (candidate_type);

create trigger trg_candidates_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- Maps the current auth user to their candidate row (active accounts only).
create or replace function public.own_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.candidates c
  join public.app_users u on u.id = c.user_id
  where u.id = auth.uid()
    and u.role = 'candidate'
    and u.account_status = 'active';
$$;

grant execute on function public.own_candidate_id() to authenticated;

-- ---------------------------------------------------------------------------
-- apprenticeship_details (primary V0.1 use case, §10)
-- ---------------------------------------------------------------------------

create table public.apprenticeship_details (
  candidate_id uuid primary key
    references public.candidates (id) on delete cascade,
  desired_training_start date,
  school_qualification text,
  school_specialization text,
  graduation_year int
    check (graduation_year is null or graduation_year between 1950 and 2100),
  german_certificate_type text,
  german_certificate_status text
    check (german_certificate_status is null or german_certificate_status in
      ('none', 'planned', 'registered', 'obtained')),
  internship_experience text,
  internship_experience_language public.locale_code,
  relevant_experience text,
  relevant_experience_language public.locale_code,
  preferred_locations text[] not null default '{}',
  motivation_summary text,
  motivation_summary_language public.locale_code,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_apprenticeship_details_updated_at
  before update on public.apprenticeship_details
  for each row execute function public.set_updated_at();

-- Desired Ausbildung occupations: multiple per candidate, rank 1 = primary.
create table public.candidate_target_occupations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null
    references public.candidates (id) on delete cascade,
  occupation text not null,
  rank int not null default 1 check (rank >= 1),
  created_at timestamptz not null default now(),
  unique (candidate_id, rank),
  unique (candidate_id, occupation)
);

create index idx_target_occupations_candidate
  on public.candidate_target_occupations (candidate_id);

-- ---------------------------------------------------------------------------
-- skilled_worker_details (§11)
-- ---------------------------------------------------------------------------

create table public.skilled_worker_details (
  candidate_id uuid primary key
    references public.candidates (id) on delete cascade,
  profession text,
  years_experience numeric(4, 1)
    check (years_experience is null or years_experience >= 0),
  highest_qualification text,
  specialization text,
  preferred_positions text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_skilled_worker_details_updated_at
  before update on public.skilled_worker_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Structured skills (§12)
-- ---------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  skill_key text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null
    references public.candidates (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete restrict,
  proficiency public.proficiency_level,
  years_experience numeric(4, 1)
    check (years_experience is null or years_experience >= 0),
  source public.change_source not null default 'admin',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, skill_id)
);

create index idx_candidate_skills_candidate
  on public.candidate_skills (candidate_id);

create trigger trg_candidate_skills_updated_at
  before update on public.candidate_skills
  for each row execute function public.set_updated_at();


-- =====================================================================
-- TEIL: 20260818000003_changes_documents.sql
-- =====================================================================

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


-- =====================================================================
-- TEIL: 20260818000004_publication_companies.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0004: Publication layer, companies, jobs,
-- interest requests.
--
-- candidate_profiles is the ONLY candidate data employers can ever see
-- (§13): it is architecturally separated from private identity and contains
-- no name, email, phone, exact date of birth or document paths.

-- ---------------------------------------------------------------------------
-- candidate_profiles (anonymized, employer-facing, §13)
-- ---------------------------------------------------------------------------

create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique
    references public.candidates (id) on delete cascade,
  candidate_type public.candidate_type not null,
  country text,
  german_level public.german_level,
  availability_date date,
  profile_status public.profile_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_status on public.candidate_profiles (profile_status);

create trigger trg_candidate_profiles_updated_at
  before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- candidate_profile_localizations (§25). de is the mandatory primary
-- employer-facing locale in V0.1. AI translation is NOT implemented; the
-- translation_source/status fields prepare the future workflow (§26).
-- ---------------------------------------------------------------------------

create table public.candidate_profile_localizations (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  locale public.locale_code not null,
  public_title text,
  public_summary text,
  education_summary text,
  experience_summary text,
  motivation_summary text,
  translation_source public.translation_source not null default 'human',
  translation_status public.translation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_profile_id, locale)
);

create trigger trg_profile_localizations_updated_at
  before update on public.candidate_profile_localizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- companies (§14) + company_members (n users per company)
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  country text not null default 'DE',
  city text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  member_role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index idx_company_members_user on public.company_members (user_id);

-- Companies the current (active) employer belongs to.
create or replace function public.own_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cm.company_id
  from public.company_members cm
  join public.app_users u on u.id = cm.user_id
  where cm.user_id = auth.uid()
    and u.role = 'employer'
    and u.account_status = 'active';
$$;

grant execute on function public.own_company_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- jobs (§15). Germany is the initial market but country is NOT hard-coded.
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_type public.job_type not null,
  title text not null,
  description text,
  profession_or_training_occupation text,
  location text,
  country text not null default 'DE',
  required_german_level public.german_level,
  minimum_experience_years numeric(4, 1)
    check (minimum_experience_years is null or minimum_experience_years >= 0),
  training_start_date date,
  employment_type public.employment_type,
  status public.job_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_jobs_company on public.jobs (company_id);
create index idx_jobs_status on public.jobs (status);

create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- interest_requests (§16). References the anonymized profile — NEVER the
-- private candidate row — so a request can never leak identity by itself.
-- ---------------------------------------------------------------------------

create table public.interest_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  candidate_profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  requested_by uuid references public.app_users (id) on delete set null,
  message text,
  status public.interest_request_status not null default 'new',
  reviewed_by uuid references public.app_users (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_interest_requests_company on public.interest_requests (company_id);
create index idx_interest_requests_profile on public.interest_requests (candidate_profile_id);
create index idx_interest_requests_status on public.interest_requests (status);

create trigger trg_interest_requests_updated_at
  before update on public.interest_requests
  for each row execute function public.set_updated_at();


-- =====================================================================
-- TEIL: 20260818000005_subscriptions.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0005: Subscription-ready data models (§17).
--
-- Data models only: NO payment provider, NO checkout, NO pricing is
-- implemented or invented in this milestone. Feature access is designed to
-- be entitlement-based instead of scattered `if user.isPaid` checks.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,          -- e.g. 'free', 'paid'
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  entitlement_key text not null,
  limit_value int,                        -- null = unlimited / boolean grant
  created_at timestamptz not null default now(),
  unique (plan_id, entitlement_key)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user on public.subscriptions (user_id);

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  user_id uuid not null references public.app_users (id) on delete cascade,
  amount_cents int check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'EUR',
  status public.payment_status not null default 'pending',
  provider text,                          -- future, e.g. 'stripe'
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_user on public.payments (user_id);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- Resolved per-user feature grants. Application code checks entitlements —
-- never plan flags — for feature access (§17).
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  entitlement_key text not null,
  limit_value int,
  source_subscription_id uuid references public.subscriptions (id) on delete set null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entitlement_key)
);

create index idx_entitlements_user on public.entitlements (user_id);

create trigger trg_entitlements_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();


-- =====================================================================
-- TEIL: 20260818000006_workflows.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0006: Approval workflow functions (§5/§6/§6A/§7).
--
-- The verified-data principle is enforced HERE, in the database:
--  * submit_candidate_changes(): the only write path for candidate-originated
--    changes. Snapshots the canonical current_value server-side.
--  * approve_change_item()/reject_change_item(): admin-only; approval applies
--    the value to the canonical tables atomically.
--  * review_document(): admin-only; handles the supersede chain.
--
-- All functions are SECURITY DEFINER with a pinned search_path. Internal
-- helpers are not executable by clients.

-- ---------------------------------------------------------------------------
-- Field registry: which field_keys are changeable, their type and domain.
-- Must stay in sync with `changeableFields` in src/lib/domain.ts.
-- ---------------------------------------------------------------------------

create or replace function public.candidate_field_domain(p_field_key text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_field_key in
      ('first_name', 'last_name', 'phone', 'date_of_birth', 'nationality',
       'country_of_residence', 'german_level', 'availability_date',
       'drivers_license', 'relocation_ready')
      then 'core'
    when p_field_key = 'target_occupations'
      then 'occupations'
    when p_field_key in
      ('desired_training_start', 'school_qualification', 'school_specialization',
       'graduation_year', 'german_certificate_type', 'german_certificate_status',
       'internship_experience', 'relevant_experience', 'motivation_summary')
      then 'apprenticeship'
    when p_field_key in
      ('profession', 'years_experience', 'highest_qualification',
       'specialization', 'preferred_positions')
      then 'skilled'
    when p_field_key = 'preferred_locations'
      then 'by_candidate_type'
    else null
  end;
$$;

create or replace function public.candidate_field_type(p_field_key text)
returns public.field_type
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_field_key in ('date_of_birth', 'availability_date',
                         'desired_training_start')
      then 'date'::public.field_type
    when p_field_key in ('drivers_license', 'relocation_ready')
      then 'boolean'::public.field_type
    when p_field_key in ('graduation_year', 'years_experience')
      then 'number'::public.field_type
    when p_field_key in ('target_occupations', 'preferred_locations',
                         'preferred_positions')
      then 'array'::public.field_type
    else 'string'::public.field_type
  end;
$$;

-- Validates the field key against the registry and the candidate's type.
create or replace function public.assert_field_for_candidate(
  p_candidate_id uuid,
  p_field_key text
)
returns text  -- resolved domain: core | occupations | apprenticeship | skilled
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text := public.candidate_field_domain(p_field_key);
  v_type public.candidate_type;
begin
  if v_domain is null then
    raise exception 'Unknown field_key: %', p_field_key;
  end if;

  select candidate_type into v_type
  from public.candidates where id = p_candidate_id;
  if not found then
    raise exception 'Unknown candidate: %', p_candidate_id;
  end if;

  if v_domain = 'by_candidate_type' then
    v_domain := case when v_type = 'apprenticeship_candidate'
                     then 'apprenticeship' else 'skilled' end;
  end if;

  if v_domain = 'apprenticeship' and p_field_key <> 'preferred_locations'
     and v_type <> 'apprenticeship_candidate' then
    raise exception 'Field % not valid for candidate_type %', p_field_key, v_type;
  end if;
  if v_domain = 'skilled' and p_field_key <> 'preferred_locations'
     and v_type <> 'skilled_worker' then
    raise exception 'Field % not valid for candidate_type %', p_field_key, v_type;
  end if;
  if v_domain = 'occupations' and v_type <> 'apprenticeship_candidate' then
    raise exception 'Field % not valid for candidate_type %', p_field_key, v_type;
  end if;

  return v_domain;
end;
$$;

-- ---------------------------------------------------------------------------
-- Canonical current value of a field, as JSONB (snapshot source, §6A).
-- ---------------------------------------------------------------------------

create or replace function public.candidate_field_current_value(
  p_candidate_id uuid,
  p_field_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text := public.assert_field_for_candidate(p_candidate_id, p_field_key);
  v jsonb;
begin
  if v_domain = 'core' then
    execute format(
      'select to_jsonb(%I) from public.candidates where id = $1', p_field_key)
      into v using p_candidate_id;
  elsif v_domain = 'occupations' then
    select coalesce(jsonb_agg(occupation order by rank), 'null'::jsonb) into v
    from public.candidate_target_occupations
    where candidate_id = p_candidate_id;
  elsif v_domain = 'apprenticeship' then
    execute format(
      'select to_jsonb(%I) from public.apprenticeship_details where candidate_id = $1',
      p_field_key)
      into v using p_candidate_id;
  else
    execute format(
      'select to_jsonb(%I) from public.skilled_worker_details where candidate_id = $1',
      p_field_key)
      into v using p_candidate_id;
  end if;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply an approved value to the canonical model. Called ONLY from
-- approve_change_item(). Free-text fields also record their source language
-- (§24 — original submissions are preserved in the change item itself).
-- ---------------------------------------------------------------------------

create or replace function public.apply_candidate_field(
  p_candidate_id uuid,
  p_field_key text,
  p_value jsonb,
  p_source_language public.locale_code default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text := public.assert_field_for_candidate(p_candidate_id, p_field_key);
  v_ftype public.field_type := public.candidate_field_type(p_field_key);
  v_text text := p_value #>> '{}';
  v_array text[];
begin
  if v_ftype = 'array' then
    if p_value is null or jsonb_typeof(p_value) <> 'array' then
      raise exception 'Field % expects a JSON array', p_field_key;
    end if;
    v_array := array(select jsonb_array_elements_text(p_value));
  end if;

  if v_domain = 'core' then
    case p_field_key
      when 'first_name' then
        update public.candidates set first_name = v_text where id = p_candidate_id;
      when 'last_name' then
        update public.candidates set last_name = v_text where id = p_candidate_id;
      when 'phone' then
        update public.candidates set phone = v_text where id = p_candidate_id;
      when 'nationality' then
        update public.candidates set nationality = v_text where id = p_candidate_id;
      when 'country_of_residence' then
        update public.candidates set country_of_residence = v_text where id = p_candidate_id;
      when 'date_of_birth' then
        update public.candidates set date_of_birth = v_text::date where id = p_candidate_id;
      when 'availability_date' then
        update public.candidates set availability_date = v_text::date where id = p_candidate_id;
      when 'drivers_license' then
        update public.candidates set drivers_license = v_text::boolean where id = p_candidate_id;
      when 'relocation_ready' then
        update public.candidates set relocation_ready = v_text::boolean where id = p_candidate_id;
      when 'german_level' then
        update public.candidates set german_level = v_text::public.german_level where id = p_candidate_id;
    end case;

  elsif v_domain = 'occupations' then
    -- Replace the ranked wish list. History survives in the change items.
    delete from public.candidate_target_occupations where candidate_id = p_candidate_id;
    insert into public.candidate_target_occupations (candidate_id, occupation, rank)
    select p_candidate_id, t.value, t.ordinality
    from jsonb_array_elements_text(p_value) with ordinality as t(value, ordinality);

  elsif v_domain = 'apprenticeship' then
    insert into public.apprenticeship_details (candidate_id)
    values (p_candidate_id)
    on conflict (candidate_id) do nothing;

    case p_field_key
      when 'desired_training_start' then
        update public.apprenticeship_details set desired_training_start = v_text::date where candidate_id = p_candidate_id;
      when 'school_qualification' then
        update public.apprenticeship_details set school_qualification = v_text where candidate_id = p_candidate_id;
      when 'school_specialization' then
        update public.apprenticeship_details set school_specialization = v_text where candidate_id = p_candidate_id;
      when 'graduation_year' then
        update public.apprenticeship_details set graduation_year = v_text::int where candidate_id = p_candidate_id;
      when 'german_certificate_type' then
        update public.apprenticeship_details set german_certificate_type = v_text where candidate_id = p_candidate_id;
      when 'german_certificate_status' then
        update public.apprenticeship_details set german_certificate_status = v_text where candidate_id = p_candidate_id;
      when 'internship_experience' then
        update public.apprenticeship_details
        set internship_experience = v_text,
            internship_experience_language = coalesce(p_source_language, internship_experience_language)
        where candidate_id = p_candidate_id;
      when 'relevant_experience' then
        update public.apprenticeship_details
        set relevant_experience = v_text,
            relevant_experience_language = coalesce(p_source_language, relevant_experience_language)
        where candidate_id = p_candidate_id;
      when 'motivation_summary' then
        update public.apprenticeship_details
        set motivation_summary = v_text,
            motivation_summary_language = coalesce(p_source_language, motivation_summary_language)
        where candidate_id = p_candidate_id;
      when 'preferred_locations' then
        update public.apprenticeship_details set preferred_locations = v_array where candidate_id = p_candidate_id;
    end case;

  else -- skilled
    insert into public.skilled_worker_details (candidate_id)
    values (p_candidate_id)
    on conflict (candidate_id) do nothing;

    case p_field_key
      when 'profession' then
        update public.skilled_worker_details set profession = v_text where candidate_id = p_candidate_id;
      when 'years_experience' then
        update public.skilled_worker_details set years_experience = v_text::numeric where candidate_id = p_candidate_id;
      when 'highest_qualification' then
        update public.skilled_worker_details set highest_qualification = v_text where candidate_id = p_candidate_id;
      when 'specialization' then
        update public.skilled_worker_details set specialization = v_text where candidate_id = p_candidate_id;
      when 'preferred_positions' then
        update public.skilled_worker_details set preferred_positions = v_array where candidate_id = p_candidate_id;
      when 'preferred_locations' then
        update public.skilled_worker_details set preferred_locations = v_array where candidate_id = p_candidate_id;
    end case;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_candidate_changes: the ONLY candidate write path for proposed
-- changes. Creates one change set with items; current_value is snapshotted
-- from the canonical model server-side (cannot be forged by the client).
--
-- p_items: [{ "field_key": "german_level", "proposed_value": "B2",
--             "source_language": "fr" | null }, ...]
--
-- The same function will be reused by the future AI extraction pipeline
-- (with source = 'ai_extraction') — AI output NEVER becomes canonical
-- without admin approval (§8).
-- ---------------------------------------------------------------------------

create or replace function public.submit_candidate_changes(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate_id uuid := public.own_candidate_id();
  v_set_id uuid;
  itm jsonb;
  v_field_key text;
  v_count int := 0;
begin
  if v_candidate_id is null then
    raise exception 'Only active candidates may submit changes';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'No changes submitted';
  end if;

  insert into public.candidate_change_sets (candidate_id, source, submitted_by)
  values (v_candidate_id, 'candidate', auth.uid())
  returning id into v_set_id;

  for itm in select * from jsonb_array_elements(p_items) loop
    v_field_key := itm ->> 'field_key';
    if v_field_key is null or itm -> 'proposed_value' is null then
      raise exception 'Each item needs field_key and proposed_value';
    end if;

    insert into public.candidate_change_items
      (change_set_id, candidate_id, field_key, field_type,
       current_value, proposed_value, source_language)
    values (
      v_set_id,
      v_candidate_id,
      v_field_key,
      public.candidate_field_type(v_field_key),
      public.candidate_field_current_value(v_candidate_id, v_field_key),
      itm -> 'proposed_value',
      nullif(itm ->> 'source_language', '')::public.locale_code
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'No changes submitted';
  end if;

  return v_set_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Change set status roll-up: pending while any item is pending; afterwards
-- approved if at least one item was approved, otherwise rejected.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_change_set_status(p_set_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending int;
  v_approved int;
begin
  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'approved')
  into v_pending, v_approved
  from public.candidate_change_items
  where change_set_id = p_set_id;

  if v_pending > 0 then
    update public.candidate_change_sets
    set status = 'pending'
    where id = p_set_id;
  else
    update public.candidate_change_sets
    set status = (case when v_approved > 0 then 'approved' else 'rejected' end)::public.review_status,
        reviewed_by = coalesce(reviewed_by, auth.uid()),
        reviewed_at = coalesce(reviewed_at, now())
    where id = p_set_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin review: approve / reject individual change items (§6, §29).
-- Approval atomically updates the canonical model. The item row (with
-- current_value, proposed_value, reviewer, timestamps, comment) is kept
-- forever — history is never destroyed (§30).
-- ---------------------------------------------------------------------------

create or replace function public.approve_change_item(
  p_item_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.candidate_change_items%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins may review changes';
  end if;

  select * into v_item
  from public.candidate_change_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Change item not found';
  end if;
  if v_item.status <> 'pending' then
    raise exception 'Change item already reviewed';
  end if;

  perform public.apply_candidate_field(
    v_item.candidate_id, v_item.field_key,
    v_item.proposed_value, v_item.source_language);

  update public.candidate_change_items
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_comment = p_comment
  where id = p_item_id;

  perform public.refresh_change_set_status(v_item.change_set_id);
end;
$$;

create or replace function public.reject_change_item(
  p_item_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.candidate_change_items%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins may review changes';
  end if;

  select * into v_item
  from public.candidate_change_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Change item not found';
  end if;
  if v_item.status <> 'pending' then
    raise exception 'Change item already reviewed';
  end if;

  update public.candidate_change_items
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_comment = p_comment
  where id = p_item_id;

  perform public.refresh_change_set_status(v_item.change_set_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin document review (§7). On approval, any previously approved document
-- of the same candidate + type becomes 'superseded' — until then the old
-- approved version stays valid.
-- ---------------------------------------------------------------------------

create or replace function public.review_document(
  p_document_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc public.candidate_documents%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins may review documents';
  end if;

  select * into v_doc
  from public.candidate_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Document not found';
  end if;
  if v_doc.verification_status <> 'pending_review' then
    raise exception 'Document already reviewed';
  end if;

  if p_approve then
    update public.candidate_documents
    set verification_status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = p_note
    where id = p_document_id;

    update public.candidate_documents
    set verification_status = 'superseded'
    where candidate_id = v_doc.candidate_id
      and document_type = v_doc.document_type
      and id <> p_document_id
      and verification_status = 'approved';
  else
    update public.candidate_documents
    set verification_status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = p_note
    where id = p_document_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: RPCs callable by authenticated users (they enforce their own
-- authorization); internal helpers are locked down.
-- ---------------------------------------------------------------------------

revoke all on function public.candidate_field_domain(text) from public, anon, authenticated;
revoke all on function public.candidate_field_type(text) from public, anon, authenticated;
revoke all on function public.assert_field_for_candidate(uuid, text) from public, anon, authenticated;
revoke all on function public.candidate_field_current_value(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_candidate_field(uuid, text, jsonb, public.locale_code) from public, anon, authenticated;
revoke all on function public.refresh_change_set_status(uuid) from public, anon, authenticated;

revoke all on function public.submit_candidate_changes(jsonb) from public, anon;
revoke all on function public.approve_change_item(uuid, text) from public, anon;
revoke all on function public.reject_change_item(uuid, text) from public, anon;
revoke all on function public.review_document(uuid, boolean, text) from public, anon;

grant execute on function public.submit_candidate_changes(jsonb) to authenticated;
grant execute on function public.approve_change_item(uuid, text) to authenticated;
grant execute on function public.reject_change_item(uuid, text) to authenticated;
grant execute on function public.review_document(uuid, boolean, text) to authenticated;


-- =====================================================================
-- TEIL: 20260818000007_rls.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0007: Row Level Security (§27).
--
-- RLS is enabled on EVERY table; anything not explicitly allowed is denied.
-- All helper functions require account_status = 'active', so suspended /
-- invited / pending_verification accounts cannot read protected data (§3A).
-- Exception by design: users may read their OWN app_users row regardless of
-- status ("read own account") — required for the invite/set-password flow.

alter table public.app_users enable row level security;
alter table public.candidates enable row level security;
alter table public.apprenticeship_details enable row level security;
alter table public.skilled_worker_details enable row level security;
alter table public.candidate_target_occupations enable row level security;
alter table public.skills enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.candidate_change_sets enable row level security;
alter table public.candidate_change_items enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.candidate_profile_localizations enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.jobs enable row level security;
alter table public.interest_requests enable row level security;
alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;

-- ---------------------------------------------------------------------------
-- app_users
-- ---------------------------------------------------------------------------

create policy "users read own account"
  on public.app_users for select
  to authenticated
  using (id = auth.uid());

create policy "admins manage app_users"
  on public.app_users for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No self-write policies: role/status changes happen only via admins or the
-- SECURITY DEFINER lifecycle functions (complete_invite, set_preferred_locale).

-- ---------------------------------------------------------------------------
-- candidates + detail tables: candidates read their own canonical data,
-- but can NEVER write it directly (writes = admin or approval functions).
-- ---------------------------------------------------------------------------

create policy "candidates read own record"
  on public.candidates for select
  to authenticated
  using (id = public.own_candidate_id());

create policy "admins manage candidates"
  on public.candidates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "candidates read own apprenticeship details"
  on public.apprenticeship_details for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "admins manage apprenticeship details"
  on public.apprenticeship_details for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "candidates read own skilled worker details"
  on public.skilled_worker_details for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "admins manage skilled worker details"
  on public.skilled_worker_details for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "candidates read own target occupations"
  on public.candidate_target_occupations for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "admins manage target occupations"
  on public.candidate_target_occupations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- skills catalog + candidate skills
-- ---------------------------------------------------------------------------

create policy "active users read skills catalog"
  on public.skills for select
  to authenticated
  using (public.is_active_user());

create policy "admins manage skills catalog"
  on public.skills for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "candidates read own skills"
  on public.candidate_skills for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "admins manage candidate skills"
  on public.candidate_skills for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Change sets / items: candidates read their own (approved history AND
-- pending proposals). Writes go exclusively through the SECURITY DEFINER
-- workflow functions — no direct INSERT/UPDATE policies for candidates.
-- ---------------------------------------------------------------------------

create policy "candidates read own change sets"
  on public.candidate_change_sets for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "admins manage change sets"
  on public.candidate_change_sets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "candidates read own change items"
  on public.candidate_change_items for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "admins manage change items"
  on public.candidate_change_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Documents: candidates upload (always pending_review) and see their own
-- review statuses. Status changes only via review_document(). Employers
-- have NO access to documents whatsoever.
-- ---------------------------------------------------------------------------

create policy "candidates read own documents"
  on public.candidate_documents for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "candidates upload own documents"
  on public.candidate_documents for insert
  to authenticated
  with check (
    candidate_id = public.own_candidate_id()
    and verification_status = 'pending_review'
    and uploaded_by = auth.uid()
    and (
      replaces_document_id is null
      or exists (
        select 1 from public.candidate_documents d
        where d.id = candidate_documents.replaces_document_id
          and d.candidate_id = public.own_candidate_id()
      )
    )
  );

create policy "admins manage documents"
  on public.candidate_documents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Publication layer: employers see ONLY published, anonymized profiles.
-- ---------------------------------------------------------------------------

create policy "candidates read own profile"
  on public.candidate_profiles for select
  to authenticated
  using (candidate_id = public.own_candidate_id());

create policy "employers read published profiles"
  on public.candidate_profiles for select
  to authenticated
  using (public.is_employer() and profile_status = 'published');

create policy "admins manage profiles"
  on public.candidate_profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "candidates read own profile localizations"
  on public.candidate_profile_localizations for select
  to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = candidate_profile_id
        and p.candidate_id = public.own_candidate_id()
    )
  );

create policy "employers read published profile localizations"
  on public.candidate_profile_localizations for select
  to authenticated
  using (
    public.is_employer()
    and exists (
      select 1 from public.candidate_profiles p
      where p.id = candidate_profile_id
        and p.profile_status = 'published'
    )
  );

create policy "admins manage profile localizations"
  on public.candidate_profile_localizations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Companies / members / jobs
-- ---------------------------------------------------------------------------

create policy "employers read own companies"
  on public.companies for select
  to authenticated
  using (id in (select public.own_company_ids()));

create policy "admins manage companies"
  on public.companies for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "employers read own memberships"
  on public.company_members for select
  to authenticated
  using (user_id = auth.uid() and public.is_employer());

create policy "admins manage company members"
  on public.company_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "employers read own company jobs"
  on public.jobs for select
  to authenticated
  using (company_id in (select public.own_company_ids()));

create policy "employers manage own company jobs"
  on public.jobs for insert
  to authenticated
  with check (company_id in (select public.own_company_ids()));

create policy "employers update own company jobs"
  on public.jobs for update
  to authenticated
  using (company_id in (select public.own_company_ids()))
  with check (company_id in (select public.own_company_ids()));

create policy "admins manage jobs"
  on public.jobs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Interest requests: employers create them against PUBLISHED profiles only;
-- they never reveal candidate identity (the request references the
-- anonymized profile, and candidates/documents stay inaccessible).
-- ---------------------------------------------------------------------------

create policy "employers read own interest requests"
  on public.interest_requests for select
  to authenticated
  using (company_id in (select public.own_company_ids()));

create policy "employers create interest requests"
  on public.interest_requests for insert
  to authenticated
  with check (
    company_id in (select public.own_company_ids())
    and requested_by = auth.uid()
    and status = 'new'
    and exists (
      select 1 from public.candidate_profiles p
      where p.id = candidate_profile_id
        and p.profile_status = 'published'
    )
  );

create policy "admins manage interest requests"
  on public.interest_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Subscription-ready tables
-- ---------------------------------------------------------------------------

create policy "active users read plans"
  on public.plans for select
  to authenticated
  using (public.is_active_user() and is_active);

create policy "admins manage plans"
  on public.plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "active users read plan entitlements"
  on public.plan_entitlements for select
  to authenticated
  using (public.is_active_user());

create policy "admins manage plan entitlements"
  on public.plan_entitlements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "users read own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid() and public.is_active_user());

create policy "admins manage subscriptions"
  on public.subscriptions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "users read own payments"
  on public.payments for select
  to authenticated
  using (user_id = auth.uid() and public.is_active_user());

create policy "admins manage payments"
  on public.payments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "users read own entitlements"
  on public.entitlements for select
  to authenticated
  using (user_id = auth.uid() and public.is_active_user());

create policy "admins manage entitlements"
  on public.entitlements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage policies (bucket 'candidate-documents', private).
-- Path convention: <candidate_id>/<uuid>-<filename>. Candidates only touch
-- their own folder; admins read everything; employers get nothing.
-- Access URLs are always short-lived signed URLs created server-side.
-- ---------------------------------------------------------------------------

create policy "candidates upload own document files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = public.own_candidate_id()::text
  );

create policy "candidates read own document files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = public.own_candidate_id()::text
  );

create policy "admins read all candidate document files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'candidate-documents' and public.is_admin());

create policy "admins delete candidate document files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'candidate-documents' and public.is_admin());


-- =====================================================================
-- TEIL: 20260818000008_public_profiles.sql
-- =====================================================================

-- NORAV V0.1 — Migration 0008: Public marketplace preparation (gate §3).
--
-- Product rule: published anonymized candidate profiles will be viewable
-- WITHOUT an employer account. This migration prepares exactly that at the
-- database level — no Marketplace UI is built yet.
--
-- What anonymous visitors may read:
--   * candidate_profiles rows with profile_status = 'published'
--   * their localizations, but only with translation_status = 'approved'
--
-- Everything else stays closed to anon: candidate identity, contact data,
-- documents, storage paths, pending changes, admin data — none of those
-- tables gain anon policies, so RLS keeps denying them.
--
-- Interest requests still REQUIRE authentication: the insert policy on
-- interest_requests is restricted to active employers, so "Request
-- Introduction" is the point where an account becomes mandatory.

create policy "public read published profiles"
  on public.candidate_profiles for select
  to anon
  using (profile_status = 'published');

create policy "public read approved localizations of published profiles"
  on public.candidate_profile_localizations for select
  to anon
  using (
    translation_status = 'approved'
    and exists (
      select 1 from public.candidate_profiles p
      where p.id = candidate_profile_id
        and p.profile_status = 'published'
    )
  );


-- =====================================================================
-- TEIL: seed.sql (Referenzdaten: Skills-Katalog, Plaene)
-- =====================================================================

-- NORAV V0.1 — Seed data (idempotent).
-- Reference data only. Dev/test USERS are created by scripts/seed-dev.ts
-- (service role required) — never here.

-- Skills catalog: language-neutral keys, labels are translated in the UI.
insert into public.skills (skill_key, category) values
  ('care_basics', 'healthcare'),
  ('patient_support', 'healthcare'),
  ('hotel_service', 'hospitality'),
  ('kitchen_basics', 'hospitality'),
  ('retail_sales', 'commerce'),
  ('warehouse_logistics', 'logistics'),
  ('metal_working', 'crafts'),
  ('electrical_basics', 'crafts'),
  ('it_support', 'it'),
  ('office_administration', 'administration'),
  ('customer_service', 'general'),
  ('teamwork', 'general')
on conflict (skill_key) do nothing;

-- Plans: 'free' and 'paid' as required by §17. No pricing is defined in V0.1.
insert into public.plans (plan_key, name, description) values
  ('free', 'Free', 'Default plan. Pricing and paid features are defined post-V0.1.'),
  ('paid', 'Paid', 'Placeholder for the future paid plan. No pricing defined in V0.1.')
on conflict (plan_key) do nothing;

-- Placeholder entitlement keys (feature access will be entitlement-based).
insert into public.plan_entitlements (plan_id, entitlement_key, limit_value)
select p.id, e.entitlement_key, e.limit_value
from public.plans p
join (values
  ('free', 'profile_publication', 1),
  ('paid', 'profile_publication', 1),
  ('paid', 'priority_review', null::int)
) as e(plan_key, entitlement_key, limit_value)
  on e.plan_key = p.plan_key
on conflict (plan_id, entitlement_key) do nothing;


select 'NORAV Setup erfolgreich abgeschlossen' as status;
