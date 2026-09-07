/* Shared helpers for CLI scripts (seed-dev, test-workflow).
 * Credentials come exclusively from environment variables / .env.local —
 * never from the repository. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { provisionAccount } from "../src/lib/provisioning";
import type { AccountStatus, AppRole, LocaleCode } from "../src/lib/domain";
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

/**
 * Creates (or reuses) a confirmed auth user with the given role/status and
 * guarantees the app_users row matches, using the same provisionAccount()
 * helper as the production invite flow — both paths verify the result and
 * throw a named error if provisioning did not take effect.
 * Passwords are generated per run and returned to the caller; they are
 * never logged here.
 */
export async function ensureUser(
  service: SupabaseClient,
  email: string,
  role: AppRole,
  accountStatus: AccountStatus,
  locale: LocaleCode
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
    await provisionAccount(service, {
      userId: existing.id,
      email,
      role,
      accountStatus,
      locale,
    });
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
  // intended role/status/locale explicitly and verify it took effect. This
  // is the same helper the production invite flow uses.
  await provisionAccount(service, {
    userId: data.user.id,
    email,
    role,
    accountStatus,
    locale,
  });

  return { id: data.user.id, email, password };
}
