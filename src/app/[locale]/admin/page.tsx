import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadAdminOverview, loadCandidateList } from "@/lib/admin-data";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import CandidateIdentity from "@/components/ui/CandidateIdentity";

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
  const tCandidates = await getTranslations("admin.candidates");

  const [overview, attention] = await Promise.all([
    loadAdminOverview(supabase),
    loadCandidateList(supabase, { pendingOnly: true }),
  ]);

  const queueTotal = overview.pendingChanges + overview.pendingDocuments;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          queueTotal > 0 ? t("queueSummary", { count: queueTotal }) : t("queueEmpty")
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Needs attention — the candidates the queues actually belong to. */}
      <div className="mt-6">
        <Panel
          title={t("needsAttention")}
          description={t("needsAttentionDescription")}
          action={
            <Link
              href="/admin/candidates?pendingOnly=1"
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("open")}
            </Link>
          }
          bleed
        >
          {attention.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noAttention")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {attention.rows.slice(0, 6).map((row) => {
                const changes = attention.pendingChanges.get(row.id) ?? 0;
                const documents = attention.pendingDocuments.get(row.id) ?? 0;
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50"
                  >
                    <CandidateIdentity
                      candidate={row}
                      candidateId={row.id}
                      size="sm"
                    />
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {changes > 0 && (
                        <span className="font-medium text-attention">
                          {tCandidates("pendingChangesShort", { count: changes })}
                        </span>
                      )}
                      {documents > 0 && (
                        <span className="font-medium text-attention">
                          {tCandidates("pendingDocumentsShort", {
                            count: documents,
                          })}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title={t("recentChanges")}
          action={
            <Link
              href="/admin/review"
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("openQueue")}
            </Link>
          }
          bleed
        >
          {overview.recentChanges.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noRecentChanges")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {overview.recentChanges.map((item) => (
                <li key={item.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CandidateIdentity
                      candidate={item.candidates}
                      candidateId={item.candidate_id}
                      size="sm"
                    />
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <p className="t-meta mt-1.5">
                    {tFields.has(item.field_key)
                      ? tFields(item.field_key)
                      : item.field_key}{" "}
                    · {item.created_at.slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t("recentDocuments")}
          action={
            <Link
              href="/admin/documents"
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("openQueue")}
            </Link>
          }
          bleed
        >
          {overview.recentDocuments.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noRecentDocuments")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {overview.recentDocuments.map((doc) => (
                <li key={doc.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CandidateIdentity
                      candidate={doc.candidates}
                      candidateId={doc.candidate_id}
                      size="sm"
                    />
                    <StatusBadge status={doc.verification_status} size="sm" />
                  </div>
                  <p className="t-meta mt-1.5">
                    {tEnums(`documentType.${doc.document_type}`)} ·{" "}
                    {doc.uploaded_at.slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={t("candidatesByType")} bleed>
          <ul className="divide-y divide-hairline">
            {Object.entries(overview.candidatesByType).map(([type, count]) => (
              <li key={type}>
                <Link
                  href={`/admin/candidates?candidateType=${type}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-ink-50"
                >
                  <span className="t-value">
                    {tEnums(`candidateType.${type}`)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-ink-900">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
