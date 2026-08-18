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
