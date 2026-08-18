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
