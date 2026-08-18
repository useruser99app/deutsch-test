"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, homePathForRole } from "@/lib/auth";
import { locales } from "@/i18n/routing";

function safeLocale(value: unknown): string {
  return locales.includes(value as (typeof locales)[number])
    ? (value as string)
    : "de";
}

export async function login(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/${locale}/login?error=invalid`);

  const session = await getSessionProfile();
  if (!session) redirect(`/${locale}/login?error=invalid`);

  const { profile } = session;
  // The user's stored UI locale wins after login (candidate portal
  // prioritizes fr/ar; employers/admins default to de).
  const target = safeLocale(profile.preferred_locale);

  if (profile.account_status === "invited") {
    redirect(`/${target}/set-password`);
  }
  if (profile.account_status !== "active") {
    redirect(`/${target}/account-inactive`);
  }
  redirect(`/${target}${homePathForRole(profile.role)}`);
}

export async function logout(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}

export async function requestPasswordReset(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${site}/auth/callback?next=/${locale}/reset-password`,
    });
  }
  // Do not leak whether the account exists.
  redirect(`/${locale}/forgot-password?sent=1`);
}

/**
 * Used by both /set-password (invite completion, §3A) and /reset-password.
 * After an invited user sets their password, complete_invite() moves the
 * account from 'invited' to 'active' at database level.
 */
export async function updatePassword(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const from = formData.get("from") === "reset" ? "reset-password" : "set-password";
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    redirect(`/${locale}/${from}?error=too_short`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/${locale}/${from}?error=failed`);

  await supabase.rpc("complete_invite");

  const session = await getSessionProfile();
  if (!session || session.profile.account_status !== "active") {
    redirect(`/${locale}/account-inactive`);
  }
  redirect(`/${locale}${homePathForRole(session.profile.role)}`);
}

/** Persists the user's UI locale preference (SECURITY DEFINER RPC). */
export async function persistPreferredLocale(locale: string) {
  const target = safeLocale(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.rpc("set_preferred_locale", { p_locale: target });
  }
}
