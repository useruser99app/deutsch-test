import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadAdminOverview, loadCandidateList } from "@/lib/admin-data";
import Icon from "@/components/shell/Icon";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import CandidateIdentity from "@/components/ui/CandidateIdentity";
import DashboardCard from "@/components/dashboard/DashboardCard";
import OpsStatCard from "@/components/admin/OpsStatCard";

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
  const tNav = await getTranslations("nav");
  const format = await getFormatter();
  const now = new Date();

  const [overview, attention] = await Promise.all([
    loadAdminOverview(supabase),
    loadCandidateList(supabase, { pendingOnly: true }),
  ]);

  const queueTotal =
    overview.pendingChanges + overview.pendingDocuments + overview.newRequests;

  const byType = overview.candidatesByType;
  const typeTotal =
    byType.apprenticeship_candidate + byType.skilled_worker;

  const rows = attention.rows.slice(0, 6);

  return (
    <div data-shell="wide">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        size="display"
        actions={
          // A real figure, not a slogan: the sum of the three review
          // queues this page links to.
          <span className="hidden items-center gap-2.5 rounded-card border border-hairline-strong bg-surface px-3.5 py-2.5 shadow-card sm:inline-flex">
            <span
              aria-hidden
              className={`flex h-8 w-8 items-center justify-center rounded-control ${
                queueTotal > 0
                  ? "bg-attention-soft text-attention"
                  : "bg-positive-soft text-positive"
              }`}
            >
              <Icon name="review" className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-[13px] font-semibold leading-4 ${
                  queueTotal > 0 ? "text-attention" : "text-ink-900"
                }`}
              >
                {t("openTasks", { count: queueTotal })}
              </span>
              <span className="mt-0.5 block text-[12px] leading-4 text-ink-500">
                {t("openTasksHint")}
              </span>
            </span>
          </span>
        }
      />

      {/* ---- Counter row, same language as the request queue ------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpsStatCard
          label={t("pendingChanges")}
          hint={t("hintChanges")}
          value={overview.pendingChanges}
          href="/admin/review"
          icon="review"
          tone="attention"
        />
        <OpsStatCard
          label={t("pendingDocuments")}
          hint={t("hintDocuments")}
          value={overview.pendingDocuments}
          href="/admin/documents"
          icon="documents"
          tone="attention"
        />
        <OpsStatCard
          label={t("newRequests")}
          hint={t("hintRequests")}
          value={overview.newRequests}
          href="/admin/requests"
          icon="requests"
          tone="accent"
        />
        <OpsStatCard
          label={t("candidates")}
          hint={t("hintCandidates")}
          value={overview.candidates}
          href="/admin/candidates"
          icon="candidates"
          tone="neutral"
        />
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,68fr)_minmax(19rem,32fr)] lg:items-start lg:gap-5">
        {/* ---- Main column --------------------------------------------- */}
        <div className="space-y-5">
          <DashboardCard
            title={t("needsAttention")}
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
            {rows.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <StatusBadge status="approved" size="sm" />
                <p className="text-[13px] text-ink-600">{t("noAttention")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {rows.map((row) => {
                  const changes = attention.pendingChanges.get(row.id) ?? 0;
                  const documents = attention.pendingDocuments.get(row.id) ?? 0;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/admin/candidates/${row.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
                      >
                        <span className="min-w-0 flex-1">
                          <CandidateIdentity candidate={row} size="sm" />
                        </span>

                        {/* What is waiting, as counted work — the same
                            attention tone the queue page uses. */}
                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {changes > 0 && (
                            <span className="rounded-pill bg-attention-soft px-2 py-0.5 text-[11px] font-semibold text-attention">
                              {tCandidates("pendingChangesShort", {
                                count: changes,
                              })}
                            </span>
                          )}
                          {documents > 0 && (
                            <span className="rounded-pill bg-attention-soft px-2 py-0.5 text-[11px] font-semibold text-attention">
                              {tCandidates("pendingDocumentsShort", {
                                count: documents,
                              })}
                            </span>
                          )}
                        </span>

                        <span
                          aria-hidden
                          className="shrink-0 text-ink-300 rtl:rotate-180"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
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
              <div className="px-5 py-4">
                <EmptyState message={t("noRecentChanges")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {overview.recentChanges.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/admin/candidates/${item.candidate_id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
                    >
                      <span className="min-w-0 flex-1">
                        <CandidateIdentity candidate={item.candidates} size="sm" />
                      </span>
                      <span className="min-w-0 shrink-0 text-end">
                        <span className="block text-[13px] font-medium leading-5 text-ink-800">
                          {tFields.has(item.field_key)
                            ? tFields(item.field_key)
                            : item.field_key}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-4 text-ink-400">
                          {format.relativeTime(new Date(item.created_at), now)}
                        </span>
                      </span>
                      <StatusBadge status={item.status} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
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
              <div className="px-5 py-4">
                <EmptyState message={t("noRecentDocuments")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {overview.recentDocuments.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/admin/candidates/${doc.candidate_id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
                    >
                      <span className="min-w-0 flex-1">
                        <CandidateIdentity candidate={doc.candidates} size="sm" />
                      </span>
                      <span className="min-w-0 shrink-0 text-end">
                        <span className="block text-[13px] font-medium leading-5 text-ink-800">
                          {tEnums(`documentType.${doc.document_type}`)}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-4 text-ink-400">
                          {format.relativeTime(new Date(doc.uploaded_at), now)}
                        </span>
                      </span>
                      <StatusBadge status={doc.verification_status} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>

        {/* ---- Secondary column ---------------------------------------- */}
        <div className="mt-5 space-y-5 lg:sticky lg:top-5 lg:mt-0">
          <DashboardCard title={t("candidatesByType")}>
            {/* Two real counts and the share they make of their own sum.
                Nothing is modelled or estimated beyond that. */}
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-ink-500">
                {t("totalShare")}
              </span>
              <span className="text-[15px] font-semibold tabular-nums text-ink-900">
                {typeTotal}
              </span>
            </div>

            {typeTotal > 0 && (
              <div
                aria-hidden
                className="mt-2 flex h-2 overflow-hidden rounded-pill bg-ink-100"
              >
                <span
                  className="bg-track-apprenticeship"
                  style={{
                    width: `${
                      (byType.apprenticeship_candidate / typeTotal) * 100
                    }%`,
                  }}
                />
                <span
                  className="bg-track-skilled"
                  style={{
                    width: `${(byType.skilled_worker / typeTotal) * 100}%`,
                  }}
                />
              </div>
            )}

            <ul className="mt-3 space-y-1">
              {(
                [
                  ["apprenticeship_candidate", "bg-track-apprenticeship"],
                  ["skilled_worker", "bg-track-skilled"],
                ] as const
              ).map(([type, dot]) => (
                <li key={type}>
                  <Link
                    href={`/admin/candidates?candidateType=${type}`}
                    className="flex items-center gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-sunken"
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-pill ${dot}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                      {tEnums(`candidateType.${type}`)}
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink-900">
                      {byType[type]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>

          <DashboardCard title={t("masterData")}>
            <ul className="space-y-1">
              {/* Only what is not already a counter above. The candidate
                  total is the fourth KPI card, so repeating it here would
                  say the same number twice on one screen. */}
              {(
                [
                  ["/admin/companies", tNav("companies"), overview.companies, "companies"],
                ] as const
              ).map(([href, label, value, icon]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-sunken"
                  >
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-ink-100 text-ink-500"
                    >
                      <Icon name={icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                      {label}
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink-900">
                      {value}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
