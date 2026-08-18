import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getSessionProfile, homePathForRole } from "@/lib/auth";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionProfile();
  if (session && session.profile.account_status === "active") {
    redirect(`/${locale}${homePathForRole(session.profile.role)}`);
  }

  const t = await getTranslations("home");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="absolute end-4 top-4">
        <LocaleSwitcher />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="max-w-md text-center text-gray-600">{t("subtitle")}</p>
      <Link
        href="/login"
        className="rounded-md bg-gray-900 px-6 py-2 text-white hover:bg-gray-700"
      >
        {t("login")}
      </Link>
    </div>
  );
}
