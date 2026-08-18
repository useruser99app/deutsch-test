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
