import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadJob } from "@/lib/jobs-data";
import { loadMarketplace } from "@/lib/employer-data";
import { rankCandidatesForJob, candidateTypeForJob } from "@/lib/matching";
import { formatDateValue } from "@/components/ui/useValueFormatter";
import { trackClass } from "@/components/ui/CandidateIdentity";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import FitSummary from "@/components/employer/FitSummary";
import JobForm from "@/components/employer/JobForm";
import { InfoGrid, InfoItem } from "@/components/ui/InfoGrid";

export default async function EmployerJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const sp = await searchParams;
  const editing = (Array.isArray(sp.edit) ? sp.edit[0] : sp.edit) === "1";

  // RLS scopes this to the employer's own company: another company's job
  // simply does not exist for this session.
  const job = await loadJob(supabase, jobId);
  if (!job) notFound();

  const t = await getTranslations("employer.jobs");
  const tFit = await getTranslations("employer.fit");
  const tMkt = await getTranslations("employer.marketplace");
  const tEnums = await getTranslations("enums");
  const tFields = await getTranslations("fields");

  // Only PUBLISHED, anonymized profiles of the matching candidate type ever
  // enter the calculation — the same view the marketplace uses.
  const { rows } = await loadMarketplace(supabase, {
    candidateType: candidateTypeForJob(job.job_type),
  });
  const ranked = rankCandidatesForJob(job, rows);

  const isApprenticeship = job.job_type === "apprenticeship";
  const date = (v: string | null) => formatDateValue(v, locale);

  return (
    <>
      <PageHeader
        title={job.title}
        description={tEnums(`jobType.${job.job_type}`)}
        breadcrumb={
          <Link href="/employer/jobs" className="t-meta hover:text-accent hover:underline">
            {t("backToList")}
          </Link>
        }
        actions={
          <>
            <StatusBadge status={job.status} />
            <Link
              href={editing ? `/employer/jobs/${job.id}` : `/employer/jobs/${job.id}?edit=1`}
              className="text-sm font-medium text-accent hover:underline"
            >
              {editing ? t("cancelEdit") : t("edit")}
            </Link>
          </>
        }
      />

      {editing ? (
        <Panel title={t("edit")}>
          <JobForm job={job} />
        </Panel>
      ) : (
        <Panel title={t("requirements")}>
          <InfoGrid columns={3}>
            {job.profession_or_training_occupation && (
              <InfoItem label={isApprenticeship ? t("targetOccupation") : tFields("profession")}>
                {job.profession_or_training_occupation}
              </InfoItem>
            )}
            {job.required_german_level && (
              <InfoItem label={t("requiredGerman")}>{job.required_german_level}</InfoItem>
            )}
            {job.training_start_date && (
              <InfoItem label={isApprenticeship ? t("trainingStart") : t("entryDate")}>
                {date(job.training_start_date) ?? job.training_start_date}
              </InfoItem>
            )}
            {!isApprenticeship && job.minimum_experience_years !== null && (
              <InfoItem label={t("minExperience")}>
                {tMkt("years", { count: job.minimum_experience_years })}
              </InfoItem>
            )}
            {job.location && <InfoItem label={t("location")}>{job.location}</InfoItem>}
            <InfoItem label={t("country")}>{job.country}</InfoItem>
            {job.description && (
              <InfoItem label={t("descriptionLabel")} wide>{job.description}</InfoItem>
            )}
          </InfoGrid>
        </Panel>
      )}

      <div className="mt-5">
        <Panel
          title={t("suitableCandidates")}
          description={tFit("explanation")}
          action={
            <Link
              href={`/employer/candidates?type=${candidateTypeForJob(job.job_type)}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              {tMkt("title")}
            </Link>
          }
          bleed
        >
          {ranked.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noCandidates")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {ranked.map(({ candidate, fit }) => (
                <li key={candidate.profile_id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="t-meta font-mono"><bdi>{candidate.candidate_code}</bdi></span>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${trackClass(candidate.candidate_type)}`}>
                          {tEnums(`candidateType.${candidate.candidate_type}`)}
                        </span>
                      </div>
                      <p className="t-entity mt-1">
                        <bdi>{candidate.headline_occupation ?? tMkt("noOccupation")}</bdi>
                      </p>
                    </div>
                    <Link
                      href={`/employer/candidates/${candidate.profile_id}?job=${job.id}`}
                      className="shrink-0 text-sm font-medium text-accent hover:underline"
                    >
                      {tMkt("viewProfile")}
                    </Link>
                  </div>
                  <div className="mt-3 max-w-[70ch]">
                    <FitSummary fit={fit} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
