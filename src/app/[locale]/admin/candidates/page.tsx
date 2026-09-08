import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadCandidateList } from "@/lib/admin-data";
import {
  accountStatuses,
  candidateTypes,
  germanLevels,
  profileStatuses,
} from "@/lib/domain";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import CandidateIdentity, { trackClass } from "@/components/ui/CandidateIdentity";
import { buttonClass, controlClass } from "@/components/ui/button";
import CreateCandidateForm from "@/components/CreateCandidateForm";

interface SearchParams {
  q?: string;
  candidateType?: string;
  germanLevel?: string;
  profileStatus?: string;
  accountStatus?: string;
  pendingOnly?: string;
  create?: string;
}

/** Keeps only values that belong to the canonical enum (§16). */
function pickFilter(values: readonly string[], raw?: string): string | undefined {
  return raw && values.includes(raw) ? raw : undefined;
}

export default async function AdminCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.candidates");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");
  const tStatus = await getTranslations("status");

  const filters = {
    q: sp.q?.trim() || undefined,
    candidateType: pickFilter(candidateTypes, sp.candidateType),
    germanLevel: pickFilter(germanLevels, sp.germanLevel),
    profileStatus: pickFilter(profileStatuses, sp.profileStatus),
    accountStatus: pickFilter(accountStatuses, sp.accountStatus),
    pendingOnly: sp.pendingOnly === "1",
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const { rows, pendingChanges, pendingDocuments, truncated } =
    await loadCandidateList(supabase, filters);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("resultCount", { count: rows.length })}
        actions={
          <Link
            href="/admin/candidates?create=1#create"
            className={buttonClass("primary", "md")}
          >
            {t("createShort")}
          </Link>
        }
      />

      {/* Search leads; the narrower filters sit beneath it. */}
      <form method="get" className="mb-6">
        <div className="rounded-lg border border-hairline bg-surface p-4 shadow-panel">
          <label className="t-label mb-1.5 block" htmlFor="q">
            {t("searchLabel")}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={t("searchPlaceholder")}
              className={`${controlClass} sm:flex-1`}
            />
            <button type="submit" className={buttonClass("primary", "md")}>
              {t("applyFilters")}
            </button>
            {hasFilters && (
              <Link
                href="/admin/candidates"
                className={buttonClass("secondary", "md")}
              >
                {t("resetFilters")}
              </Link>
            )}
          </div>

          <div className="mt-4 grid gap-3 border-t border-hairline pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="t-label mb-1.5 block" htmlFor="candidateType">
                {tFields("candidate_type")}
              </label>
              <select
                id="candidateType"
                name="candidateType"
                defaultValue={filters.candidateType ?? ""}
                className={controlClass}
              >
                <option value="">{t("filterAll")}</option>
                {candidateTypes.map((type) => (
                  <option key={type} value={type}>
                    {tEnums(`candidateType.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="t-label mb-1.5 block" htmlFor="germanLevel">
                {tFields("german_level")}
              </label>
              <select
                id="germanLevel"
                name="germanLevel"
                defaultValue={filters.germanLevel ?? ""}
                className={controlClass}
              >
                <option value="">{t("filterAll")}</option>
                {germanLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="t-label mb-1.5 block" htmlFor="profileStatus">
                {tFields("profile_status")}
              </label>
              <select
                id="profileStatus"
                name="profileStatus"
                defaultValue={filters.profileStatus ?? ""}
                className={controlClass}
              >
                <option value="">{t("filterAll")}</option>
                {profileStatuses.map((status) => (
                  <option key={status} value={status}>
                    {tStatus(status)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="t-label mb-1.5 block" htmlFor="accountStatus">
                {t("accountStatus")}
              </label>
              <select
                id="accountStatus"
                name="accountStatus"
                defaultValue={filters.accountStatus ?? ""}
                className={controlClass}
              >
                <option value="">{t("filterAll")}</option>
                {accountStatuses.map((status) => (
                  <option key={status} value={status}>
                    {tStatus(status)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2 lg:col-span-4">
              <input
                type="checkbox"
                name="pendingOnly"
                value="1"
                defaultChecked={filters.pendingOnly}
                className="h-4 w-4 rounded border-hairline text-accent"
              />
              {t("pendingOnly")}
            </label>
          </div>
        </div>
      </form>

      {truncated && (
        <p className="mb-4 rounded-md border border-attention/30 bg-attention-soft px-4 py-2.5 text-sm text-attention">
          {t("truncated")}
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState message={hasFilters ? t("noResults") : t("noCandidates")} />
      ) : (
        <>
          {/* Cards below xl — a wide table is unusable on narrow screens. */}
          <ul className="space-y-3 xl:hidden">
            {rows.map((row) => {
              const changes = pendingChanges.get(row.id) ?? 0;
              const documents = pendingDocuments.get(row.id) ?? 0;
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-hairline bg-surface p-4 shadow-panel"
                >
                  <CandidateIdentity
                    candidate={row}
                    candidateId={row.id}
                    secondary={row.email}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                      {tFields("german_level")} {row.german_level}
                    </span>
                    {row.candidate_profiles && (
                      <StatusBadge
                        status={row.candidate_profiles.profile_status}
                        size="sm"
                      />
                    )}
                    {row.app_users && (
                      <StatusBadge
                        status={row.app_users.account_status}
                        size="sm"
                      />
                    )}
                  </div>
                  {(changes > 0 || documents > 0) && (
                    <p className="mt-2 text-xs font-medium text-attention">
                      {t("pendingSummary", { changes, documents })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-hidden rounded-lg border border-hairline bg-surface shadow-panel xl:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline bg-ink-50">
                  <th className="t-label px-5 py-3 text-start">{t("name")}</th>
                  <th className="t-label px-3 py-3 text-start">{t("type")}</th>
                  <th className="t-label px-3 py-3 text-start">
                    {t("germanLevel")}
                  </th>
                  <th className="t-label px-3 py-3 text-start">
                    {tFields("availability_date")}
                  </th>
                  <th className="t-label px-3 py-3 text-start">
                    {tFields("profile_status")}
                  </th>
                  <th className="t-label px-3 py-3 text-start">
                    {t("accountStatus")}
                  </th>
                  <th className="t-label px-5 py-3 text-start">
                    {t("pendingColumn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row) => {
                  const changes = pendingChanges.get(row.id) ?? 0;
                  const documents = pendingDocuments.get(row.id) ?? 0;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-ink-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/candidates/${row.id}`}
                          className="text-sm font-semibold text-ink-900 hover:text-accent hover:underline"
                        >
                          {row.first_name} {row.last_name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/candidates/${row.id}`}
                            className="t-meta font-mono hover:text-accent hover:underline"
                          >
                            {row.candidate_code}
                          </Link>
                          <span className="t-meta truncate">{row.email}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${trackClass(
                            row.candidate_type
                          )}`}
                        >
                          {tEnums(`candidateType.${row.candidate_type}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-800">
                        {row.german_level}
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-600">
                        {row.availability_date ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {row.candidate_profiles ? (
                          <StatusBadge
                            status={row.candidate_profiles.profile_status}
                            size="sm"
                          />
                        ) : (
                          <span className="t-meta">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {row.app_users ? (
                          <StatusBadge
                            status={row.app_users.account_status}
                            size="sm"
                          />
                        ) : (
                          <span className="t-meta">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {changes === 0 && documents === 0 ? (
                          <span className="t-meta">—</span>
                        ) : (
                          <span className="text-sm font-semibold tabular-nums text-attention">
                            {changes} / {documents}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <details
        id="create"
        open={sp.create === "1"}
        className="mt-6 scroll-mt-6 rounded-lg border border-hairline bg-surface shadow-panel"
      >
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-ink-800">
          {t("create")}
        </summary>
        <div className="border-t border-hairline p-5">
          <CreateCandidateForm />
        </div>
      </details>
    </>
  );
}
