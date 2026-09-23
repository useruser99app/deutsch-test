import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadAdminJob } from "@/lib/jobs-data";
import { loadInterestRequests, requestOccupation } from "@/lib/admin-data";
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
 * One vacancy, as the admin sees it. Operational oversight only: the
 * employer owns the vacancy, so this page shows it and the introduction
 * requests that reference it, and edits nothing.
 *
 * Field labels follow the employer's own vacancy page, so both sides of the
 * product describe the same record in the same words.
 */
export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; jobId: string }>;
}) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const job = await loadAdminJob(supabase, jobId);
  if (!job) notFound();

  const requests = await loadInterestRequests(supabase, { jobId });

  const t = await getTranslations("admin.jobs");
  const tCompanies = await getTranslations("admin.companies");
  const tJobs = await getTranslations("employer.jobs");
  const tRequests = await getTranslations("admin.requests");
  const tMkt = await getTranslations("employer.marketplace");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");

  const isApprenticeship = job.job_type === "apprenticeship";
  const date = (value: string | null) => formatDateValue(value, locale);

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
        title={job.title}
        description={tEnums(`jobType.${job.job_type}`)}
        breadcrumb={
          <Link
            href="/admin/jobs"
            className="t-meta inline-flex items-center gap-1 hover:text-accent hover:underline"
          >
            <span aria-hidden className="rtl:rotate-180">
              &#8592;
            </span>
            {t("backToList")}
          </Link>
        }
        actions={<StatusBadge status={job.status} />}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,68fr)_minmax(19rem,32fr)] lg:items-start lg:gap-5">
        {/* ---- Main column --------------------------------------------- */}
        <div className="space-y-5">
          <DashboardCard title={t("details")}>
            <InfoGrid columns={2}>
              <InfoItem label={tJobs("jobType")}>
                {tEnums(`jobType.${job.job_type}`)}
              </InfoItem>
              <InfoItem label={tJobs("status")}>
                <StatusBadge status={job.status} size="sm" />
              </InfoItem>
              {job.profession_or_training_occupation && (
                <InfoItem
                  label={
                    isApprenticeship
                      ? tJobs("targetOccupation")
                      : tFields("profession")
                  }
                >
                  {job.profession_or_training_occupation}
                </InfoItem>
              )}
              <InfoItem label={tJobs("requiredGerman")}>
                {job.required_german_level ?? tJobs("noRequirement")}
              </InfoItem>
              {job.training_start_date && (
                <InfoItem
                  label={
                    isApprenticeship
                      ? tJobs("trainingStart")
                      : tJobs("entryDate")
                  }
                >
                  {date(job.training_start_date) ?? job.training_start_date}
                </InfoItem>
              )}
              {!isApprenticeship && job.minimum_experience_years !== null && (
                <InfoItem label={tJobs("minExperience")}>
                  {tMkt("years", { count: job.minimum_experience_years })}
                </InfoItem>
              )}
              {job.employment_type && (
                <InfoItem label={tJobs("employmentType")}>
                  {tEnums.has(`employmentType.${job.employment_type}`)
                    ? tEnums(`employmentType.${job.employment_type}`)
                    : job.employment_type}
                </InfoItem>
              )}
              {job.location && (
                <InfoItem label={tJobs("location")}>{job.location}</InfoItem>
              )}
              <InfoItem label={tJobs("country")}>
                {countryName(job.country, locale)}
              </InfoItem>
              <InfoItem label={tJobs("created")}>
                {date(job.created_at) ?? job.created_at}
              </InfoItem>
              <InfoItem label={t("updatedAt")}>
                {date(job.updated_at) ?? job.updated_at}
              </InfoItem>
              {job.description && (
                <InfoItem label={tJobs("descriptionLabel")} wide>
                  {job.description}
                </InfoItem>
              )}
            </InfoGrid>
          </DashboardCard>

          <DashboardCard
            title={t("requests")}
            action={
              <span className="text-[12px] tabular-nums text-ink-500">
                {requests.length}
              </span>
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
                          {occupation && (
                            <>
                              <bdi>{occupation}</bdi>
                              {" · "}
                            </>
                          )}
                          {tRequests("submitted")}: {date(request.created_at)}
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
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
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
          <DashboardCard title={tCompanies("company")}>
            <Link
              href={`/admin/companies/${job.company_id}`}
              className="-mx-2 flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-sunken"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-5 text-ink-900">
                  <bdi>{job.companies?.name ?? "—"}</bdi>
                </span>
                {job.companies?.city && (
                  <span className="mt-0.5 block text-[12px] leading-4 text-ink-500">
                    <bdi>{job.companies.city}</bdi>
                  </span>
                )}
              </span>
              {chevron}
            </Link>
          </DashboardCard>
        </div>
      </div>

      <p className="t-meta mt-5 max-w-2xl">{t("ownershipNote")}</p>
    </div>
  );
}
