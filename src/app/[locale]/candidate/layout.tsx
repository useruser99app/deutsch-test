import { getTranslations, setRequestLocale } from "next-intl/server";
import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export default async function CandidateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireRole(locale, "candidate");
  const t = await getTranslations("nav");

  return (
    <AppShell
      locale={locale}
      email={profile.email}
      nav={[
        { href: "/candidate", label: t("dashboard") },
        { href: "/candidate/changes", label: t("changes") },
        { href: "/candidate/documents", label: t("documents") },
        { href: "/candidate/reviews", label: t("reviews") },
      ]}
    >
      {children}
    </AppShell>
  );
}
