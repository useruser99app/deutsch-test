import { getTranslations } from "next-intl/server";
import { updatePassword } from "@/lib/actions/auth";
import AuthShell from "@/components/shell/AuthShell";
import { buttonClass, controlClass } from "@/components/ui/button";

/**
 * Shared password form for /set-password (invite completion, §3A) and
 * /reset-password.
 */
export default async function PasswordForm({
  locale,
  from,
  title,
  description,
  error,
}: {
  locale: string;
  from: "set" | "reset";
  title: string;
  description?: string;
  error?: string;
}) {
  const t = await getTranslations("auth.reset");

  return (
    <AuthShell title={title} description={description}>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          {error === "too_short" ? t("tooShort") : t("error")}
        </p>
      )}
      <form action={updatePassword} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="from" value={from} />
        <div>
          <label className="t-label mb-1.5 block" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={controlClass}
          />
        </div>
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>
          {t("submit")}
        </button>
      </form>
    </AuthShell>
  );
}
