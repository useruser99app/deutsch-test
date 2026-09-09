-- NORAV V0.1 — Migration 0010: Employer Marketplace & introduction workflow
-- (Prompt 03).
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The publication layer (candidate_profiles, migration 0004) carries only
-- candidate_type, country, german_level and availability_date. Prompt 03 §3
-- requires the employer-facing profile to also show the professional facts
-- that make a candidate assessable: target Ausbildung occupation, desired
-- training start, school qualification, profession, years of experience,
-- preferred locations, mobility. Those live ONLY in the private tables
-- (candidates, apprenticeship_details, skilled_worker_details,
-- candidate_target_occupations, candidate_skills), which employers must
-- never be able to read (§4, §22).
--
-- Rather than granting employers access to those tables, or duplicating a
-- dozen columns onto candidate_profiles (which would go stale after every
-- approved change), this migration adds ONE read surface whose column list
-- IS the whitelist. Nothing else about the frozen 01/02 architecture
-- changes: no existing policy is altered, no existing migration rewritten,
-- and no table gains a new employer SELECT policy.

-- ---------------------------------------------------------------------------
-- 1. Employer-facing candidate view (§3, §4, §10, §11)
--
-- Deliberately ABSENT from this view: first_name, last_name, email, phone,
-- date_of_birth, nationality, user_id, candidate id, document rows, storage
-- paths, change items, review comments. They are not selected, so they can
-- never reach an employer client — not hidden with CSS, not filtered in
-- application code.
--
-- Free text is NOT exposed here. Candidate free text is stored in its own
-- source language (e.g. French) and publishing it as if it were an approved
-- German employer profile is forbidden (§12). Practical experience is
-- therefore surfaced as a language-neutral boolean; the approved German
-- prose comes exclusively from candidate_profile_localizations.
--
-- security_invoker is OFF: the view runs with its owner's rights so it can
-- read the private tables, and its WHERE clause is the entire gate —
-- published profiles only, employers and admins only. A candidate or an
-- anonymous visitor selecting from it gets zero rows.
-- ---------------------------------------------------------------------------

create view public.employer_candidate_profiles
with (security_invoker = false) as
select
  p.id                          as profile_id,
  c.candidate_code,
  p.candidate_type,
  p.published_at,

  -- Canonical single-source fields are read from candidates, not from the
  -- profile snapshot, so an employer never sees a stale German level.
  c.german_level,
  c.availability_date,
  c.relocation_ready,
  c.drivers_license,
  coalesce(p.country, c.country_of_residence) as country,

  -- Ausbildung
  occ.occupations                as target_occupations,
  occ.primary_occupation,
  a.desired_training_start,
  a.school_qualification,
  a.school_specialization,
  a.graduation_year,
  a.german_certificate_type,
  a.german_certificate_status,
  (a.internship_experience is not null or a.relevant_experience is not null)
                                 as has_practical_experience,

  -- Skilled worker
  s.profession,
  s.specialization,
  s.years_experience,
  s.highest_qualification,
  s.preferred_positions,

  -- Shared
  coalesce(a.preferred_locations, s.preferred_locations, '{}')
                                 as preferred_locations,
  coalesce(sk.skills, '{}')      as skills,

  -- The single headline fact, whatever the candidate type is.
  coalesce(occ.primary_occupation, s.profession) as headline_occupation

from public.candidate_profiles p
join public.candidates c
  on c.id = p.candidate_id
left join public.apprenticeship_details a
  on a.candidate_id = c.id
left join public.skilled_worker_details s
  on s.candidate_id = c.id
left join lateral (
  select
    array_agg(o.occupation order by o.rank)              as occupations,
    min(o.occupation) filter (where o.rank = 1)          as primary_occupation
  from public.candidate_target_occupations o
  where o.candidate_id = c.id
) occ on true
left join lateral (
  select array_agg(distinct sk2.skill_key) as skills
  from public.candidate_skills cs
  join public.skills sk2 on sk2.id = cs.skill_id
  where cs.candidate_id = c.id
) sk on true
where p.profile_status = 'published'
  and (public.is_employer() or public.is_admin());

comment on view public.employer_candidate_profiles is
  'Anonymized, employer-facing candidate data. The column list is the '
  'publication whitelist: no name, e-mail, phone, date of birth, documents '
  'or internal review data. Published profiles only, employers/admins only.';

-- anon is deliberately NOT granted: the Marketplace is an authenticated
-- employer surface (§26). Migration 0008's anon read of candidate_profiles
-- stays as it is and exposes no professional detail.
grant select on public.employer_candidate_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Admin publication control (§5)
--
-- Publishing is an admin action and must not silently publish a profile the
-- employer could not assess. The prerequisites are derived from data that
-- already exists — nothing new is demanded of the candidate.
-- ---------------------------------------------------------------------------

create or replace function public.publish_candidate_profile(
  p_candidate_id uuid,
  p_publish boolean
)
returns public.candidate_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.candidates;
  v_profile   public.candidate_profiles;
  v_target    text;
begin
  if not public.is_admin() then
    raise exception 'Only admins may change publication state';
  end if;

  select * into v_candidate
  from public.candidates
  where id = p_candidate_id;

  if not found then
    raise exception 'Candidate not found';
  end if;

  -- Ensure the publication row exists; older candidates may predate it.
  select * into v_profile
  from public.candidate_profiles
  where candidate_id = p_candidate_id;

  if not found then
    insert into public.candidate_profiles
      (candidate_id, candidate_type, country, german_level, availability_date)
    values
      (v_candidate.id, v_candidate.candidate_type,
       v_candidate.country_of_residence, v_candidate.german_level,
       v_candidate.availability_date)
    returning * into v_profile;
  end if;

  if p_publish then
    -- Prerequisites, reported as a clear reason rather than bypassed (§5).
    -- Only genuinely disqualifying lifecycle states block publication.
    -- candidates.status stays 'draft' throughout the existing V0.1 flow —
    -- requiring 'active' here would be an unreachable gate.
    if v_candidate.status in ('inactive', 'archived') then
      raise exception 'PUBLISH_BLOCKED_CANDIDATE_INACTIVE';
    end if;

    if v_candidate.german_level = 'none' then
      raise exception 'PUBLISH_BLOCKED_NO_GERMAN_LEVEL';
    end if;

    if v_candidate.candidate_type = 'apprenticeship_candidate' then
      select o.occupation into v_target
      from public.candidate_target_occupations o
      where o.candidate_id = p_candidate_id and o.rank = 1;
    else
      select s.profession into v_target
      from public.skilled_worker_details s
      where s.candidate_id = p_candidate_id;
    end if;

    if v_target is null or btrim(v_target) = '' then
      raise exception 'PUBLISH_BLOCKED_NO_TARGET';
    end if;

    update public.candidate_profiles
    set profile_status = 'published',
        published_at   = now(),
        candidate_type = v_candidate.candidate_type,
        country        = coalesce(v_candidate.country_of_residence, country),
        german_level   = v_candidate.german_level,
        availability_date = v_candidate.availability_date
    where id = v_profile.id
    returning * into v_profile;
  else
    -- Unpublishing removes the profile from discovery but deletes NOTHING:
    -- the candidate, the profile row and any interest request survive (§I).
    update public.candidate_profiles
    set profile_status = 'unpublished'
    where id = v_profile.id
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.publish_candidate_profile(uuid, boolean) from public;
grant execute on function public.publish_candidate_profile(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Duplicate introduction requests (§15)
--
-- Enforced in the database, so repeated clicks, two open tabs or two
-- colleagues of the same company cannot create parallel active requests for
-- the same candidate. Closed requests (rejected/introduced) are excluded, so
-- a company may legitimately ask again later.
-- ---------------------------------------------------------------------------

create unique index idx_interest_requests_active_unique
  on public.interest_requests (company_id, candidate_profile_id)
  where status in ('new', 'reviewing', 'approved');
