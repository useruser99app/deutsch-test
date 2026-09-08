import { getTranslations, setRequestLocale } from "next-intl/server";
import AdminShell from "@/components/shell/AdminShell";
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
  const [changes, documents] = await Promise.all([
    supabase
      .from("candidate_change_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review"),
  ]);

  return (
    <AdminShell
      locale={locale}
      email={profile.email}
      workspaceLabel={t("adminWorkspace")}
      groups={[
        {
          label: t("groupOperations"),
          items: [
            { href: "/admin", label: t("dashboard") },
            {
              href: "/admin/review",
              label: t("review"),
              badge: changes.count ?? 0,
            },
            {
              href: "/admin/documents",
              label: t("adminDocuments"),
              badge: documents.count ?? 0,
            },
          ],
        },
        {
          label: t("groupManagement"),
          items: [
            { href: "/admin/candidates", label: t("candidates") },
            { href: "/admin/companies", label: t("companies") },
          ],
        },
      ]}
    >
      {children}
    </AdminShell>
  );
}
