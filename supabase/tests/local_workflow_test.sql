-- §34 mandatory workflow test against a LOCAL PostgreSQL with the Supabase
-- stub (local_supabase_stub.sql). Simulates sessions via
-- `set role authenticated` + the request.jwt.claim.sub GUC.
--
-- Usage (fresh local database):
--   psql -d norav -f supabase/tests/local_supabase_stub.sql
--   for f in supabase/migrations/*.sql; do psql -d norav -f "$f"; done
--   psql -d norav -f supabase/seed.sql
--   psql -d norav -f supabase/tests/local_workflow_test.sql
--
-- For the end-to-end test against a REAL Supabase project use
-- `npm run test:workflow` instead. Do NOT run this file against production.
\set ON_ERROR_STOP on

-- Fixed IDs
\set admin_uid '''00000000-0000-0000-0000-0000000000a1'''
\set canda_uid '''00000000-0000-0000-0000-0000000000c1'''
\set candb_uid '''00000000-0000-0000-0000-0000000000c2'''
\set emp_uid   '''00000000-0000-0000-0000-0000000000e1'''
\set invited_uid '''00000000-0000-0000-0000-0000000000c9'''

-- ---------------------------------------------------------------
-- Setup: auth users → trigger creates app_users
-- ---------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  (:admin_uid, 'admin@test', '{"norav_role":"admin","norav_account_status":"active"}'),
  (:canda_uid, 'canda@test', '{"norav_role":"candidate","norav_account_status":"active","norav_locale":"fr"}'),
  (:candb_uid, 'candb@test', '{"norav_role":"candidate","norav_account_status":"active","norav_locale":"ar"}'),
  (:emp_uid,   'emp@test',   '{"norav_role":"employer","norav_account_status":"active"}'),
  (:invited_uid, 'invited@test', '{"norav_role":"candidate"}');

do $$
begin
  if (select count(*) from public.app_users) <> 5 then
    raise exception 'FAIL: app_users trigger did not create 5 rows';
  end if;
  if (select account_status from public.app_users where email = 'invited@test') <> 'invited' then
    raise exception 'FAIL: default account_status should be invited';
  end if;
  raise notice 'PASS: auth trigger + account_status defaults';
end $$;

-- Candidates (created by admin path / service role in real life)
insert into public.candidates (id, user_id, candidate_type, first_name, last_name, email, german_level, phone, date_of_birth)
values ('20000000-0000-0000-0000-0000000000a1', :canda_uid, 'apprenticeship_candidate', 'Amina', 'Testfall', 'canda@test', 'B1', '+212600000000', '2004-03-15');
insert into public.apprenticeship_details (candidate_id) values ('20000000-0000-0000-0000-0000000000a1');
insert into public.candidate_profiles (candidate_id, candidate_type, country, german_level)
values ('20000000-0000-0000-0000-0000000000a1', 'apprenticeship_candidate', 'MA', 'B1');

insert into public.candidates (id, user_id, candidate_type, first_name, last_name, email, german_level)
values ('20000000-0000-0000-0000-0000000000b1', :candb_uid, 'skilled_worker', 'Youssef', 'Testfall', 'candb@test', 'B2');

insert into public.companies (id, name, country, city)
values ('30000000-0000-0000-0000-000000000001', 'WF Test GmbH', 'DE', 'Berlin');
insert into public.company_members (company_id, user_id, member_role)
values ('30000000-0000-0000-0000-000000000001', :emp_uid, 'owner');

do $$
declare v_code text;
begin
  select candidate_code into v_code from public.candidates where first_name = 'Amina';
  if v_code !~ '^NOR-\d{5}$' then
    raise exception 'FAIL: candidate_code format: %', v_code;
  end if;
  raise notice 'PASS: candidate_code format (%)', v_code;
end $$;

-- ---------------------------------------------------------------
-- 1. Candidate A proposes German B1 -> B2
-- ---------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c1';

select public.submit_candidate_changes('[{"field_key":"german_level","proposed_value":"B2"}]'::jsonb) as change_set_id \gset

do $$
declare v jsonb; lvl public.german_level;
begin
  select german_level into lvl from public.candidates;
  if lvl <> 'B1' then raise exception 'FAIL: canonical should still be B1, got %', lvl; end if;
  select current_value into v from public.candidate_change_items where status = 'pending';
  if v <> '"B1"'::jsonb then raise exception 'FAIL: snapshot current_value expected "B1", got %', v; end if;
  raise notice 'PASS: canonical B1, pending proposal B2 with server-side snapshot';
end $$;

-- Candidate cannot write canonical data directly
do $$
declare n int;
begin
  update public.candidates set german_level = 'C2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: candidate updated canonical data directly'; end if;
  begin
    insert into public.candidates (candidate_type, first_name, last_name, email)
    values ('skilled_worker', 'Hack', 'Er', 'x@test');
    raise exception 'FAIL: candidate inserted into candidates';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: candidate cannot modify canonical data (RLS)';
end $$;

-- Candidate cannot approve own change
do $$
declare v_item uuid;
begin
  select id into v_item from public.candidate_change_items where status = 'pending';
  begin
    perform public.approve_change_item(v_item);
    raise exception 'FAIL: candidate approved own change';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: candidate cannot approve changes';
end $$;

-- ---------------------------------------------------------------
-- 2. Candidate B isolation
-- ---------------------------------------------------------------
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c2';
do $$
begin
  if exists (select 1 from public.candidates where first_name = 'Amina') then
    raise exception 'FAIL: candidate B can read candidate A';
  end if;
  if exists (select 1 from public.candidate_change_items) then
    raise exception 'FAIL: candidate B can read A change items';
  end if;
  if exists (select 1 from public.candidate_documents) then
    raise exception 'FAIL: candidate B can read A documents';
  end if;
  raise notice 'PASS: candidate B fully isolated from candidate A';
end $$;

-- ---------------------------------------------------------------
-- 3. Admin review & approval
-- ---------------------------------------------------------------
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_item uuid; cur jsonb; prop jsonb;
begin
  select id, current_value, proposed_value into v_item, cur, prop
  from public.candidate_change_items where status = 'pending';
  if cur <> '"B1"'::jsonb or prop <> '"B2"'::jsonb then
    raise exception 'FAIL: admin does not see current B1 / proposed B2';
  end if;
  perform public.approve_change_item(v_item, 'looks correct');
  raise notice 'PASS: admin sees B1 -> B2 and approved it';
end $$;

do $$
declare lvl public.german_level; st public.review_status; cur jsonb; rb uuid; setst public.review_status;
begin
  select german_level into lvl from public.candidates where first_name = 'Amina';
  if lvl <> 'B2' then raise exception 'FAIL: canonical should be B2 after approval, got %', lvl; end if;
  select status, current_value, reviewed_by into st, cur, rb from public.candidate_change_items;
  if st <> 'approved' or cur <> '"B1"'::jsonb or rb is null then
    raise exception 'FAIL: audit trail incomplete (status %, current %, reviewer %)', st, cur, rb;
  end if;
  select status into setst from public.candidate_change_sets;
  if setst <> 'approved' then raise exception 'FAIL: change set status should be approved'; end if;
  raise notice 'PASS: canonical B2; history keeps B1 + reviewer + comment';
end $$;

-- ---------------------------------------------------------------
-- 4. Document upload (candidate) + review (admin) + supersede
-- ---------------------------------------------------------------
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c1';
insert into storage.objects (bucket_id, name)
values ('candidate-documents', '20000000-0000-0000-0000-0000000000a1/cert1.pdf');
insert into public.candidate_documents (id, candidate_id, document_type, file_path, original_filename, mime_type, uploaded_by)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', 'language_certificate',
        '20000000-0000-0000-0000-0000000000a1/cert1.pdf', 'b2-cert.pdf', 'application/pdf', '00000000-0000-0000-0000-0000000000c1');

do $$
declare st public.document_status;
begin
  select verification_status into st from public.candidate_documents where id = '40000000-0000-0000-0000-000000000001';
  if st <> 'pending_review' then raise exception 'FAIL: upload should be pending_review'; end if;
  begin
    update public.candidate_documents set verification_status = 'approved'
    where id = '40000000-0000-0000-0000-000000000001';
    if exists (select 1 from public.candidate_documents
               where id = '40000000-0000-0000-0000-000000000001'
                 and verification_status = 'approved') then
      raise exception 'FAIL: candidate self-approved document';
    end if;
  end;
  raise notice 'PASS: document pending_review; candidate cannot self-approve';
end $$;

-- Candidate B cannot insert a document for candidate A
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c2';
do $$
begin
  begin
    insert into public.candidate_documents (candidate_id, document_type, file_path, original_filename, mime_type, uploaded_by)
    values ('20000000-0000-0000-0000-0000000000a1', 'cv', 'x/evil.pdf', 'evil.pdf', 'application/pdf', '00000000-0000-0000-0000-0000000000c2');
    raise exception 'FAIL: candidate B inserted document for A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: cross-candidate document insert blocked';
end $$;

-- Admin approves
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
select public.review_document('40000000-0000-0000-0000-000000000001', true, 'verified');
do $$
declare st public.document_status;
begin
  select verification_status into st from public.candidate_documents where id = '40000000-0000-0000-0000-000000000001';
  if st <> 'approved' then raise exception 'FAIL: document should be approved'; end if;
  raise notice 'PASS: admin approved document';
end $$;

-- Replacement: new upload stays pending, old stays approved until approval
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c1';
insert into public.candidate_documents (id, candidate_id, document_type, file_path, original_filename, mime_type, uploaded_by, replaces_document_id)
values ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000a1', 'language_certificate',
        '20000000-0000-0000-0000-0000000000a1/cert2.pdf', 'c1-cert.pdf', 'application/pdf',
        '00000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000001');
do $$
begin
  if (select verification_status from public.candidate_documents where id = '40000000-0000-0000-0000-000000000001') <> 'approved' then
    raise exception 'FAIL: old approved document must stay approved while replacement pending';
  end if;
  raise notice 'PASS: old version stays approved while replacement is pending';
end $$;
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
select public.review_document('40000000-0000-0000-0000-000000000002', true, 'new certificate');
do $$
begin
  if (select verification_status from public.candidate_documents where id = '40000000-0000-0000-0000-000000000001') <> 'superseded' then
    raise exception 'FAIL: old document should be superseded after replacement approval';
  end if;
  if (select verification_status from public.candidate_documents where id = '40000000-0000-0000-0000-000000000002') <> 'approved' then
    raise exception 'FAIL: replacement should be approved';
  end if;
  raise notice 'PASS: supersede chain works, history preserved';
end $$;

-- ---------------------------------------------------------------
-- 5. Employer isolation & publication
-- ---------------------------------------------------------------
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000e1';
do $$
begin
  if exists (select 1 from public.candidates) then
    raise exception 'FAIL: employer can read candidate identities';
  end if;
  if exists (select 1 from public.candidate_documents) then
    raise exception 'FAIL: employer can read documents';
  end if;
  if exists (select 1 from public.candidate_change_items) then
    raise exception 'FAIL: employer can read change items';
  end if;
  if exists (select 1 from public.candidate_profiles) then
    raise exception 'FAIL: employer sees unpublished profiles';
  end if;
  if not exists (select 1 from public.companies where name = 'WF Test GmbH') then
    raise exception 'FAIL: employer cannot read own company';
  end if;
  raise notice 'PASS: employer sees own company, no candidate identity/documents, no drafts';
end $$;

-- Admin publishes profile
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
update public.candidate_profiles set profile_status = 'published', published_at = now();

set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000e1';
do $$
declare n int;
begin
  select count(*) into n from public.candidate_profiles where profile_status = 'published';
  if n <> 1 then raise exception 'FAIL: employer should see 1 published profile, got %', n; end if;
  -- interest request against the published profile
  insert into public.interest_requests (company_id, candidate_profile_id, requested_by, message)
  select '30000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-0000000000e1', 'Introduction please'
  from public.candidate_profiles limit 1;
  raise notice 'PASS: employer sees published anonymized profile + can create interest request';
end $$;

-- ---------------------------------------------------------------
-- 6. Suspended / invited lockout
-- ---------------------------------------------------------------
reset role;
update public.app_users set account_status = 'suspended' where email = 'canda@test';
set role authenticated;
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c1';
do $$
begin
  if exists (select 1 from public.candidates) then
    raise exception 'FAIL: suspended candidate reads protected data';
  end if;
  if exists (select 1 from public.candidate_documents) then
    raise exception 'FAIL: suspended candidate reads documents';
  end if;
  begin
    perform public.submit_candidate_changes('[{"field_key":"phone","proposed_value":"+491700"}]'::jsonb);
    raise exception 'FAIL: suspended candidate submitted changes';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  if not exists (select 1 from public.app_users where id = auth.uid()) then
    raise exception 'FAIL: suspended user should still read own account row';
  end if;
  raise notice 'PASS: suspended account locked out of protected data';
end $$;

set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c9';
do $$
begin
  if exists (select 1 from public.candidates) then
    raise exception 'FAIL: invited account reads protected data';
  end if;
  -- complete_invite flips invited -> active
  perform public.complete_invite();
  if (select account_status from public.app_users where id = auth.uid()) <> 'active' then
    raise exception 'FAIL: complete_invite did not activate account';
  end if;
  raise notice 'PASS: invited locked out; complete_invite activates account';
end $$;

-- ---------------------------------------------------------------
-- 7. Language neutrality + array change items (JSONB model)
-- ---------------------------------------------------------------
reset role;
update public.app_users set account_status = 'active' where email = 'canda@test';
set role authenticated;
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c1';
select public.submit_candidate_changes(
  '[{"field_key":"preferred_locations","proposed_value":["Berlin","Hamburg"]},
    {"field_key":"target_occupations","proposed_value":["Pflegefachmann","Hotelfachmann"]},
    {"field_key":"motivation_summary","proposed_value":"Je souhaite commencer une Ausbildung.","source_language":"fr"}]'::jsonb);

set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  for r in select id from public.candidate_change_items where status = 'pending' loop
    perform public.approve_change_item(r.id, 'ok');
  end loop;
end $$;

do $$
declare locs text[]; occ int; ms text; msl public.locale_code; ctype public.candidate_type;
begin
  select preferred_locations, motivation_summary, motivation_summary_language
    into locs, ms, msl
  from public.apprenticeship_details;
  if locs <> array['Berlin','Hamburg'] then raise exception 'FAIL: array apply failed: %', locs; end if;
  if ms is null or msl <> 'fr' then raise exception 'FAIL: free text + source language not preserved'; end if;
  select count(*) into occ from public.candidate_target_occupations;
  if occ <> 2 then raise exception 'FAIL: expected 2 target occupations, got %', occ; end if;
  select candidate_type into ctype from public.candidates where first_name = 'Amina';
  if ctype <> 'apprenticeship_candidate' then raise exception 'FAIL: candidate_type not language-neutral'; end if;
  raise notice 'PASS: JSONB arrays, free-text source language, language-neutral keys';
end $$;

-- Unknown field key must be rejected
do $$
begin
  begin
    perform public.submit_candidate_changes('[{"field_key":"evil_field","proposed_value":"x"}]'::jsonb);
    raise exception 'FAIL: unknown field key accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  -- type-specific field for wrong candidate type must be rejected
  raise notice 'PASS: unknown field keys rejected';
end $$;

-- Skilled-worker field from an apprenticeship candidate must be rejected
do $$
begin
  begin
    perform public.submit_candidate_changes('[{"field_key":"profession","proposed_value":"Elektriker"}]'::jsonb);
    raise exception 'FAIL: wrong-domain field accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: candidate-type field validation works';
end $$;

-- ---------------------------------------------------------------
-- 8. Storage policies
-- ---------------------------------------------------------------
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c2';
do $$
begin
  if exists (select 1 from storage.objects where name like '20000000-0000-0000-0000-0000000000a1/%') then
    raise exception 'FAIL: candidate B can list A storage objects';
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('candidate-documents', '20000000-0000-0000-0000-0000000000a1/evil.pdf');
    raise exception 'FAIL: candidate B wrote into A folder';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: storage isolated per candidate folder';
end $$;
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
do $$
begin
  if (select count(*) from storage.objects) < 1 then
    raise exception 'FAIL: admin cannot read storage objects';
  end if;
  raise notice 'PASS: admin can read all candidate document files';
end $$;

-- ---------------------------------------------------------------
-- 9. Public marketplace preparation (migration 0008): anon access
-- ---------------------------------------------------------------
reset role;
insert into public.candidate_profile_localizations
  (candidate_profile_id, locale, public_title, translation_status)
select id, 'de', 'Pflege-Auszubildende (B2)', 'approved' from public.candidate_profiles limit 1;
insert into public.candidate_profile_localizations
  (candidate_profile_id, locale, public_title, translation_status)
select id, 'fr', 'Brouillon interne', 'draft' from public.candidate_profiles limit 1;

set role anon;
reset request.jwt.claim.sub;
do $$
begin
  if (select count(*) from public.candidate_profiles) <> 1 then
    raise exception 'FAIL: anon should see exactly the 1 published profile';
  end if;
  if (select count(*) from public.candidate_profile_localizations) <> 1
     or exists (select 1 from public.candidate_profile_localizations where translation_status <> 'approved') then
    raise exception 'FAIL: anon should see only approved localizations';
  end if;
  if exists (select 1 from public.candidates)
     or exists (select 1 from public.candidate_documents)
     or exists (select 1 from public.candidate_change_items)
     or exists (select 1 from public.app_users)
     or exists (select 1 from public.companies)
     or exists (select 1 from storage.objects) then
    raise exception 'FAIL: anon can read protected data';
  end if;
  begin
    insert into public.interest_requests (company_id, candidate_profile_id, message)
    select '30000000-0000-0000-0000-000000000001', id, 'anon attempt'
    from public.candidate_profiles limit 1;
    raise exception 'FAIL: anon created an interest request';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: anon sees only published+approved profile data; identity, documents and requests stay closed';
end $$;

-- ---------------------------------------------------------------
-- 10. Provisioning: safe trigger defaults + no privilege escalation
--     (migration 0009). raw_user_meta_data is client-writable, so it must
--     never decide role or account_status.
-- ---------------------------------------------------------------
reset role;

-- A self-registration style insert claiming admin/active via USER metadata
-- must be ignored: the account has to fall back to the safe defaults.
insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000000f1',
  'escalation@test',
  '{"norav_role":"admin","norav_account_status":"active","norav_locale":"fr"}'
);
do $$
declare r public.user_role; st public.account_status; loc public.locale_code;
begin
  select role, account_status, preferred_locale into r, st, loc
  from public.app_users where email = 'escalation@test';
  if r <> 'candidate' or st <> 'invited' then
    raise exception 'FAIL: user_metadata escalated to role=% status=%', r, st;
  end if;
  if loc <> 'fr' then
    raise exception 'FAIL: non-privileged locale from user_metadata was dropped (%)', loc;
  end if;
  raise notice 'PASS: user_metadata cannot set role/account_status; locale still honoured';
end $$;

-- The service-role path (app_metadata) still provisions correctly.
insert into auth.users (id, email, raw_app_meta_data) values (
  '00000000-0000-0000-0000-0000000000f2',
  'employer-invite@test',
  '{"norav_role":"employer","norav_account_status":"invited","norav_locale":"de"}'
);
do $$
declare r public.user_role; st public.account_status;
begin
  select role, account_status into r, st
  from public.app_users where email = 'employer-invite@test';
  if r <> 'employer' or st <> 'invited' then
    raise exception 'FAIL: app_metadata provisioning gave role=% status=%', r, st;
  end if;
  raise notice 'PASS: app_metadata (service role only) still provisions employer/invited';
end $$;

-- An invite that carries NO metadata at all — the real path, where the app
-- provisions explicitly afterwards — must start safe.
insert into auth.users (id, email) values (
  '00000000-0000-0000-0000-0000000000f3', 'bare-invite@test'
);
do $$
declare r public.user_role; st public.account_status;
begin
  select role, account_status into r, st
  from public.app_users where email = 'bare-invite@test';
  if r <> 'candidate' or st <> 'invited' then
    raise exception 'FAIL: bare invite gave role=% status=%', r, st;
  end if;
  raise notice 'PASS: invite without metadata starts as candidate/invited (safe default)';
end $$;

-- Explicit server-side provisioning (what src/lib/provisioning.ts does with
-- the service role) turns it into the intended employer account.
update public.app_users
set role = 'employer', account_status = 'invited', preferred_locale = 'de'
where email = 'bare-invite@test';
do $$
begin
  if (select role from public.app_users where email = 'bare-invite@test') <> 'employer' then
    raise exception 'FAIL: server-side provisioning did not apply';
  end if;
  raise notice 'PASS: server-side provisioning sets role=employer';
end $$;

-- No signed-in user may raise their own role or status.
set role authenticated;
set request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c1';
do $$
declare n int;
begin
  update public.app_users set role = 'admin', account_status = 'active'
  where id = auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: user escalated own app_users row';
  end if;
  if (select role from public.app_users where id = auth.uid()) <> 'candidate' then
    raise exception 'FAIL: own role changed';
  end if;
  -- and not anyone else's either
  update public.app_users set account_status = 'active'
  where email = 'bare-invite@test';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: user modified a foreign app_users row';
  end if;
  raise notice 'PASS: authenticated user cannot raise own or foreign role/status';
end $$;

reset role;
select 'ALL LOCAL WORKFLOW TESTS PASSED' as result;
