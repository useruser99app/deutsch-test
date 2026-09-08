import { getTranslations, setRequestLocale } from "next-intl/server";
import { logout } from "@/lib/actions/auth";
import AuthShell from "@/components/shell/AuthShell";
import { buttonClass } from "@/components/ui/button";

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
    <AuthShell title={t("title")} description={t("description")}>
      <form action={logout}>
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className={buttonClass("secondary", "md", "w-full")}
        >
          {tCommon("logout")}
        </button>
      </form>
    </AuthShell>
  );
}
