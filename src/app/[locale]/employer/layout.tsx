import { getTranslations, setRequestLocale } from "next-intl/server";
import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export default async function EmployerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireRole(locale, "employer");
  const t = await getTranslations("nav");

  return (
    <AppShell
      locale={locale}
      email={profile.email}
      nav={[{ href: "/employer", label: t("dashboard") }]}
    >
      {children}
    </AppShell>
  );
}
