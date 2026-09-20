import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
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
    jobs.map((job) => job.id)
  );

  // Employer-safe labels for every event row. Nothing private is loaded,
  // so nothing private can be rendered.
  const byProfile = new Map(
    marketplace.rows.map((row) => [
      row.profile_id,
      { code: row.candidate_code, occupation: row.headline_occupation },
    ])
  );

  const activeRequests = requests.filter((r) =>
    ACTIVE_STATUSES.includes(r.status)
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
    href: string;
    waiting?: boolean;
  }[] = [];
  if (unreadRequests.size > 0) {
    nextSteps.push({
      key: "updates",
      label: tDash("reviewUpdates", { count: unreadRequests.size }),
      href: "/employer/requests",
      waiting: true,
    });
  }
  if (jobs.length === 0) {
    nextSteps.push({
      key: "createJob",
      label: tJobs("create"),
      href: "/employer/jobs/new",
    });
  } else if (openJobs.length > 0) {
    // Uses the marketplace's existing vacancy context — same link an
    // employer follows from the vacancy itself.
    nextSteps.push({
      key: "matchJob",
      label: tJobs("suitableCandidates"),
      href: `/employer/candidates?job=${openJobs[0].id}`,
    });
  }
  if (marketplace.rows.length > 0) {
    nextSteps.push({
      key: "discover",
      label: tDash("discover"),
      href: "/employer/candidates",
    });
  }

  return (
    <>
      <PageHeader
        eyebrow={company?.name ?? undefined}
        title={tDash("title")}
        description={tDash("subtitle")}
        actions={
          <Link
            href="/employer/candidates"
            className={buttonClass("primary", "sm")}
          >
            {tDash("discover")}
          </Link>
        }
      />

      {/* KPI definitions are explicit: "open" excludes rejected, "new
          updates" counts unread notification events, not requests, and the
          candidate total is marked as a lower bound when the query caps. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,65fr)_minmax(18rem,35fr)] lg:items-start lg:gap-4">
        {/* ---- Main column ------------------------------------------- */}
        <div className="space-y-4">
          <DashboardCard title={tDash("pipeline")}>
            {requests.length === 0 ? (
              <EmptyState message={tRequests("empty")} compact />
            ) : (
              <PipelineBar stages={stages} />
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
              <div className="px-4 py-3.5">
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
                      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 ${
                        isUnread ? "bg-attention-soft/35" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        {/* The unread marker replaces the separate "needs
                            attention" panel: the same events were listed
                            twice on this page. */}
                        <span
                          aria-hidden
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill ${
                            isUnread ? "bg-attention" : "bg-transparent"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="mk-value font-medium">
                            {tDash(`event.${event.type}`)}
                          </p>
                          <p className="t-meta mt-0.5">
                            <bdi>
                              {info?.code ?? tRequests("candidateWithdrawn")}
                            </bdi>
                            {info?.occupation && (
                              <>
                                {" · "}
                                <bdi>{info.occupation}</bdi>
                              </>
                            )}
                            {" · "}
                            {formatDateValue(event.created_at, locale)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        status={notificationStatus[event.type]}
                        size="sm"
                      />
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
              <div className="px-4 py-3.5">
                <EmptyState message={tMarket("noApprenticeships")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {newest.map((candidate) => (
                  <li key={candidate.profile_id}>
                    <Link
                      href={`/employer/candidates?selected=${candidate.profile_id}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-sunken"
                    >
                      <span className="min-w-0">
                        <span className="mk-value block font-medium">
                          <bdi>
                            {candidate.headline_occupation ??
                              tMarket("noOccupation")}
                          </bdi>
                        </span>
                        <span className="t-meta mt-0.5 block">
                          <bdi>{candidate.candidate_code}</bdi>
                          {" · "}
                          {tFields("german_level")}{" "}
                          <bdi>{candidate.german_level}</bdi>
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-[11px] font-medium ${
                          candidate.candidate_type ===
                          "apprenticeship_candidate"
                            ? "text-track-apprenticeship"
                            : "text-track-skilled"
                        }`}
                      >
                        {tEnums(`candidateType.${candidate.candidate_type}`)}
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
            <DashboardCard title={tDash("nextActions")}>
              <ul className="space-y-1.5">
                {nextSteps.map((step) => (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-sm font-medium transition-colors ${
                        step.waiting
                          ? "border-attention/30 bg-attention-soft/70 text-attention hover:bg-attention-soft"
                          : "border-hairline text-ink-700 hover:border-ink-300 hover:text-ink-900"
                      }`}
                    >
                      <span className="min-w-0">{step.label}</span>
                      <span aria-hidden className="shrink-0 rtl:rotate-180">
                        &#8594;
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
              <div className="px-4 py-3.5">
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
                      className="block px-4 py-2.5 transition-colors hover:bg-surface-sunken"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="mk-value min-w-0 font-medium">
                          <bdi>{job.title}</bdi>
                        </span>
                        <StatusBadge status={job.status} size="sm" />
                      </div>
                      <p className="t-meta mt-0.5">
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
    </>
  );
}
