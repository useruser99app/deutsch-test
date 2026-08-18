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

/**
 * Creates (or reuses) a confirmed auth user with the given role/status.
 * Passwords are generated per run and printed — nothing is stored in the repo.
 */
export async function ensureUser(
  service: SupabaseClient,
  email: string,
  role: "admin" | "candidate" | "employer",
  accountStatus: "invited" | "active" | "suspended" | "pending_verification",
  locale: string
): Promise<DevUser> {
  const password = randomPassword();

  const { data: existing } = await service
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await service.auth.admin.updateUserById(existing.id, { password });
    await service
      .from("app_users")
      .update({ role, account_status: accountStatus, preferred_locale: locale })
      .eq("id", existing.id);
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
    throw new Error(`Could not create user ${email}: ${error?.message}`);
  }
  return { id: data.user.id, email, password };
}
