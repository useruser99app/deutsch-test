import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadJob, loadRequestCountsByJob } from "@/lib/jobs-data";
import { loadMarketplace } from "@/lib/employer-data";
import { rankCandidatesForJob, candidateTypeForJob } from "@/lib/matching";
import {
  countryName,
  formatDateValue,
} from "@/components/ui/useValueFormatter";
import Icon from "@/components/shell/Icon";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/button";
import DashboardCard from "@/components/dashboard/DashboardCard";
import CandidateAvatar from "@/components/marketplace/CandidateAvatar";
import FitSummary from "@/components/employer/FitSummary";
import JobForm from "@/components/employer/JobForm";

const trackTile = {
  apprenticeship: "bg-track-apprenticeship-soft text-track-apprenticeship",
  skilled_position: "bg-track-skilled-soft text-track-skilled",
} as const;

/**
 * One vacancy in the Design System 2.0 language: the facts in the main
 * column, the recruiting context beside them. The suitable-candidate list
 * is the same calculation as before — published, anonymized profiles of the
 * matching type, ranked by the unchanged matching function.
 */
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
  const candidateType = candidateTypeForJob(job.job_type);
  const [{ rows }, requestCounts] = await Promise.all([
    loadMarketplace(supabase, { candidateType }),
    loadRequestCountsByJob(supabase, [job.id]),
  ]);
  const ranked = rankCandidatesForJob(job, rows);
  const requests = requestCounts.get(job.id) ?? 0;

  const isApprenticeship = job.job_type === "apprenticeship";
  const date = (v: string | null) => formatDateValue(v, locale);
  const place = [job.location, countryName(job.country, locale)].filter(
    (part): part is string => Boolean(part),
  );
  type Fact = { label: string; value: React.ReactNode; icon: FactIconName };
  const facts: Fact[] = [];
  if (job.profession_or_training_occupation) {
    facts.push({
      label: isApprenticeship ? t("targetOccupation") : tFields("profession"),
      value: <bdi>{job.profession_or_training_occupation}</bdi>,
      icon: "occupation",
    });
  }
  if (job.required_german_level) {
    facts.push({
      label: t("factGerman"),
      value: <bdi>{job.required_german_level}</bdi>,
      icon: "language",
    });
  }
  if (!isApprenticeship && job.minimum_experience_years !== null) {
    facts.push({
      label: t("factExperience"),
      value: tMkt("years", { count: job.minimum_experience_years }),
      icon: "experience",
    });
  }
  if (job.training_start_date) {
    facts.push({
      label: isApprenticeship ? t("trainingStart") : t("factEntry"),
      value: date(job.training_start_date) ?? job.training_start_date,
      icon: "calendar",
    });
  }
  if (job.employment_type) {
    facts.push({
      label: t("employmentType"),
      value: tEnums.has(`employmentType.${job.employment_type}`)
        ? tEnums(`employmentType.${job.employment_type}`)
        : job.employment_type,
      icon: "employment",
    });
  }
  facts.push({
    label: t("factLocation"),
    value: place.map((part, index) => (
      <span key={part}>
        {index > 0 && ", "}
        <bdi>{part}</bdi>
      </span>
    )),
    icon: "location",
  });

  // The marketplace with this vacancy as its matching context.
  const marketplaceHref = `/employer/candidates?type=${candidateType}&job=${job.id}`;

  return (
    <div data-shell="wide">
      <PageHeader
        title={job.title}
        breadcrumb={
          <Link
            href="/employer/jobs"
            className="t-meta inline-flex items-center gap-1 hover:text-accent hover:underline"
          >
            <span aria-hidden className="rtl:rotate-180">
              &#8592;
            </span>
            {t("backToList")}
          </Link>
        }
        actions={
          <>
            <Link
              href={editing ? `/employer/jobs/${job.id}` : `/employer/jobs/${job.id}?edit=1`}
              className={buttonClass("secondary", "md")}
            >
              {editing ? t("cancelEdit") : t("edit")}
            </Link>
            {/* The page's primary step, as in the marketplace detail. */}
            <Link href={marketplaceHref} className={buttonClass("primary", "md")}>
              {t("findCandidates")}
            </Link>
          </>
        }
      />

      {/* Status, type and place directly under the title. */}
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <StatusBadge status={job.status} />
        <span
          className={`rounded px-2 py-0.5 text-[12px] font-medium ${trackTile[job.job_type]}`}
        >
          {tEnums(`jobType.${job.job_type}`)}
        </span>
        {place.length > 0 && (
          <span className="text-[13px] text-ink-500">
            {/* Isolated per part, so mixed-script places keep their order. */}
            {place.map((part, index) => (
              <span key={part}>
                {index > 0 && ", "}
                <bdi>{part}</bdi>
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Explicit placement: on a phone the recruiting context follows the
          facts instead of trailing the whole candidate list; from lg it is
          the side column beside both. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,68fr)_minmax(19rem,32fr)] lg:grid-rows-[auto_1fr] lg:items-start">
        {/* ---- Facts --------------------------------------------------- */}
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          {editing ? (
            <DashboardCard title={t("edit")}>
              <JobForm job={job} />
            </DashboardCard>
          ) : (
            <>
              <DashboardCard title={t("requirements")}>
                {/* One compact fact strip, as in the marketplace detail:
                    icon, short label, value. Only stated facts appear. */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 sm:gap-x-0 lg:grid-cols-4">
                  {facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex min-w-0 items-start gap-2.5 sm:border-s sm:border-hairline sm:px-4 sm:max-lg:[&:nth-child(3n+1)]:border-s-0 sm:max-lg:[&:nth-child(3n+1)]:ps-0 lg:[&:nth-child(4n+1)]:border-s-0 lg:[&:nth-child(4n+1)]:ps-0"
                    >
                      <span aria-hidden className="mt-0.5 shrink-0 text-ink-400">
                        <FactIcon name={fact.icon} />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[12px] leading-4 text-ink-500">{fact.label}</dt>
                        <dd className="mt-0.5 break-words text-[14px] font-medium leading-5 text-ink-900">
                          {fact.value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </DashboardCard>

              {job.description && (
                <DashboardCard title={t("descriptionLabel")}>
                  <p className="t-body max-w-[75ch] whitespace-pre-line text-ink-800">
                    <bdi>{job.description}</bdi>
                  </p>
                </DashboardCard>
              )}
            </>
          )}
        </div>

        {/* ---- Recruiting context -------------------------------------- */}
        <div className="space-y-5 lg:sticky lg:top-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <DashboardCard title={t("recruiting")} bleed>
            <Link
              href="/employer/requests"
              className="flex items-center gap-3 border-b border-hairline px-5 py-3.5 transition-colors hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"
              >
                <Icon name="requests" className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.5rem] font-semibold leading-7 tabular-nums tracking-[-0.02em] text-ink-900">
                  {requests}
                </span>
                <span className="block text-[12px] leading-4 text-ink-500">
                  {t("linkedRequests")}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-medium text-accent">
                {t("viewRequests")}
              </span>
            </Link>

            <div className="px-5 py-3.5">
              <p className="text-[13px] leading-5 text-ink-700">
                {t("matchingProfiles", { count: ranked.length })}
              </p>
              <Link
                href={marketplaceHref}
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              >
                {t("openInMarketplace")}
                <span aria-hidden className="rtl:rotate-180">
                  &#8594;
                </span>
              </Link>
            </div>
          </DashboardCard>

          <DashboardCard title={t("basics")}>
            <dl className="space-y-2.5 text-[13px] leading-5">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{t("status")}</dt>
                <dd>
                  <StatusBadge status={job.status} size="sm" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{t("jobType")}</dt>
                <dd className="text-end font-medium text-ink-900">
                  {tEnums(`jobType.${job.job_type}`)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{t("created")}</dt>
                <dd className="text-end font-medium text-ink-900">{date(job.created_at)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{t("updated")}</dt>
                <dd className="text-end font-medium text-ink-900">{date(job.updated_at)}</dd>
              </div>
            </dl>
          </DashboardCard>
        </div>
        {/* ---- Suitable candidates ------------------------------------- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <DashboardCard
            title={t("suitableCandidates")}
            action={
              <span className="text-[12px] tabular-nums text-ink-500">
                {ranked.length}
              </span>
            }
            bleed
          >
            <p className="border-b border-hairline px-5 py-2.5 text-[12px] leading-4 text-ink-500">
              {tFit("explanation")}
            </p>
            {ranked.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState message={t("noCandidates")} compact />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {ranked.map(({ candidate, fit }) => (
                  <li key={candidate.profile_id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <CandidateAvatar
                        candidateCode={candidate.candidate_code}
                        candidateType={candidate.candidate_type}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-5 text-ink-900">
                              <bdi>{candidate.headline_occupation ?? tMkt("noOccupation")}</bdi>
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] leading-4 text-ink-500">
                              <span className="font-mono">
                                <bdi>{candidate.candidate_code}</bdi>
                              </span>
                              <span>
                                {tEnums(`candidateType.${candidate.candidate_type}`)}
                              </span>
                            </p>
                          </div>
                          <Link
                            href={`/employer/candidates/${candidate.profile_id}?job=${job.id}`}
                            className="shrink-0 text-[13px] font-medium text-accent hover:underline"
                          >
                            {tMkt("viewProfile")}
                          </Link>
                        </div>
                        <div className="mt-3 max-w-[70ch]">
                          <FitSummary fit={fit} />
                        </div>
                      </div>
                    </div>
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

type FactIconName =
  | "occupation"
  | "language"
  | "experience"
  | "calendar"
  | "employment"
  | "location";

const factPaths: Record<FactIconName, React.ReactNode> = {
  occupation: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  language: <path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.7A8 8 0 1 1 21 12z" />,
  experience: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  employment: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
};

function FactIcon({ name }: { name: FactIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      {factPaths[name]}
    </svg>
  );
}
