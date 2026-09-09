import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadInterestRequests, requestOccupation } from "@/lib/admin-data";
import { interestRequestStatuses } from "@/lib/domain";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import RequestDecisionForm from "@/components/admin/RequestDecisionForm";
import { formatDateValue } from "@/components/ui/useValueFormatter";

type Search = Record<string, string | string[] | undefined>;

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

  const rawStatus = search.status;
  const statusFilter = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus) ?? "";
  const status = (interestRequestStatuses as readonly string[]).includes(
    statusFilter
  )
    ? statusFilter
    : undefined;

  const requests = await loadInterestRequests(supabase, { status });


  const chipClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-ink-900 text-white"
        : "border border-hairline bg-surface text-ink-700 hover:bg-ink-50"
    }`;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/requests" className={chipClass(!status)}>
          {t("all")}
        </Link>
        {interestRequestStatuses.map((value) => (
          <Link
            key={value}
            href={`/admin/requests?status=${value}`}
            className={chipClass(status === value)}
          >
            {tStatus(value)}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <Panel bleed>
          {requests.length === 0 ? (
            <div className="p-5">
              <EmptyState
                message={status ? t("noneForFilter") : t("empty")}
                compact
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {requests.map((request) => {
                const candidate = request.candidate_profiles?.candidates;
                const occupation = requestOccupation(request);
                return (
                  <li key={request.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <p className="t-entity">
                          <bdi>{request.companies?.name ?? "—"}</bdi>
                        </p>
                        <p className="t-meta mt-0.5">
                          <bdi>{request.requester?.email ?? ""}</bdi>
                          {request.companies?.city
                            ? ` · ${request.companies.city}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                      {candidate && (
                        <Link
                          href={`/admin/candidates/${request.candidate_profiles?.candidate_id}`}
                          className="t-meta font-mono hover:text-accent hover:underline"
                        >
                          <bdi>{candidate.candidate_code}</bdi>
                        </Link>
                      )}
                      {occupation && (
                        <span className="text-sm font-medium text-ink-800">
                          <bdi>{occupation}</bdi>
                        </span>
                      )}
                      {candidate && (
                        <span className="t-meta">
                          {tEnums(`candidateType.${candidate.candidate_type}`)}{" "}
                          · {candidate.german_level}
                        </span>
                      )}
                      {request.candidate_profiles?.profile_status !==
                        "published" && (
                        <span className="t-meta text-attention">
                          {t("candidateUnpublished")}
                        </span>
                      )}
                      {request.jobs?.title && (
                        <span className="t-meta">
                          {t("job")}: <bdi>{request.jobs.title}</bdi>
                        </span>
                      )}
                      <span className="t-meta">
                        {t("submitted")}:{" "}
                        {formatDateValue(request.created_at, locale)}
                      </span>
                    </div>

                    {request.message && (
                      <p className="t-body mt-3 max-w-[68ch] rounded-md bg-ink-50 px-3 py-2">
                        <bdi>{request.message}</bdi>
                      </p>
                    )}
                    {request.review_comment && (
                      <p className="t-meta mt-2">
                        {t("internalNote")}: <bdi>{request.review_comment}</bdi>
                      </p>
                    )}

                    <div className="mt-3">
                      <RequestDecisionForm
                        requestId={request.id}
                        status={request.status}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <p className="t-meta mt-4 max-w-2xl">{t("contactNote")}</p>
    </>
  );
}
