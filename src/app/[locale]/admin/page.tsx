import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";

async function StatCard({
  label,
  value,
  href,
  openLabel,
}: {
  label: string;
  value: number;
  href: string;
  openLabel: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="my-1 text-3xl font-semibold">{value}</p>
      <Link href={href} className="text-sm text-blue-700 underline">
        {openLabel}
      </Link>
    </div>
  );
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");
  const t = await getTranslations("admin.dashboard");

  const [changes, documents, candidates, companies] = await Promise.all([
    supabase
      .from("candidate_change_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review"),
    supabase.from("candidates").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("pendingChanges")}
          value={changes.count ?? 0}
          href="/admin/review"
          openLabel={t("open")}
        />
        <StatCard
          label={t("pendingDocuments")}
          value={documents.count ?? 0}
          href="/admin/documents"
          openLabel={t("open")}
        />
        <StatCard
          label={t("candidates")}
          value={candidates.count ?? 0}
          href="/admin/candidates"
          openLabel={t("open")}
        />
        <StatCard
          label={t("companies")}
          value={companies.count ?? 0}
          href="/admin/companies"
          openLabel={t("open")}
        />
      </div>
    </div>
  );
}
