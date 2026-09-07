import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountStatus, AppRole, LocaleCode } from "@/lib/domain";

/**
 * Server-side account provisioning — the single place that decides what a
 * new account's role, account_status and locale are in public.app_users.
 *
 * Why this exists instead of relying on handle_new_user():
 * The trigger creates every auth user with SAFE DEFAULTS (candidate /
 * invited) and reads the norav_* keys from the metadata present at INSERT
 * time on auth.users. That metadata is not reliably visible then, so the
 * defaults stand — an invited employer would silently land as 'candidate'.
 * Provisioning therefore states the intended values explicitly and verifies
 * them, instead of hoping the trigger picked them up.
 *
 * Privilege boundary: this function only performs the writes the client it
 * is handed is allowed to perform. Callers MUST pass a service-role client
 * (see lib/supabase/admin.ts, which is server-only) or an active admin's
 * session. Under an ordinary user session the write is refused by RLS —
 * app_users has no self-write policy — so this can never become a path for
 * a user to raise their own role or status.
 */
export interface AccountProvisioning {
  userId: string;
  email: string;
  role: AppRole;
  accountStatus: AccountStatus;
  locale: LocaleCode;
}

export class ProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisioningError";
  }
}

/**
 * Writes the intended account state and reads it back to confirm it took
 * effect. Throws ProvisioningError if the row is missing, the write was
 * refused, or any of the three fields does not match.
 */
export async function provisionAccount(
  client: SupabaseClient,
  { userId, email, role, accountStatus, locale }: AccountProvisioning
): Promise<void> {
  const { error: updateError } = await client
    .from("app_users")
    .update({
      role,
      account_status: accountStatus,
      preferred_locale: locale,
    })
    .eq("id", userId);
  if (updateError) {
    throw new ProvisioningError(
      `Provisioning für ${email} fehlgeschlagen: app_users-Update meldete "${updateError.message}".`
    );
  }

  const { data: verified, error: verifyError } = await client
    .from("app_users")
    .select("id, role, account_status, preferred_locale")
    .eq("id", userId)
    .maybeSingle();
  if (verifyError) {
    throw new ProvisioningError(
      `Provisioning für ${email} nicht überprüfbar: app_users-Lesen meldete "${verifyError.message}".`
    );
  }
  if (!verified) {
    throw new ProvisioningError(
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
    throw new ProvisioningError(
      `Provisioning für ${email} wurde nicht wirksam. Erwartet: role=${role}, ` +
        `account_status=${accountStatus}, preferred_locale=${locale}. ` +
        `Vorgefunden: role=${verified.role}, account_status=${verified.account_status}, ` +
        `preferred_locale=${verified.preferred_locale}.`
    );
  }
}
