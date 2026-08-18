import { getTranslations, setRequestLocale } from "next-intl/server";
import { logout } from "@/lib/actions/auth";

export default async function AccountInactivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.inactive");
  const tCommon = await getTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
        <p className="mb-4 text-sm text-gray-600">{t("description")}</p>
        <form action={logout}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
          >
            {tCommon("logout")}
          </button>
        </form>
      </div>
    </div>
  );
}
