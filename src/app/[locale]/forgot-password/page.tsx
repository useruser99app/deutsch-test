import { getTranslations, setRequestLocale } from "next-intl/server";
import { requestPasswordReset } from "@/lib/actions/auth";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
        <p className="mb-4 text-sm text-gray-600">{t("description")}</p>
        {sent && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
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
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
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
