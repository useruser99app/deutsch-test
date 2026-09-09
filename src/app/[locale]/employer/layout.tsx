import { getTranslations, setRequestLocale } from "next-intl/server";
import PortalShell from "@/components/shell/PortalShell";
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
    <PortalShell
      locale={locale}
      email={profile.email}
      workspaceLabel={t("employerPortal")}
      nav={[
        { href: "/employer", label: t("dashboard") },
        { href: "/employer/candidates", label: t("candidates") },
        {
          href: "/employer/requests",
          label: t("employerRequests"),
          badge: unread,
        },
      ]}
    >
      {children}
    </PortalShell>
  );
}
