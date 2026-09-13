import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadEmployerRequests,
  loadMarketplace,
  loadOwnCompany,
} from "@/lib/employer-data";
import {
  loadNotifications,
  notificationStatus,
  unreadByRequest,
} from "@/lib/notifications";
import { formatDateValue } from "@/components/ui/useValueFormatter";
import { trackClass } from "@/components/ui/CandidateIdentity";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatStrip from "@/components/ui/StatStrip";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/button";

/** Requests that are still running. Rejected is explicitly NOT active (§22). */
const ACTIVE_STATUSES = ["new", "reviewing", "approved"];

export default async function EmployerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");

  const t = await getTranslations("employer");
  const tDash = await getTranslations("employer.dashboard");
  const tMarket = await getTranslations("employer.marketplace");
  const tRequests = await getTranslations("employer.requests");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");

  const [company, marketplace, requests, notifications] = await Promise.all([
    loadOwnCompany(supabase),
    loadMarketplace(supabase),
    loadEmployerRequests(supabase),
    loadNotifications(supabase, { limit: 8 }),
  ]);

  // Employer-safe labels for every event and request row.
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
  const unreadRequests = unreadByRequest(notifications);

  // "New in the marketplace" is ordered by publication date only. There is
  // no scoring and no matching — the heading must not imply otherwise.
  const newest = marketplace.rows.slice(0, 4);

  return (
    <>
      <PageHeader
        title={company?.name ?? t("title")}
        description={tDash("welcome")}
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
          updates" counts unread notification events, not requests. */}
      <StatStrip
        stats={[
          {
            label: tDash("kpiAvailable"),
            value: marketplace.rows.length,
            href: "/employer/candidates",
          },
          {
            label: tDash("kpiActive"),
            value: activeRequests,
            href: "/employer/requests",
          },
          {
            label: tDash("kpiUnread"),
            value: unread.length,
            href: "/employer/requests",
            waiting: true,
          },
          {
            label: tDash("kpiIntroduced"),
            value: introduced,
            href: "/employer/requests",
          },
        ]}
      />

      {/* What needs attention — compact and calm when nothing is waiting. */}
      <div className="mt-6">
        {unread.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface px-5 py-3.5">
            <StatusBadge status="approved" size="sm" />
            <p className="t-body text-ink-600">{tDash("noUpdates")}</p>
          </div>
        ) : (
          <Panel
            title={tDash("needsAttention")}
            description={tDash("needsAttentionDescription")}
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
            <ul className="divide-y divide-hairline">
              {unread.map((event) => {
                const info = byProfile.get(event.candidate_profile_id ?? "");
                return (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <span className="min-w-0">
                      <span className="t-meta font-mono">
                        <bdi>{info?.code ?? tRequests("candidateWithdrawn")}</bdi>
                      </span>
                      <span className="t-value ms-3 font-medium">
                        <bdi>{info?.occupation ?? ""}</bdi>
                      </span>
                    </span>
                    <StatusBadge
                      status={notificationStatus[event.type]}
                      size="sm"
                    />
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent activity — employer-safe data only. */}
        <Panel title={tDash("activity")} bleed>
          {notifications.length === 0 ? (
            <div className="p-5">
              <EmptyState message={tDash("noActivity")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {notifications.map((event) => {
                const info = byProfile.get(event.candidate_profile_id ?? "");
                return (
                  <li key={event.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <span className="t-value">
                        {tDash(`event.${event.type}`)}
                      </span>
                      <StatusBadge
                        status={notificationStatus[event.type]}
                        size="sm"
                      />
                    </div>
                    <p className="t-meta mt-0.5">
                      <bdi>{info?.code ?? tRequests("candidateWithdrawn")}</bdi>
                      {info?.occupation ? " · " : ""}
                      <bdi>{info?.occupation ?? ""}</bdi> ·{" "}
                      {formatDateValue(event.created_at, locale)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Newest published profiles. Ordered by publication date, nothing else. */}
        <Panel
          title={tDash("newCandidates")}
          description={tDash("newCandidatesHint")}
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
            <div className="p-5">
              <EmptyState message={tMarket("noApprenticeships")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {newest.map((candidate) => (
                <li key={candidate.profile_id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <Link
                      href={`/employer/candidates/${candidate.profile_id}`}
                      className="t-value font-medium hover:text-accent hover:underline"
                    >
                      <bdi>
                        {candidate.headline_occupation ??
                          tMarket("noOccupation")}
                      </bdi>
                    </Link>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${trackClass(
                        candidate.candidate_type
                      )}`}
                    >
                      {tEnums(`candidateType.${candidate.candidate_type}`)}
                    </span>
                  </div>
                  <p className="t-meta mt-0.5">
                    <bdi>{candidate.candidate_code}</bdi> ·{" "}
                    {tFields("german_level")}:{" "}
                    <bdi>{candidate.german_level}</bdi>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Clear next actions. */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface px-5 py-4">
        <span className="t-label">{tDash("nextActions")}</span>
        <Link
          href="/employer/candidates"
          className={buttonClass("secondary", "sm")}
        >
          {tDash("discover")}
        </Link>
        <Link
          href="/employer/requests"
          className={buttonClass("secondary", "sm")}
        >
          {unreadRequests.size > 0
            ? tDash("reviewUpdates", { count: unreadRequests.size })
            : tRequests("title")}
        </Link>
      </div>
    </>
  );
}
