import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getSessionProfile, homePathForRole } from "@/lib/auth";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import BrandMark from "@/components/shell/BrandMark";
import { buttonClass } from "@/components/ui/button";

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
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-5 sm:px-8">
        <BrandMark tone="dark" />
        <LocaleSwitcher />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="t-body mx-auto mt-4 max-w-md text-base">
            {t("subtitle")}
          </p>
          <Link href="/login" className={buttonClass("primary", "md", "mt-8")}>
            {t("login")}
          </Link>
        </div>
      </main>
    </div>
  );
}
