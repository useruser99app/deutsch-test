/* Shared helpers for CLI scripts (seed-dev, test-workflow).
 * Credentials come exclusively from environment variables / .env.local —
 * never from the repository. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local" });
config();

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function anonClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function randomPassword(): string {
  return `Np1!${randomBytes(12).toString("base64url")}`;
}

export interface DevUser {
  id: string;
  email: string;
  password: string;
}

export type ProvisionRole = "admin" | "candidate" | "employer";
export type ProvisionStatus =
  | "invited"
  | "active"
  | "suspended"
  | "pending_verification";

/**
 * Applies the intended account state to public.app_users and verifies it.
 *
 * The handle_new_user() trigger deliberately creates every new auth user
 * with SAFE DEFAULTS (role 'candidate', account_status 'invited'). It reads
 * the norav_* keys from the metadata that exists at INSERT time, and
 * depending on the Supabase Auth version the app_metadata passed to
 * createUser() is not yet visible then — so the defaults stand and the
 * account is inactive. Provisioning therefore has to state the intended
 * role/status/locale explicitly rather than rely on the trigger picking
 * them up.
 *
 * This runs with the service role, which is the provisioning path the
 * architecture already uses (there is no privileged provisioning RPC, and
 * the admin RLS policy needs an already-active admin, which the first admin
 * cannot be). It never relaxes RLS or any policy — it writes the state an
 * operator would otherwise set by hand in the dashboard.
 */
async function applyAccountState(
  service: SupabaseClient,
  userId: string,
  email: string,
  role: ProvisionRole,
  accountStatus: ProvisionStatus,
  locale: string
): Promise<void> {
  const { error: updateError } = await service
    .from("app_users")
    .update({
      role,
      account_status: accountStatus,
      preferred_locale: locale,
    })
    .eq("id", userId);
  if (updateError) {
    throw new Error(
      `Provisioning für ${email} fehlgeschlagen: app_users-Update meldete "${updateError.message}".`
    );
  }

  const { data: verified, error: verifyError } = await service
    .from("app_users")
    .select("id, role, account_status, preferred_locale")
    .eq("id", userId)
    .maybeSingle();
  if (verifyError) {
    throw new Error(
      `Provisioning für ${email} nicht überprüfbar: app_users-Lesen meldete "${verifyError.message}".`
    );
  }
  if (!verified) {
    throw new Error(
      `Provisioning für ${email} fehlgeschlagen: kein app_users-Datensatz zu ${userId}. ` +
        "Der Trigger handle_new_user() auf auth.users hat keine Zeile angelegt — " +
        "sind alle Migrationen im Projekt eingespielt?"
    );
  }
  if (
    verified.role !== role ||
    verified.account_status !== accountStatus ||
    verified.preferred_locale !== locale
  ) {
    throw new Error(
      `Provisioning für ${email} wurde nicht wirksam. Erwartet: role=${role}, ` +
        `account_status=${accountStatus}, preferred_locale=${locale}. ` +
        `Vorgefunden: role=${verified.role}, account_status=${verified.account_status}, ` +
        `preferred_locale=${verified.preferred_locale}.`
    );
  }
}

/**
 * Creates (or reuses) a confirmed auth user with the given role/status and
 * guarantees the app_users row matches — both paths verify the result and
 * throw a named error if provisioning did not take effect.
 * Passwords are generated per run and returned to the caller; they are
 * never logged here.
 */
export async function ensureUser(
  service: SupabaseClient,
  email: string,
  role: ProvisionRole,
  accountStatus: ProvisionStatus,
  locale: string
): Promise<DevUser> {
  const password = randomPassword();

  const { data: existing } = await service
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const { error: passwordError } = await service.auth.admin.updateUserById(
      existing.id,
      { password }
    );
    if (passwordError) {
      throw new Error(
        `Passwort für bestehenden Nutzer ${email} konnte nicht gesetzt werden: ${passwordError.message}`
      );
    }
    await applyAccountState(
      service,
      existing.id,
      email,
      role,
      accountStatus,
      locale
    );
    return { id: existing.id, email, password };
  }

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      norav_role: role,
      norav_account_status: accountStatus,
      norav_locale: locale,
    },
  });
  if (error || !data.user) {
    throw new Error(
      `Could not create user ${email}: ${error?.message}` +
        (error?.message?.toLowerCase().includes("already")
          ? " (Das Auth-Konto existiert, aber es gibt keinen passenden app_users-Datensatz — " +
            "inkonsistenter Zustand, bitte den Nutzer in Supabase Auth entfernen.)"
          : "")
    );
  }

  // The trigger has created the row with safe defaults by now; state the
  // intended role/status/locale explicitly and verify it took effect.
  await applyAccountState(service, data.user.id, email, role, accountStatus, locale);

  return { id: data.user.id, email, password };
}
