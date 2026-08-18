import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, AppUser } from "@/lib/domain";

export interface SessionProfile {
  supabase: SupabaseClient;
  user: User;
  profile: AppUser;
}

/** Returns the authenticated user plus their app_users row, or null. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, email, role, account_status, preferred_locale")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { supabase, user, profile: profile as AppUser };
}

export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "employer":
      return "/employer";
    default:
      return "/candidate";
  }
}

/**
 * Server-side gate for the protected areas. This complements — never
 * replaces — the RLS policies in the database.
 */
export async function requireRole(
  locale: string,
  role: AppRole
): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect(`/${locale}/login`);

  const { profile } = session;
  if (profile.account_status === "invited") {
    redirect(`/${locale}/set-password`);
  }
  if (profile.account_status !== "active") {
    redirect(`/${locale}/account-inactive`);
  }
  if (profile.role !== role) {
    redirect(`/${locale}${homePathForRole(profile.role)}`);
  }
  return session;
}
