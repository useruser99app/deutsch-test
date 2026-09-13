import { getTranslations, setRequestLocale } from "next-intl/server";
import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { loadChangeItems } from "@/lib/candidate-data";

export default async function CandidateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, profile } = await requireRole(locale, "candidate");
  const t = await getTranslations("nav");

  // How many proposals are still with the reviewer — the one number a
  // candidate needs from every page.
  const { pending } = await loadChangeItems(supabase);

  return (
    <AppShell
      locale={locale}
      email={profile.email}
      workspaceLabel={t("candidatePortal")}
      groups={[
        {
          items: [
            { href: "/candidate", label: t("dashboard"), icon: "overview", exact: true },
            { href: "/candidate/changes", label: t("changes"), icon: "changes" },
            { href: "/candidate/documents", label: t("documents"), icon: "documents" },
            {
              href: "/candidate/reviews",
              label: t("reviews"),
              icon: "review",
              badge: pending.length,
            },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
