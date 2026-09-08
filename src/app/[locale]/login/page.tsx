import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { login } from "@/lib/actions/auth";
import AuthShell from "@/components/shell/AuthShell";
import { buttonClass, controlClass } from "@/components/ui/button";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth.login");

  return (
    <AuthShell
      title={t("title")}
      footer={
        <Link
          href="/forgot-password"
          className="text-sm text-ink-500 hover:text-accent hover:underline"
        >
          {t("forgot")}
        </Link>
      }
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          {t("invalid")}
        </p>
      )}
      <form action={login} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="t-label mb-1.5 block" htmlFor="email">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className={controlClass}
          />
        </div>
        <div>
          <label className="t-label mb-1.5 block" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
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
