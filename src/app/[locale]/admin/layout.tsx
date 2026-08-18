import { getTranslations, setRequestLocale } from "next-intl/server";
import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireRole(locale, "admin");
  const t = await getTranslations("nav");

  return (
    <AppShell
      locale={locale}
      email={profile.email}
      nav={[
        { href: "/admin", label: t("dashboard") },
        { href: "/admin/review", label: t("review") },
        { href: "/admin/documents", label: t("adminDocuments") },
        { href: "/admin/candidates", label: t("candidates") },
        { href: "/admin/companies", label: t("companies") },
      ]}
    >
      {children}
    </AppShell>
  );
}
