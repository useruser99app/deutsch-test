import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadActiveRequest,
  loadCompanyJobs,
  loadEmployerCandidate,
  loadPublicNarrative,
} from "@/lib/employer-data";
import {
  countryName,
  formatDateValue,
} from "@/components/ui/useValueFormatter";
import { trackClass } from "@/components/ui/CandidateIdentity";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import { InfoGrid, InfoItem } from "@/components/ui/InfoGrid";
import IntroductionRequestForm from "@/components/employer/IntroductionRequestForm";

export default async function EmployerCandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; profileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, profileId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const sp = await searchParams;
  // Set when the employer came here from one of their vacancies.
  const fromJob = (Array.isArray(sp.job) ? sp.job[0] : sp.job)?.trim();

  // Returns null for anything not published — an unpublished candidate is a
  // 404 for employers, not a hidden page.
  const candidate = await loadEmployerCandidate(supabase, profileId);
  if (!candidate) notFound();

  const [narrative, activeRequest, jobs] = await Promise.all([
    loadPublicNarrative(supabase, profileId, locale),
    loadActiveRequest(supabase, profileId),
    loadCompanyJobs(supabase),
  ]);

  const t = await getTranslations("employer.marketplace");
  const tDetail = await getTranslations("employer.candidate");
  const tFields = await getTranslations("fields");
  const tEnums = await getTranslations("enums");

  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";
  const date = (value: string | null) => formatDateValue(value, locale);
  const list = (values: string[] | null) =>
    values && values.length > 0 ? values.join(", ") : null;
  const bool = (value: boolean | null) =>
    value === null ? null : value ? t("yes") : t("no");

  /**
   * Type-specific hierarchy (§11): for an Ausbildung candidate the target
   * occupation and school background lead, and years of professional
   * experience are deliberately NOT presented as the quality indicator.
   */
  const goal: { label: string; value: string | null }[] = isApprenticeship
    ? [
        {
          label: tFields("target_occupations"),
          value: list(candidate.target_occupations),
        },
        {
          label: tFields("desired_training_start"),
          value: date(candidate.desired_training_start),
        },
        {
          label: tFields("german_level"),
          value: candidate.german_level,
        },
      ]
    : [
        { label: tFields("profession"), value: candidate.profession },
        { label: tFields("specialization"), value: candidate.specialization },
        { label: tFields("german_level"), value: candidate.german_level },
      ];

  const qualification: { label: string; value: string | null }[] =
    isApprenticeship
      ? [
          {
            label: tFields("school_qualification"),
            value: candidate.school_qualification,
          },
          {
            label: tFields("school_specialization"),
            value: candidate.school_specialization,
          },
          {
            label: tFields("graduation_year"),
            value: candidate.graduation_year?.toString() ?? null,
          },
          {
            label: tFields("german_certificate_type"),
            value: candidate.german_certificate_type,
          },
          {
            label: tFields("german_certificate_status"),
            value:
              candidate.german_certificate_status &&
              tEnums.has(
                `certificateStatus.${candidate.german_certificate_status}`
              )
                ? tEnums(
                    `certificateStatus.${candidate.german_certificate_status}`
                  )
                : candidate.german_certificate_status,
          },
          {
            label: tDetail("practicalExperience"),
            value: bool(candidate.has_practical_experience),
          },
        ]
      : [
          {
            label: tFields("highest_qualification"),
            value: candidate.highest_qualification,
          },
          {
            label: tFields("years_experience"),
            value:
              candidate.years_experience === null
                ? null
                : t("years", { count: candidate.years_experience }),
          },
          { label: tDetail("skills"), value: list(candidate.skills) },
          {
            label: tFields("preferred_positions"),
            value: list(candidate.preferred_positions),
          },
        ];

  const availability: { label: string; value: string | null }[] = [
    {
      label: tFields("availability_date"),
      value: date(candidate.availability_date),
    },
    {
      label: tFields("preferred_locations"),
      value: list(candidate.preferred_locations),
    },
    {
      label: tFields("relocation_ready"),
      value: bool(candidate.relocation_ready),
    },
    {
      label: tDetail("region"),
      value: candidate.country ? countryName(candidate.country, locale) : null,
    },
  ];

  // Sections render only the facts that exist — a published profile with a
  // thin section stays quiet instead of showing a wall of empty rows.
  const sections = [
    { title: tDetail("goalTitle"), items: goal },
    { title: tDetail("qualificationTitle"), items: qualification },
    { title: tDetail("availabilityTitle"), items: availability },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => item.value),
  }));

  const narrativeBlocks = [
    { label: tDetail("summary"), value: narrative?.public_summary },
    { label: tDetail("education"), value: narrative?.education_summary },
    { label: tDetail("experience"), value: narrative?.experience_summary },
    { label: tDetail("motivation"), value: narrative?.motivation_summary },
  ].filter((block) => block.value);

  return (
    <>
      <PageHeader
        title={candidate.headline_occupation ?? t("noOccupation")}
        breadcrumb={
          <Link
            href="/employer/candidates"
            className="t-meta hover:text-accent hover:underline"
          >
            {tDetail("backToList")}
          </Link>
        }
      />

      <section className="rounded-lg border border-hairline bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="t-meta font-mono">
            <bdi>{candidate.candidate_code}</bdi>
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${trackClass(
              candidate.candidate_type
            )}`}
          >
            {tEnums(`candidateType.${candidate.candidate_type}`)}
          </span>
          {narrative?.public_title && (
            <span className="t-value font-medium">
              <bdi>{narrative.public_title}</bdi>
            </span>
          )}
        </div>
        <p className="t-meta mt-2">{tDetail("anonymousNote")}</p>
      </section>

      <div className="mt-6">
        <Panel title={tDetail("profileTitle")} bleed>
          <div className="divide-y divide-hairline">
            {sections.map((section) => (
              <section key={section.title} className="px-5 py-5">
                <h3 className="t-section-label mb-3.5">{section.title}</h3>
                <InfoGrid columns={3}>
                  {section.items.map((item) => (
                    <InfoItem key={item.label} label={item.label}>
                      {item.value as string}
                    </InfoItem>
                  ))}
                </InfoGrid>
              </section>
            ))}

            {/* Approved employer-language prose only. Nothing is machine
                translated and no unapproved source-language text is shown. */}
            {narrativeBlocks.length > 0 ? (
              <section className="px-5 py-5">
                <h3 className="t-section-label mb-3.5">
                  {tDetail("narrativeTitle")}
                </h3>
                <div className="space-y-4">
                  {narrativeBlocks.map((block) => (
                    <div key={block.label}>
                      <p className="t-label">{block.label}</p>
                      <p className="t-body mt-0.5 max-w-[68ch]">
                        <bdi>{block.value}</bdi>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="px-5 py-4">
                <p className="t-meta">{tDetail("noNarrative")}</p>
              </section>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <IntroductionRequestForm
          profileId={profileId}
          existingStatus={activeRequest?.status}
          existingJobTitle={activeRequest?.jobs?.title ?? null}
          jobs={jobs}
          preselectedJobId={fromJob}
        />
      </div>
    </>
  );
}
