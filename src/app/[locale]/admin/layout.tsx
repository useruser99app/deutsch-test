import { getTranslations, setRequestLocale } from "next-intl/server";
import AppShell from "@/components/shell/AppShell";
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
  const { supabase, profile } = await requireRole(locale, "admin");
  const t = await getTranslations("nav");

  // Open work is visible from every admin page, not just the dashboard.
  const [changes, documents, requests] = await Promise.all([
    supabase
      .from("candidate_change_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review"),
    supabase
      .from("interest_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  return (
    <AppShell
      locale={locale}
      email={profile.email}
      workspaceLabel={t("adminWorkspace")}
      groups={[
        {
          label: t("groupOperations"),
          items: [
            {
              href: "/admin",
              label: t("dashboard"),
              icon: "overview" as const,
              exact: true,
            },
            {
              href: "/admin/review",
              label: t("review"),
              icon: "review" as const,
              badge: changes.count ?? 0,
            },
            {
              href: "/admin/documents",
              label: t("adminDocuments"),
              icon: "documents" as const,
              badge: documents.count ?? 0,
            },
            {
              href: "/admin/requests",
              label: t("adminRequests"),
              icon: "requests" as const,
              badge: requests.count ?? 0,
            },
          ],
        },
        {
          label: t("groupManagement"),
          items: [
            {
              href: "/admin/candidates",
              label: t("candidates"),
              icon: "candidates" as const,
            },
            {
              href: "/admin/companies",
              label: t("companies"),
              icon: "companies" as const,
            },
            {
              href: "/admin/jobs",
              label: t("jobs"),
              icon: "jobs" as const,
            },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
