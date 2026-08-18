import { getTranslations } from "next-intl/server";
import { updatePassword } from "@/lib/actions/auth";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">{title}</h1>
        {description && (
          <p className="mb-4 text-sm text-gray-600">{description}</p>
        )}
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "too_short" ? t("tooShort") : t("error")}
          </p>
        )}
        <form action={updatePassword} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="from" value={from} />
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">{t("password")}</span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
          >
            {t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
