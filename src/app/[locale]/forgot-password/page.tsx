import { getTranslations, setRequestLocale } from "next-intl/server";
import { requestPasswordReset } from "@/lib/actions/auth";
import AuthShell from "@/components/shell/AuthShell";
import { buttonClass, controlClass } from "@/components/ui/button";

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { locale } = await params;
  const { sent } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth.forgot");

  return (
    <AuthShell title={t("title")} description={t("description")}>
      {sent && (
        <p
          role="status"
          className="mb-4 rounded-md border border-positive/25 bg-positive-soft px-3 py-2 text-sm text-positive"
        >
          {t("sent")}
        </p>
      )}
      <form action={requestPasswordReset} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          aria-label={t("title")}
          className={controlClass}
        />
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>
          {t("submit")}
        </button>
      </form>
    </AuthShell>
  );
}
