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
