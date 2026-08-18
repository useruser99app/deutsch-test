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
