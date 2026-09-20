import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadInterestRequests,
  requestOccupation,
  type InterestRequestRow,
} from "@/lib/admin-data";
import { interestRequestStatuses } from "@/lib/domain";
import Icon, { type IconName } from "@/components/shell/Icon";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import OpsStatCard, { type OpsTone } from "@/components/admin/OpsStatCard";
import StatusTrack from "@/components/admin/StatusTrack";
import RequestDecisionForm from "@/components/admin/RequestDecisionForm";
import CandidateAvatar from "@/components/marketplace/CandidateAvatar";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * The queue is read in workflow order, not in enum order: new, reviewing,
 * approved, introduced, with the terminal rejection last.
 */
const FLOW = ["new", "reviewing", "approved", "introduced", "rejected"] as const;

/** Counter tone and glyph per status. */
const statusMeta: Record<string, { tone: OpsTone; icon: IconName }> = {
  new: { tone: "attention", icon: "requests" },
  reviewing: { tone: "accent", icon: "review" },
  approved: { tone: "positive", icon: "companies" },
  introduced: { tone: "teal", icon: "profile" },
  rejected: { tone: "critical", icon: "close" },
};

/** Every field an admin would type into the queue search. */
function haystack(row: InterestRequestRow, occupation: string | null): string {
  return [
    row.candidate_profiles?.candidates?.candidate_code,
    row.companies?.name,
    row.companies?.city,
    row.requester?.email,
    row.jobs?.title,
    occupation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default async function AdminRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");
  const search = await searchParams;

  const t = await getTranslations("admin.requests");
  const tStatus = await getTranslations("status");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");
  const format = await getFormatter();
  const now = new Date();

  const statusFilter = one(search, "status");
  const status = (interestRequestStatuses as readonly string[]).includes(
    statusFilter
  )
    ? statusFilter
    : undefined;
  const query = one(search, "q");
  const oldestFirst = one(search, "sort") === "oldest";

  /**
   * The whole queue is loaded once. The counters have to be over ALL
   * requests, not over the filtered view — a header that changed its
   * numbers whenever a tab was clicked would be useless for triage — so
   * status, search and order are applied here rather than in the query.
   */
  const all = await loadInterestRequests(supabase);

  const counts = new Map<string, number>();
  for (const row of all) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const rows = all
    .filter((row) => (status ? row.status === status : true))
    .filter((row) =>
      query
        ? haystack(row, requestOccupation(row)).includes(query.toLowerCase())
        : true
    );
  const ordered = oldestFirst ? [...rows].reverse() : rows;

  const href = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const current: Record<string, string> = {
      status: status ?? "",
      q: query,
      sort: oldestFirst ? "oldest" : "",
    };
    for (const key of ["status", "q", "sort"]) {
      const next =
        overrides[key] === undefined ? current[key] : (overrides[key] ?? "");
      if (next) params.set(key, next);
    }
    const qs = params.toString();
    return qs ? `/admin/requests?${qs}` : "/admin/requests";
  };

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? "bg-ink-900 text-white"
        : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
    }`;
  const tabCount = (active: boolean) =>
    `rounded-pill px-1.5 text-[11px] font-semibold tabular-nums ${
      active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
    }`;

  return (
    <div data-shell="wide">
      <PageHeader
        title={t("title")}
        description={t("description")}
        size="display"
        actions={
          // The operational promise of this screen, as in the reference.
          // Copy only — it states no number.
          <span className="hidden items-center gap-2.5 rounded-card border border-hairline-strong bg-surface px-3.5 py-2.5 shadow-card xl:inline-flex">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-control bg-accent-soft text-accent"
            >
              <Icon name="overview" className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-4 text-ink-900">
                {t("opsTitle")}
              </span>
              <span className="mt-0.5 block text-[12px] leading-4 text-ink-500">
                {t("opsSubtitle")}
              </span>
            </span>
          </span>
        }
      />

      {/* ---- Counter row ------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <OpsStatCard
          label={t("kpiTotal")}
          hint={t("kpiTotalHint")}
          value={all.length}
          href={href({ status: null })}
          icon="requests"
          tone="neutral"
          active={!status}
        />
        {FLOW.map((value) => {
          const meta = statusMeta[value];
          return (
            <OpsStatCard
              key={value}
              label={tStatus(value)}
              hint={t(
                `hint${value.charAt(0).toUpperCase()}${value.slice(1)}` as
                  | "hintNew"
                  | "hintReviewing"
                  | "hintApproved"
                  | "hintRejected"
                  | "hintIntroduced"
              )}
              value={counts.get(value) ?? 0}
              href={href({ status: value })}
              icon={meta.icon}
              tone={meta.tone}
              active={status === value}
            />
          );
        })}
      </div>

      {/* ---- Toolbar: status segments, search, order -------------------- */}
      <div className="mt-4 rounded-card border border-hairline-strong bg-surface px-3 py-2.5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <nav className="flex flex-wrap items-center gap-1">
            <Link href={href({ status: null })} className={tabClass(!status)}>
              {t("all")}
              <span className={tabCount(!status)}>{all.length}</span>
            </Link>
            {FLOW.map((value) => (
              <Link
                key={value}
                href={href({ status: value })}
                className={tabClass(status === value)}
              >
                {tStatus(value)}
                <span className={tabCount(status === value)}>
                  {counts.get(value) ?? 0}
                </span>
              </Link>
            ))}
          </nav>

          {/* A plain GET form: the queue view stays a shareable URL. */}
          <form method="get" className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {status && <input type="hidden" name="status" value={status} />}
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <label className="sr-only" htmlFor="q">
                {t("searchPlaceholder")}
              </label>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-2.5 text-ink-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-3.5 w-3.5"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                id="q"
                name="q"
                defaultValue={query}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-full rounded-control border border-hairline bg-surface pe-2.5 ps-8 sm:w-52 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <label className="sr-only" htmlFor="sort">
              {t("sortNewest")}
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={oldestFirst ? "oldest" : ""}
              className="h-9 rounded-control border border-hairline bg-surface px-2.5 text-[13px] text-ink-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">{t("sortNewest")}</option>
              <option value="oldest">{t("sortOldest")}</option>
            </select>

            <button
              type="submit"
              className="h-9 shrink-0 rounded-control bg-ink-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-ink-800"
            >
              {t("apply")}
            </button>
          </form>
        </div>
      </div>

      {/* ---- Queue ------------------------------------------------------ */}
      <div className="mt-4 overflow-hidden rounded-card border border-hairline-strong bg-surface shadow-card">
        {ordered.length === 0 ? (
          <div className="px-5 py-5">
            <EmptyState
              message={
                query
                  ? t("noneForSearch")
                  : status
                    ? t("noneForFilter")
                    : t("empty")
              }
              compact
            />
          </div>
        ) : (
          <>
            {/* An operations table stays a table. Below the breakpoint it
                scrolls inside its own container rather than reflowing into
                cards, so the columns an admin triages by stay aligned. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] table-fixed border-collapse text-start">
                {/* Fixed shares keep the decision column in view at 1440
                    instead of pushing it behind a horizontal scroll. */}
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[19%]" />
                  <col className="w-[20%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-hairline bg-surface-sunken text-start">
                    {[
                      t("colCandidate"),
                      t("colCompany"),
                      t("colRole"),
                      t("colStatus"),
                      t("colSubmitted"),
                      t("colActions"),
                    ].map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="px-4 py-2 text-start text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-500"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {ordered.map((request) => {
                    const candidate = request.candidate_profiles?.candidates;
                    const occupation = requestOccupation(request);
                    const unpublished =
                      request.candidate_profiles?.profile_status !== "published";

                    return (
                      <tr
                        key={request.id}
                        className="align-top transition-colors hover:bg-surface-sunken"
                      >
                        {/* Candidate — the code is the identity ALLEMARO
                            works with operationally. */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            {candidate && (
                              <CandidateAvatar
                                candidateCode={candidate.candidate_code}
                                candidateType={candidate.candidate_type}
                                size="sm"
                              />
                            )}
                            <div className="min-w-0">
                              {candidate ? (
                                <Link
                                  href={`/admin/candidates/${request.candidate_profiles?.candidate_id}`}
                                  className="block font-mono text-[13px] font-semibold text-ink-900 hover:text-accent hover:underline"
                                >
                                  <bdi>{candidate.candidate_code}</bdi>
                                </Link>
                              ) : (
                                <span className="t-meta">—</span>
                              )}
                              {candidate && (
                                <span
                                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                    candidate.candidate_type ===
                                    "apprenticeship_candidate"
                                      ? "bg-track-apprenticeship-soft text-track-apprenticeship"
                                      : "bg-track-skilled-soft text-track-skilled"
                                  }`}
                                >
                                  {tEnums(
                                    `candidateType.${candidate.candidate_type}`
                                  )}
                                </span>
                              )}
                              {unpublished && (
                                <span className="mt-1 block text-[11px] leading-4 text-attention">
                                  {t("candidateUnpublished")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Company */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            <span
                              aria-hidden
                              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-ink-100 text-ink-500"
                            >
                              <Icon name="companies" className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <span className="block text-[14px] font-semibold leading-5 text-ink-900">
                                <bdi>{request.companies?.name ?? "—"}</bdi>
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] leading-4 text-ink-500">
                                {request.companies?.city && (
                                  <bdi>{request.companies.city}</bdi>
                                )}
                                {request.companies?.city &&
                                  request.requester?.email &&
                                  " · "}
                                <bdi>{request.requester?.email ?? ""}</bdi>
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* What was requested */}
                        <td className="px-4 py-3">
                          <span className="block text-[14px] font-medium leading-5 text-ink-900">
                            <bdi>{occupation ?? "—"}</bdi>
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-4 text-ink-500">
                            {candidate && (
                              <>
                                {tFields("german_level")}{" "}
                                <bdi>{candidate.german_level}</bdi>
                              </>
                            )}
                            {request.jobs?.title && (
                              <>
                                {candidate && " · "}
                                {t("job")}: <bdi>{request.jobs.title}</bdi>
                              </>
                            )}
                          </span>
                          {request.message && (
                            <span
                              title={request.message}
                              className="mt-1 block truncate text-[12px] leading-4 text-ink-400"
                            >
                              <bdi>{request.message}</bdi>
                            </span>
                          )}
                        </td>

                        {/* Where it stands */}
                        <td className="px-4 py-3">
                          <StatusTrack status={request.status} />
                          <span className="mt-1.5 block">
                            <StatusBadge status={request.status} size="sm" />
                          </span>
                          {request.review_comment && (
                            <span
                              title={request.review_comment}
                              className="mt-1 block truncate text-[11px] leading-4 text-ink-400"
                            >
                              {t("internalNote")}:{" "}
                              <bdi>{request.review_comment}</bdi>
                            </span>
                          )}
                        </td>

                        {/* When */}
                        <td className="px-4 py-3">
                          {/* Medium form: the queue reads the day, not the
                              full month name, and it keeps the column narrow. */}
                          <span className="block text-[13px] leading-5 text-ink-800">
                            {format.dateTime(new Date(request.created_at), {
                              dateStyle: "medium",
                            })}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-4 text-ink-400">
                            {format.relativeTime(
                              new Date(request.created_at),
                              now
                            )}
                          </span>
                        </td>

                        {/* Decide */}
                        <td className="px-4 py-3">
                          <RequestDecisionForm
                            requestId={request.id}
                            status={request.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline bg-surface-sunken px-4 py-2">
              <p className="text-[12px] text-ink-500">
                {t("footerCount", { shown: ordered.length, total: all.length })}
              </p>
              {all.length >= 200 && (
                <p className="text-[12px] text-ink-400">{t("capped")}</p>
              )}
            </div>
          </>
        )}
      </div>

      <p className="t-meta mt-4 max-w-2xl">{t("contactNote")}</p>
    </div>
  );
}
