-- NORAV V0.1 — Migration 0011: Employer notification events (Prompt 03B).
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- interest_requests carries only the CURRENT state of a request:
-- reviewed_at is overwritten on every transition, so the history of what
-- happened is destroyed. Prompt 03B needs durable per-event rows for three
-- separate reasons that cannot be met by the existing schema:
--   * an unread badge that counts unseen UPDATES, not total requests (§3)
--   * an activity feed of past events (§9)
--   * e-mail idempotency and delivery state (§17, §18)
--
-- One table covers all three. No existing table, policy or migration is
-- changed, and no private candidate table is opened.

create type public.employer_notification_type as enum (
  'request_reviewing',
  'request_approved',
  'request_rejected',
  'request_introduced'
);

-- 'skipped' = no e-mail provider is configured; the event still exists and
-- the workflow is unaffected.
create type public.email_delivery_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped'
);

create table public.employer_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  interest_request_id uuid not null
    references public.interest_requests (id) on delete cascade,
  -- Kept for convenience only; the employer-facing payload is always read
  -- through employer_candidate_profiles, never from private tables.
  candidate_profile_id uuid
    references public.candidate_profiles (id) on delete set null,
  type public.employer_notification_type not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by uuid references public.app_users (id) on delete set null,
  email_status public.email_delivery_status not null default 'pending',
  email_sent_at timestamptz,
  email_error text
);

-- Idempotency (§17): one event per semantic state transition. A double
-- click, a retried server action or a re-entered status cannot produce a
-- second identical event — and therefore not a second e-mail either.
create unique index idx_employer_notifications_event
  on public.employer_notifications (interest_request_id, type);

create index idx_employer_notifications_unread
  on public.employer_notifications (company_id)
  where read_at is null;

create index idx_employer_notifications_feed
  on public.employer_notifications (company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Event creation (§21)
--
-- A trigger rather than application code: every status transition produces
-- an event no matter which path caused it (admin UI, SQL, a future
-- automation), so there is exactly one source of truth.
-- ---------------------------------------------------------------------------

create or replace function public.on_interest_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type public.employer_notification_type;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_type := (case new.status
    when 'reviewing'  then 'request_reviewing'
    when 'approved'   then 'request_approved'
    when 'rejected'   then 'request_rejected'
    when 'introduced' then 'request_introduced'
    else null
  end)::public.employer_notification_type;

  -- 'new' is the employer's own action and needs no notification back.
  if v_type is null then
    return new;
  end if;

  insert into public.employer_notifications
    (company_id, interest_request_id, candidate_profile_id, type)
  values
    (new.company_id, new.id, new.candidate_profile_id, v_type)
  on conflict (interest_request_id, type) do nothing;

  return new;
end;
$$;

revoke all on function public.on_interest_request_status_change() from public;

create trigger trg_interest_request_notify
  after update of status on public.interest_requests
  for each row execute function public.on_interest_request_status_change();

-- ---------------------------------------------------------------------------
-- Access (§19)
--
-- The schema-wide default privileges grant ALL on new tables to anon and
-- authenticated, so both are revoked first and re-granted narrowly. An
-- employer may read its own company's events and mark them read — the
-- column grant makes it structurally impossible to write type, company_id
-- or the delivery state from a browser session.
-- ---------------------------------------------------------------------------

alter table public.employer_notifications enable row level security;

revoke all on public.employer_notifications from anon, authenticated;
grant select on public.employer_notifications to authenticated;
grant update (read_at, read_by) on public.employer_notifications to authenticated;

create policy "employers read own company notifications"
  on public.employer_notifications for select
  to authenticated
  using (
    company_id in (select public.own_company_ids())
    or public.is_admin()
  );

create policy "employers mark own notifications read"
  on public.employer_notifications for update
  to authenticated
  using (company_id in (select public.own_company_ids()))
  with check (company_id in (select public.own_company_ids()));

-- ---------------------------------------------------------------------------
-- Delivery state (§18)
--
-- Recorded through a privileged function so that the delivery columns are
-- not writable from any browser session. A failure here never touches the
-- request status: the business transition has already been committed.
-- ---------------------------------------------------------------------------

create or replace function public.record_notification_email(
  p_notification_id uuid,
  p_status public.email_delivery_status,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins may record notification delivery state';
  end if;

  update public.employer_notifications
  set email_status = p_status,
      email_sent_at = case when p_status = 'sent' then now() else email_sent_at end,
      -- Provider errors are diagnostic only and never shown to an employer.
      email_error = left(p_error, 500)
  where id = p_notification_id;
end;
$$;

revoke all on function public.record_notification_email(
  uuid, public.email_delivery_status, text) from public;
grant execute on function public.record_notification_email(
  uuid, public.email_delivery_status, text) to authenticated;
