import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadEmployerRequests, loadMarketplace } from "@/lib/employer-data";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDateValue } from "@/components/ui/useValueFormatter";

export default async function EmployerRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");

  const t = await getTranslations("employer.requests");

  const [requests, marketplace] = await Promise.all([
    loadEmployerRequests(supabase),
    loadMarketplace(supabase),
  ]);

  // Candidate code and occupation come from the published view, so a request
  // for a since-unpublished candidate simply loses its label rather than
  // exposing anything new.
  const byProfile = new Map(
    marketplace.rows.map((row) => [
      row.profile_id,
      { code: row.candidate_code, occupation: row.headline_occupation },
    ])
  );



  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <Panel bleed>
        {requests.length === 0 ? (
          <div className="p-5">
            <EmptyState message={t("empty")} compact />
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {requests.map((request) => {
              const info = byProfile.get(request.candidate_profile_id);
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="t-meta font-mono">
                        <bdi>{info?.code ?? t("candidateWithdrawn")}</bdi>
                      </span>
                      {request.jobs?.title && (
                        <span className="t-meta">
                          <bdi>{request.jobs.title}</bdi>
                        </span>
                      )}
                    </div>
                    <p className="t-value mt-1 font-medium">
                      <bdi>{info?.occupation ?? " "}</bdi>
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
