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
