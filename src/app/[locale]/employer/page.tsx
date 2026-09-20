import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { rtlLocales } from "@/i18n/routing";
import {
  loadEmployerRequests,
  loadMarketplace,
  loadOwnCompany,
} from "@/lib/employer-data";
import { loadJobs, loadRequestCountsByJob } from "@/lib/jobs-data";
import {
  loadNotifications,
  notificationStatus,
  unreadByRequest,
} from "@/lib/notifications";
import { formatDateValue } from "@/components/ui/useValueFormatter";
import CandidateAvatar from "@/components/marketplace/CandidateAvatar";
import Icon, { type IconName } from "@/components/shell/Icon";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/button";
import DashboardCard from "@/components/dashboard/DashboardCard";
import KpiCard from "@/components/dashboard/KpiCard";
import PipelineBar from "@/components/dashboard/PipelineBar";

/** Requests that are still running. Rejected is explicitly NOT active. */
const ACTIVE_STATUSES = ["new", "reviewing", "approved"];

/**
 * Event glyph and tone per notification type. The tone follows the status
 * the event reports, so the tile and the badge beside it always agree.
 */
const eventIcon: Record<string, IconName> = {
  request_reviewing: "review",
  request_approved: "requests",
  request_rejected: "close",
  request_introduced: "profile",
};

const eventTone: Record<string, string> = {
  request_reviewing: "bg-accent-soft text-accent",
  request_approved: "bg-positive-soft text-positive",
  request_rejected: "bg-critical-soft text-critical",
  request_introduced: "bg-positive-soft text-positive",
};

/**
 * The pipeline stages, in workflow order. These are the product's existing
 * request statuses — no stage is invented, merged or renamed here.
 */
const PIPELINE: string[] = [
  "new",
  "reviewing",
  "approved",
  "introduced",
  "rejected",
];

export default async function EmployerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");

  const tDash = await getTranslations("employer.dashboard");
  const tMarket = await getTranslations("employer.marketplace");
  const tRequests = await getTranslations("employer.requests");
  const tJobs = await getTranslations("employer.jobs");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");
  const format = await getFormatter();
  // One timestamp for the whole render, so every relative time on the
  // page is measured from the same instant.
  const now = new Date();

  const [company, marketplace, requests, notifications, jobs] =
    await Promise.all([
      loadOwnCompany(supabase),
      loadMarketplace(supabase),
      loadEmployerRequests(supabase),
      loadNotifications(supabase, { limit: 8 }),
      // RLS scopes this to the employer's own company.
      loadJobs(supabase),
    ]);

  const requestCounts = await loadRequestCountsByJob(
    supabase,
    jobs.map((job) => job.id),
  );

  // Employer-safe labels for every event row. Nothing private is loaded,
  // so nothing private can be rendered.
  const byProfile = new Map(
    marketplace.rows.map((row) => [
      row.profile_id,
      { code: row.candidate_code, occupation: row.headline_occupation },
    ]),
  );

  const activeRequests = requests.filter((r) =>
    ACTIVE_STATUSES.includes(r.status),
  ).length;
  const introduced = requests.filter((r) => r.status === "introduced").length;
  const unread = notifications.filter((n) => !n.read_at);
  const unreadIds = new Set(unread.map((event) => event.id));
  const unreadRequests = unreadByRequest(notifications);

  // Real counts per stage, straight from the company's own requests.
  const stages = PIPELINE.map((status) => ({
    status,
    count: requests.filter((r) => r.status === status).length,
  }));

  const openJobs = jobs.filter((job) => job.status === "open");
  const shownJobs = jobs.slice(0, 4);

  // Ordered by publication date only. There is no scoring and no matching
  // without a vacancy, so the heading must not imply otherwise.
  const newest = marketplace.rows.slice(0, 4);

  /**
   * Next steps are DERIVED from state, never invented. Each entry exists
   * only while the condition that produced it is true, and the section
   * disappears entirely when nothing is actually open.
   */
  const nextSteps: {
    key: string;
    label: string;
    hint: string;
    icon: IconName;
    href: string;
    count?: number;
    waiting?: boolean;
  }[] = [];
  if (unreadRequests.size > 0) {
    nextSteps.push({
      key: "updates",
      label: tDash("reviewUpdates", { count: unreadRequests.size }),
      hint: tDash("nextUpdatesHint"),
      icon: "requests",
      href: "/employer/requests",
      count: unreadRequests.size,
      waiting: true,
    });
  }
  if (jobs.length === 0) {
    nextSteps.push({
      key: "createJob",
      label: tJobs("create"),
      hint: tDash("nextCreateJobHint"),
      icon: "jobs",
      href: "/employer/jobs/new",
    });
  } else if (openJobs.length > 0) {
    // Uses the marketplace's existing vacancy context — same link an
    // employer follows from the vacancy itself.
    nextSteps.push({
      key: "matchJob",
      label: tJobs("suitableCandidates"),
      hint: tDash("nextMatchJobHint"),
      icon: "review",
      href: `/employer/candidates?job=${openJobs[0].id}`,
    });
  }
  if (marketplace.rows.length > 0) {
    nextSteps.push({
      key: "discover",
      label: tDash("discover"),
      hint: tDash("nextDiscoverHint"),
      icon: "discover",
      href: "/employer/candidates",
    });
  }

  return (
    // data-shell="wide" lets .shell-content give the dashboard more room
    // from 1280px up — the same opt-in the marketplace uses.
    <div data-shell="wide">
      <PageHeader
        eyebrow={company?.name ?? undefined}
        title={tDash("title")}
        description={tDash("subtitle")}
        size="display"
        actions={
          <>
            <span className="hidden text-[13px] text-ink-500 sm:block">
              {format.dateTime(now, { dateStyle: "full" })}
            </span>
            <Link
              href="/employer/candidates"
              className={buttonClass("primary", "sm")}
            >
              {tDash("discover")}
            </Link>
          </>
        }
      />

      {/* KPI definitions are explicit: "open" excludes rejected, "new
          updates" counts unread notification events, not requests, and the
          candidate total is marked as a lower bound when the query caps. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label={tDash("kpiAvailable")}
          value={marketplace.rows.length}
          atLeast={marketplace.truncated}
          href="/employer/candidates"
          icon="discover"
        />
        <KpiCard
          label={tDash("kpiActive")}
          value={activeRequests}
          href="/employer/requests"
          icon="requests"
        />
        <KpiCard
          label={tDash("kpiUnread")}
          value={unread.length}
          href="/employer/requests"
          icon="changes"
          waiting
        />
        <KpiCard
          label={tDash("kpiIntroduced")}
          value={introduced}
          href="/employer/requests"
          icon="profile"
        />
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,68fr)_minmax(19rem,32fr)] lg:items-start lg:gap-5">
        {/* ---- Main column ------------------------------------------- */}
        <div className="space-y-5">
          <DashboardCard title={tDash("pipeline")}>
            {requests.length === 0 ? (
              <EmptyState message={tRequests("empty")} compact />
            ) : (
              <PipelineBar stages={stages} rtl={rtlLocales.includes(locale)} />
            )}
          </DashboardCard>

          <DashboardCard
            title={tDash("activity")}
            action={
              <Link
                href="/employer/requests"
                className="text-sm font-medium text-accent hover:underline"
              >
                {tRequests("title")}
              </Link>
            }
            bleed
          >
            {notifications.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState message={tDash("noActivity")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {notifications.map((event) => {
                  const info = byProfile.get(event.candidate_profile_id ?? "");
                  const isUnread = unreadIds.has(event.id);
                  return (
                    <li
                      key={event.id}
                      className={`relative px-5 py-3.5 ${
                        isUnread ? "bg-attention-soft/35" : ""
                      }`}
                    >
                      {/* Unread is marked on the inline-start edge — the
                          same language the marketplace uses for the
                          selected row, and it replaces the separate
                          "needs attention" panel that listed these events
                          a second time. */}
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 start-0 w-[3px] ${
                          isUnread ? "bg-attention" : "bg-transparent"
                        }`}
                      />
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${
                            eventTone[event.type] ?? "bg-ink-100 text-ink-600"
                          }`}
                        >
                          <Icon
                            name={eventIcon[event.type] ?? "requests"}
                            className="h-4 w-4"
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <p className="min-w-0 text-[15px] font-semibold leading-5 text-ink-900">
                              {tDash(`event.${event.type}`)}
                            </p>
                            {/* Relative time reads faster than a date on a
                                feed; the exact timestamp stays in the title
                                attribute for anyone who needs it. */}
                            <span
                              className="shrink-0 text-[12px] leading-5 text-ink-400"
                              title={
                                formatDateValue(event.created_at, locale) ??
                                undefined
                              }
                            >
                              {format.relativeTime(
                                new Date(event.created_at),
                                now,
                              )}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[13px] leading-5 text-ink-500">
                            <bdi className="font-mono">
                              {info?.code ?? tRequests("candidateWithdrawn")}
                            </bdi>
                            {info?.occupation && (
                              <>
                                <span
                                  aria-hidden
                                  className="mx-1.5 text-ink-300"
                                >
                                  ·
                                </span>
                                <bdi>{info.occupation}</bdi>
                              </>
                            )}
                          </p>
                        </div>

                        <StatusBadge
                          status={notificationStatus[event.type]}
                          size="sm"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
            title={tDash("newCandidates")}
            action={
              <Link
                href="/employer/candidates"
                className="text-sm font-medium text-accent hover:underline"
              >
                {tDash("open")}
              </Link>
            }
            bleed
          >
            {newest.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState message={tMarket("noApprenticeships")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {newest.map((candidate) => (
                  <li key={candidate.profile_id}>
                    <Link
                      href={`/employer/candidates?selected=${candidate.profile_id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
                    >
                      {/* The same neutral tile the marketplace uses: no
                          photo, no name, no initials of a name — the code
                          and the (public) track are all it encodes. */}
                      <CandidateAvatar
                        candidateCode={candidate.candidate_code}
                        candidateType={candidate.candidate_type}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold leading-5 text-ink-900">
                          <bdi>
                            {candidate.headline_occupation ??
                              tMarket("noOccupation")}
                          </bdi>
                        </span>
                        {/* Code, level and track on one meta line. As a
                            separate right-hand column the track label
                            squeezed the occupation into an ellipsis on a
                            phone. */}
                        <span className="mt-0.5 block text-[13px] leading-5 text-ink-500">
                          <bdi className="font-mono">
                            {candidate.candidate_code}
                          </bdi>
                          <span aria-hidden className="mx-1.5 text-ink-300">
                            ·
                          </span>
                          {tFields("german_level")}{" "}
                          <bdi>{candidate.german_level}</bdi>
                          <span aria-hidden className="mx-1.5 text-ink-300">
                            ·
                          </span>
                          <span
                            className={`font-medium ${
                              candidate.candidate_type ===
                              "apprenticeship_candidate"
                                ? "text-track-apprenticeship"
                                : "text-track-skilled"
                            }`}
                          >
                            {tEnums(
                              `candidateType.${candidate.candidate_type}`,
                            )}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>

        {/* ---- Secondary column -------------------------------------- */}
        <div className="mt-4 space-y-4 lg:mt-0">
          {/* Omitted entirely when nothing real is open. */}
          {nextSteps.length > 0 && (
            <DashboardCard
              title={tDash("nextActions")}
              action={
                <span className="rounded-pill bg-ink-100 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-ink-600">
                  {nextSteps.length}
                </span>
              }
            >
              <p className="t-meta -mt-1 mb-3">{tDash("stepsOpen")}</p>
              <ul className="space-y-2">
                {nextSteps.map((step) => (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className={`flex items-center gap-3 rounded-control border px-3 py-2.5 transition-colors ${
                        step.waiting
                          ? "border-attention/30 bg-attention-soft/70 hover:bg-attention-soft"
                          : "border-hairline hover:border-ink-300 hover:bg-surface-sunken"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${
                          step.waiting
                            ? "bg-attention/12 text-attention"
                            : "bg-accent-soft text-accent"
                        }`}
                      >
                        <Icon name={step.icon} className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-semibold leading-5 ${
                            step.waiting ? "text-attention" : "text-ink-900"
                          }`}
                        >
                          {step.label}
                        </span>
                        {/* Why it is here. Derived from state, never a
                            generic nudge. */}
                        <span className="mt-0.5 block text-[12px] leading-4 text-ink-500">
                          {step.hint}
                        </span>
                      </span>

                      {step.count !== undefined && (
                        <span className="shrink-0 rounded-pill bg-attention px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                          {step.count}
                        </span>
                      )}
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
                ))}
              </ul>
            </DashboardCard>
          )}

          <DashboardCard
            title={tJobs("title")}
            action={
              <Link
                href="/employer/jobs"
                className="text-sm font-medium text-accent hover:underline"
              >
                {tDash("open")}
              </Link>
            }
            bleed
          >
            {shownJobs.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState
                  message={tJobs("empty")}
                  action={
                    <Link
                      href="/employer/jobs/new"
                      className={buttonClass("secondary", "sm")}
                    >
                      {tJobs("create")}
                    </Link>
                  }
                  compact
                />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {shownJobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/employer/jobs/${job.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-surface-sunken"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 text-[15px] font-semibold leading-5 text-ink-900">
                          <bdi>{job.title}</bdi>
                        </span>
                        <StatusBadge status={job.status} size="sm" />
                      </div>
                      <p className="mt-1 text-[13px] leading-5 text-ink-500">
                        {tEnums(`jobType.${job.job_type}`)}
                        {" · "}
                        {tJobs("linkedRequests")}{" "}
                        <span className="tabular-nums">
                          {requestCounts.get(job.id) ?? 0}
                        </span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
