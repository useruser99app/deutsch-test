import { getTranslations, setRequestLocale } from "next-intl/server";
import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";

export default async function EmployerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, profile } = await requireRole(locale, "employer");
  const t = await getTranslations("nav");

  // The badge counts UNSEEN UPDATES, not the total number of requests.
  const unread = await countUnreadNotifications(supabase);

  return (
    <AppShell
      locale={locale}
      email={profile.email}
      workspaceLabel={t("employerPortal")}
      groups={[
        {
          // Only routes that exist. No placeholder sections.
          items: [
            { href: "/employer", label: t("dashboard"), icon: "overview", exact: true },
            { href: "/employer/candidates", label: t("candidates"), icon: "discover" },
            { href: "/employer/jobs", label: t("jobs"), icon: "jobs" },
            {
              href: "/employer/requests",
              label: t("employerRequests"),
              icon: "requests",
              badge: unread,
            },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
