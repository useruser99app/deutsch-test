-- NORAV V0.1 — Migration 0009: harden handle_new_user() against
-- client-controlled role/status metadata.
--
-- Two findings from the real Supabase run:
--
-- 1. The trigger cannot be relied on to carry role/account_status at all.
--    It reads the metadata present at INSERT time on auth.users, which the
--    Auth service does not reliably populate before the trigger fires, so
--    the safe defaults stand. Account provisioning is therefore done
--    explicitly server-side after the user exists (src/lib/provisioning.ts),
--    and this trigger only has to establish a safe starting row.
--
-- 2. raw_user_meta_data is CLIENT-WRITABLE: it is what signUp({options:
--    {data}}) and auth.updateUser({data}) write. Reading norav_role or
--    norav_account_status from it made a privilege decision out of
--    attacker-controlled input — with public sign-ups enabled, a self-
--    registration carrying norav_role='admin' would have created an active
--    admin. Public sign-up is switched off in the dashboard, but that is a
--    configuration control, not a code control.
--
-- This migration removes role and account_status from the user_metadata
-- path. Only raw_app_meta_data is consulted, which is writable exclusively
-- by the service role. Defaults stay 'candidate' / 'invited', so an
-- unprovisioned account is never active and never privileged.
--
-- preferred_locale may still come from user metadata: it grants nothing and
-- only carries the UI language the account was created with.

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
    -- Privileged fields: service-role-writable app_metadata only.
    coalesce(
      nullif(new.raw_app_meta_data ->> 'norav_role', ''),
      'candidate'
    )::public.user_role,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'norav_account_status', ''),
      'invited'
    )::public.account_status,
    -- Non-privileged: either source is acceptable.
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

revoke all on function public.handle_new_user() from public;
