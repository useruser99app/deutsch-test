import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadAdminOverview } from "@/lib/admin-data";
import SectionCard from "@/components/candidate/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/admin/StatCard";
import CandidateRef from "@/components/admin/CandidateRef";

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.dashboard");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");
  const overview = await loadAdminOverview(supabase);

  const queueTotal = overview.pendingChanges + overview.pendingDocuments;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {queueTotal > 0
            ? t("queueSummary", { count: queueTotal })
            : t("queueEmpty")}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("pendingChanges")}
          value={overview.pendingChanges}
          href="/admin/review"
          actionLabel={t("openQueue")}
          emphasis
        />
        <StatCard
          label={t("pendingDocuments")}
          value={overview.pendingDocuments}
          href="/admin/documents"
          actionLabel={t("openQueue")}
          emphasis
        />
        <StatCard
          label={t("candidates")}
          value={overview.candidates}
          href="/admin/candidates"
          actionLabel={t("open")}
        />
        <StatCard
          label={t("companies")}
          value={overview.companies}
          href="/admin/companies"
          actionLabel={t("open")}
        />
      </div>

      <SectionCard title={t("candidatesByType")}>
        <ul className="divide-y divide-gray-100">
          {Object.entries(overview.candidatesByType).map(([type, count]) => (
            <li
              key={type}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <Link
                href={`/admin/candidates?candidateType=${type}`}
                className="text-gray-700 hover:underline"
              >
                {tEnums(`candidateType.${type}`)}
              </Link>
              <span className="font-semibold text-gray-900">{count}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t("recentChanges")}
          action={
            <Link
              href="/admin/review"
              className="text-sm font-medium text-blue-700 underline"
            >
              {t("openQueue")}
            </Link>
          }
        >
          {overview.recentChanges.length === 0 ? (
            <p className="py-2 text-sm text-gray-600">{t("noRecentChanges")}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {overview.recentChanges.map((item) => (
                <li key={item.id} className="py-2.5">
                  <CandidateRef
                    candidate={item.candidates}
                    candidateId={item.candidate_id}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-700">
                      {tFields.has(item.field_key)
                        ? tFields(item.field_key)
                        : item.field_key}
                    </span>
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-500">
                      {item.created_at.slice(0, 10)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t("recentDocuments")}
          action={
            <Link
              href="/admin/documents"
              className="text-sm font-medium text-blue-700 underline"
            >
              {t("openQueue")}
            </Link>
          }
        >
          {overview.recentDocuments.length === 0 ? (
            <p className="py-2 text-sm text-gray-600">
              {t("noRecentDocuments")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {overview.recentDocuments.map((doc) => (
                <li key={doc.id} className="py-2.5">
                  <CandidateRef
                    candidate={doc.candidates}
                    candidateId={doc.candidate_id}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-700">
                      {tEnums(`documentType.${doc.document_type}`)}
                    </span>
                    <StatusBadge status={doc.verification_status} />
                    <span className="text-xs text-gray-500">
                      {doc.uploaded_at.slice(0, 10)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
