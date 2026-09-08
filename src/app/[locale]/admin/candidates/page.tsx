import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadCandidateList, type CandidateListRow } from "@/lib/admin-data";
import {
  accountStatuses,
  candidateTypes,
  germanLevels,
  profileStatuses,
} from "@/lib/domain";
import StatusBadge from "@/components/StatusBadge";
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
  const hasFilters =
    Boolean(filters.q) ||
    Boolean(filters.candidateType) ||
    Boolean(filters.germanLevel) ||
    Boolean(filters.profileStatus) ||
    Boolean(filters.accountStatus) ||
    filters.pendingOnly;

  const { rows, pendingChanges, pendingDocuments, truncated } =
    await loadCandidateList(supabase, filters);

  const fieldClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm";
  const labelClass = "mb-1 block text-xs font-medium text-gray-600";

  const pendingFor = (row: CandidateListRow) => ({
    changes: pendingChanges.get(row.id) ?? 0,
    documents: pendingDocuments.get(row.id) ?? 0,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <span className="text-sm text-gray-600">
          {t("resultCount", { count: rows.length })}
        </span>
      </header>

      {/* Server-side search and filtering via a plain GET form. */}
      <form
        method="get"
        className="rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label className={labelClass} htmlFor="q">
              {t("searchLabel")}
            </label>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={t("searchPlaceholder")}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="candidateType">
              {tFields("candidate_type")}
            </label>
            <select
              id="candidateType"
              name="candidateType"
              defaultValue={filters.candidateType ?? ""}
              className={fieldClass}
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
            <label className={labelClass} htmlFor="germanLevel">
              {tFields("german_level")}
            </label>
            <select
              id="germanLevel"
              name="germanLevel"
              defaultValue={filters.germanLevel ?? ""}
              className={fieldClass}
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
            <label className={labelClass} htmlFor="profileStatus">
              {tFields("profile_status")}
            </label>
            <select
              id="profileStatus"
              name="profileStatus"
              defaultValue={filters.profileStatus ?? ""}
              className={fieldClass}
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
            <label className={labelClass} htmlFor="accountStatus">
              {t("accountStatus")}
            </label>
            <select
              id="accountStatus"
              name="accountStatus"
              defaultValue={filters.accountStatus ?? ""}
              className={fieldClass}
            >
              <option value="">{t("filterAll")}</option>
              {accountStatuses.map((status) => (
                <option key={status} value={status}>
                  {tStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="pendingOnly"
                value="1"
                defaultChecked={filters.pendingOnly}
                className="h-4 w-4"
              />
              {t("pendingOnly")}
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            {t("applyFilters")}
          </button>
          {hasFilters && (
            <Link
              href="/admin/candidates"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("resetFilters")}
            </Link>
          )}
        </div>
      </form>

      {truncated && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {t("truncated")}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          {hasFilters ? t("noResults") : t("noCandidates")}
        </p>
      ) : (
        <>
          {/* Cards on small screens — a wide table would be unusable there. */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((row) => {
              const pending = pendingFor(row);
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <Link
                    href={`/admin/candidates/${row.id}`}
                    className="font-mono text-sm font-semibold text-gray-900 hover:underline"
                  >
                    {row.candidate_code}
                  </Link>
                  <p className="mt-0.5 text-sm text-gray-800">
                    {row.first_name} {row.last_name}
                  </p>
                  <p className="break-all text-xs text-gray-500">{row.email}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        row.candidate_type === "apprenticeship_candidate"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {tEnums(`candidateType.${row.candidate_type}`)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                      {row.german_level}
                    </span>
                    {row.candidate_profiles && (
                      <StatusBadge
                        status={row.candidate_profiles.profile_status}
                      />
                    )}
                    {row.app_users && (
                      <StatusBadge status={row.app_users.account_status} />
                    )}
                  </div>

                  {(pending.changes > 0 || pending.documents > 0) && (
                    <p className="mt-2 text-xs font-medium text-amber-800">
                      {t("pendingSummary", {
                        changes: pending.changes,
                        documents: pending.documents,
                      })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white lg:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("code")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("name")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("type")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("germanLevel")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {tFields("availability_date")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {tFields("profile_status")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("accountStatus")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("pendingColumn")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pending = pendingFor(row);
                  return (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/candidates/${row.id}`}
                          className="font-mono font-medium text-gray-900 hover:underline"
                        >
                          {row.candidate_code}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900">
                          {row.first_name} {row.last_name}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {row.email}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.candidate_type === "apprenticeship_candidate"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {tEnums(`candidateType.${row.candidate_type}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.german_level}</td>
                      <td className="px-3 py-2">
                        {row.availability_date ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.candidate_profiles ? (
                          <StatusBadge
                            status={row.candidate_profiles.profile_status}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.app_users ? (
                          <StatusBadge status={row.app_users.account_status} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {pending.changes === 0 && pending.documents === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className="font-medium text-amber-800">
                            {pending.changes} / {pending.documents}
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

      <details open={sp.create === "1"} className="rounded-xl border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
          {t("create")}
        </summary>
        <div className="border-t border-gray-100 p-4">
          <CreateCandidateForm />
        </div>
      </details>
    </div>
  );
}
