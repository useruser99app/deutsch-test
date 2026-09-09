import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadEmployerRequests, loadMarketplace } from "@/lib/employer-data";
import {
  loadNotifications,
  notificationStatus,
  unreadByRequest,
  type EmployerNotification,
} from "@/lib/notifications";
import { markRequestReadAction } from "@/lib/actions/employer";
import { formatDateValue } from "@/components/ui/useValueFormatter";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonClass } from "@/components/ui/button";

export default async function EmployerRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");

  const t = await getTranslations("employer.requests");
  const tDash = await getTranslations("employer.dashboard");

  const [requests, marketplace, notifications] = await Promise.all([
    loadEmployerRequests(supabase),
    loadMarketplace(supabase),
    loadNotifications(supabase, { limit: 100 }),
  ]);

  const byProfile = new Map(
    marketplace.rows.map((row) => [
      row.profile_id,
      { code: row.candidate_code, occupation: row.headline_occupation },
    ])
  );

  const unread = unreadByRequest(notifications);
  const eventsByRequest = new Map<string, EmployerNotification[]>();
  for (const event of notifications) {
    const list = eventsByRequest.get(event.interest_request_id) ?? [];
    list.push(event);
    eventsByRequest.set(event.interest_request_id, list);
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          unread.size > 0 ? (
            // Explicit action — nothing is marked read by merely rendering.
            <form action={markRequestReadAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className={buttonClass("secondary", "sm")}>
                {t("markAllRead")}
              </button>
            </form>
          ) : undefined
        }
      />

      <Panel bleed>
        {requests.length === 0 ? (
          <div className="p-5">
            <EmptyState message={t("empty")} compact />
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {requests.map((request) => {
              const info = byProfile.get(request.candidate_profile_id);
              const unreadCount = unread.get(request.id) ?? 0;
              const events = eventsByRequest.get(request.id) ?? [];

              return (
                <li
                  key={request.id}
                  className={`px-5 py-4 ${
                    unreadCount > 0 ? "bg-attention-soft/30" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="t-meta font-mono">
                          <bdi>{info?.code ?? t("candidateWithdrawn")}</bdi>
                        </span>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-attention-soft px-2 py-0.5 text-[11px] font-semibold text-attention">
                            {t("updated", { count: unreadCount })}
                          </span>
                        )}
                        {request.jobs?.title && (
                          <span className="t-meta">
                            <bdi>{request.jobs.title}</bdi>
                          </span>
                        )}
                      </div>
                      <p className="t-value mt-1 font-medium">
                        <bdi>{info?.occupation ?? ""}</bdi>
                      </p>
                      <p className="t-meta mt-0.5">
                        {t("submitted")}:{" "}
                        {formatDateValue(request.created_at, locale)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={request.status} />
                      {info && (
                        <Link
                          href={`/employer/candidates/${request.candidate_profile_id}`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          {t("openProfile")}
                        </Link>
                      )}
                    </div>
                  </div>

                  {events.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {events.map((event) => (
                        <li
                          key={event.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1"
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              event.read_at ? "bg-ink-300" : "bg-attention"
                            }`}
                          />
                          <span className="t-meta">
                            {tDash(`event.${event.type}`)} ·{" "}
                            {formatDateValue(event.created_at, locale)}
                          </span>
                          <StatusBadge
                            status={notificationStatus[event.type]}
                            size="sm"
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {unreadCount > 0 && (
                    <form action={markRequestReadAction} className="mt-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input
                        type="hidden"
                        name="request_id"
                        value={request.id}
                      />
                      <button
                        type="submit"
                        className={buttonClass("secondary", "sm")}
                      >
                        {t("markRead")}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="t-meta mt-4 max-w-2xl">{t("processNote")}</p>
    </>
  );
}
