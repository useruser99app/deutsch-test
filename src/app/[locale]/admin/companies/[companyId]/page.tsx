import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadAdminCompany,
  loadCompanyMembers,
  loadInterestRequests,
  requestOccupation,
} from "@/lib/admin-data";
import { loadAllJobs, loadRequestCountsByJob } from "@/lib/jobs-data";
import {
  countryName,
  formatDateValue,
} from "@/components/ui/useValueFormatter";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { InfoGrid, InfoItem } from "@/components/ui/InfoGrid";
import DashboardCard from "@/components/dashboard/DashboardCard";

/**
 * One company, as the admin sees it: its own record, the employer accounts
 * attached to it, the vacancies it created and the introductions it asked
 * for. Read only — the page adds no action the admin did not already have.
 *
 * Every block renders what the schema holds for this company and nothing
 * else; an absent value is dropped rather than shown as a placeholder.
 */
export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; companyId: string }>;
}) {
  const { locale, companyId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const company = await loadAdminCompany(supabase, companyId);
  if (!company) notFound();

  const [members, jobs, requests] = await Promise.all([
    loadCompanyMembers(supabase, companyId),
    loadAllJobs(supabase, { companyId }),
    loadInterestRequests(supabase, { companyId }),
  ]);
  const requestCounts = await loadRequestCountsByJob(
    supabase,
    jobs.map((job) => job.id),
  );

  const t = await getTranslations("admin.companies");
  const tJobs = await getTranslations("employer.jobs");
  const tRequests = await getTranslations("admin.requests");
  const tEnums = await getTranslations("enums");

  const date = (value: string | null) => formatDateValue(value, locale);
  // Only a real web address becomes a link; anything else stays text, so a
  // stored value can never turn into a script URL.
  const safeWebsite =
    company.website && /^https?:\/\//i.test(company.website)
      ? company.website
      : null;

  const rowLink =
    "flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken";
  const chevron = (
    <span aria-hidden className="shrink-0 text-ink-300 rtl:rotate-180">
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
  );

  return (
    <div data-shell="wide">
      <PageHeader
        title={company.name}
        description={[company.city, countryName(company.country, locale)]
          .filter(Boolean)
          .join(" · ")}
        breadcrumb={
          <Link
            href="/admin/companies"
            className="t-meta inline-flex items-center gap-1 hover:text-accent hover:underline"
          >
            <span aria-hidden className="rtl:rotate-180">
              &#8592;
            </span>
            {t("backToList")}
          </Link>
        }
        actions={<StatusBadge status={company.status} />}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,68fr)_minmax(19rem,32fr)] lg:items-start lg:gap-5">
        {/* ---- Main column --------------------------------------------- */}
        <div className="space-y-5">
          <DashboardCard
            title={t("jobs")}
            action={
              <span className="text-[12px] tabular-nums text-ink-500">
                {jobs.length}
              </span>
            }
            bleed
          >
            {jobs.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState message={t("noJobs")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link href={`/admin/jobs/${job.id}`} className={rowLink}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold leading-5 text-ink-900">
                          <bdi>{job.title}</bdi>
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-4 text-ink-500">
                          {tEnums(`jobType.${job.job_type}`)}
                          {job.location && (
                            <>
                              {" · "}
                              <bdi>{job.location}</bdi>
                            </>
                          )}
                          {" · "}
                          {tJobs("linkedRequests")}{" "}
                          <span className="tabular-nums">
                            {requestCounts.get(job.id) ?? 0}
                          </span>
                        </span>
                      </span>
                      <StatusBadge status={job.status} size="sm" />
                      {chevron}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
            title={t("requests")}
            action={
              requests.length > 0 ? (
                <Link
                  href={`/admin/requests?q=${encodeURIComponent(company.name)}`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {t("openInQueue")}
                </Link>
              ) : undefined
            }
            bleed
          >
            {requests.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState message={t("noRequests")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {requests.map((request) => {
                  const candidate = request.candidate_profiles?.candidates;
                  const occupation = requestOccupation(request);
                  const candidateId = request.candidate_profiles?.candidate_id;
                  const body = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[13px] font-semibold leading-5 text-ink-900">
                          <bdi>{candidate?.candidate_code ?? "—"}</bdi>
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] leading-4 text-ink-500">
                          {occupation && <bdi>{occupation}</bdi>}
                          {request.jobs?.title && (
                            <>
                              {occupation && " · "}
                              {tRequests("job")}:{" "}
                              <bdi>{request.jobs.title}</bdi>
                            </>
                          )}
                          {(occupation || request.jobs?.title) && " · "}
                          {date(request.created_at)}
                        </span>
                      </span>
                      <StatusBadge status={request.status} size="sm" />
                    </>
                  );
                  return (
                    <li key={request.id}>
                      {candidateId ? (
                        <Link
                          href={`/admin/candidates/${candidateId}`}
                          className={rowLink}
                        >
                          {body}
                          {chevron}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardCard>
        </div>

        {/* ---- Secondary column ---------------------------------------- */}
        <div className="mt-5 space-y-5 lg:sticky lg:top-5 lg:mt-0">
          <DashboardCard title={t("details")}>
            <InfoGrid columns={2}>
              <InfoItem label={t("statusLabel")}>
                <StatusBadge status={company.status} size="sm" />
              </InfoItem>
              <InfoItem label={t("country")}>
                {countryName(company.country, locale)}
              </InfoItem>
              {company.city && (
                <InfoItem label={t("city")}>{company.city}</InfoItem>
              )}
              {company.industry && (
                <InfoItem label={t("industry")}>{company.industry}</InfoItem>
              )}
              {company.website && (
                <InfoItem label={t("website")} wide>
                  {safeWebsite ? (
                    <a
                      href={safeWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-accent hover:underline"
                    >
                      <bdi>{company.website}</bdi>
                    </a>
                  ) : (
                    company.website
                  )}
                </InfoItem>
              )}
              <InfoItem label={t("createdAt")}>
                {date(company.created_at) ?? company.created_at}
              </InfoItem>
              <InfoItem label={t("updatedAt")}>
                {date(company.updated_at) ?? company.updated_at}
              </InfoItem>
            </InfoGrid>
          </DashboardCard>

          <DashboardCard
            title={t("members")}
            action={
              <span className="text-[12px] tabular-nums text-ink-500">
                {members.length}
              </span>
            }
            bleed
          >
            {members.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState message={t("noMembers")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {members.map((member) => (
                  <li key={member.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-all text-[13px] font-medium leading-5 text-ink-900">
                        <bdi>{member.app_users?.email ?? "—"}</bdi>
                      </span>
                      {member.app_users && (
                        <StatusBadge
                          status={member.app_users.account_status}
                          size="sm"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-4 text-ink-500">
                      {t.has(`role.${member.member_role}`)
                        ? t(`role.${member.member_role}`)
                        : member.member_role}
                      {" · "}
                      {t("memberSince")} {date(member.created_at)}
                    </p>
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
