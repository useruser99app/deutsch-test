import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { countryName, formatDateValue } from "@/components/ui/useValueFormatter";
import { InfoGrid, InfoItem } from "@/components/ui/InfoGrid";
import CandidateAvatar from "@/components/marketplace/CandidateAvatar";
import FitSummary from "@/components/employer/FitSummary";
import IntroductionRequestForm from "@/components/employer/IntroductionRequestForm";
import type {
  ActiveRequest,
  EmployerCandidate,
  PublicNarrative,
} from "@/lib/employer-data";
import type { FitResult } from "@/lib/matching";

/**
 * The full presentation of one anonymized candidate.
 *
 * Used twice: as the preview column of the marketplace and as the body of
 * the standalone candidate route. One component rather than two, so the
 * side panel and the full page can never drift apart — and so the route an
 * employer reaches from a vacancy or from their requests list shows exactly
 * what the marketplace showed.
 *
 * Nothing here can reveal identity: it renders the employer-facing view's
 * columns only. There is no name, no photo, no contact detail and no date
 * of birth to render, because none of them is loaded.
 */
export default function CandidatePreview({
  candidate,
  narrative,
  activeRequest,
  jobs,
  locale,
  fit,
  jobTitle,
  preselectedJobId,
  variant = "panel",
  fullProfileHref,
  backHref,
}: {
  candidate: EmployerCandidate;
  narrative: PublicNarrative | null;
  activeRequest: ActiveRequest | null;
  jobs: { id: string; title: string }[];
  locale: string;
  /** Only set when a vacancy was chosen to compare against. */
  fit?: FitResult;
  jobTitle?: string;
  preselectedJobId?: string;
  /** "panel" is the marketplace column, "page" the standalone route. */
  variant?: "panel" | "page";
  /** Shown in the panel: the way to the full, addressable profile. */
  fullProfileHref?: string;
  /** Shown on mobile in the panel: the way back to the list. */
  backHref?: string;
}) {
  const t = useTranslations("employer.marketplace");
  const tDetail = useTranslations("employer.candidate");
  const tFit = useTranslations("employer.fit");
  const tFields = useTranslations("fields");
  const tEnums = useTranslations("enums");

  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";
  const isPanel = variant === "panel";

  const date = (value: string | null) => formatDateValue(value, locale);
  const list = (values: string[] | null) =>
    values && values.length > 0 ? values.join(", ") : null;
  const bool = (value: boolean | null) =>
    value === null ? null : value ? t("yes") : t("no");

  /**
   * Type-specific hierarchy: for an Ausbildung candidate the target
   * occupation and school background lead, and years of professional
   * experience are deliberately NOT the quality indicator.
   */
  const overview: { label: string; value: string | null }[] = isApprenticeship
    ? [
        {
          label: tFields("target_occupations"),
          value: list(candidate.target_occupations),
        },
        {
          label: tFields("desired_training_start"),
          value: date(candidate.desired_training_start),
        },
        { label: tFields("german_level"), value: candidate.german_level },
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

  // A section with nothing in it is dropped entirely: a published profile
  // with thin data stays quiet instead of showing a wall of empty rows.
  const sections = [
    { title: tDetail("goalTitle"), items: overview },
    { title: tDetail("qualificationTitle"), items: qualification },
    { title: tDetail("availabilityTitle"), items: availability },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.value),
    }))
    .filter((section) => section.items.length > 0);

  const narrativeBlocks = [
    { label: tDetail("summary"), value: narrative?.public_summary },
    { label: tDetail("education"), value: narrative?.education_summary },
    { label: tDetail("experience"), value: narrative?.experience_summary },
    { label: tDetail("motivation"), value: narrative?.motivation_summary },
  ].filter((block) => block.value);

  return (
    <article className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <header className="border-b border-hairline bg-surface-sunken p-card">
        {backHref && (
          // Mobile only: on desktop the list is right next to the panel.
          <Link
            href={backHref}
            className="t-meta mb-2.5 inline-flex items-center gap-1 hover:text-accent lg:hidden"
          >
            <span aria-hidden className="rtl:rotate-180">
              &#8592;
            </span>
            {tDetail("backToList")}
          </Link>
        )}

        <div className="flex items-start gap-3">
          <CandidateAvatar
            candidateCode={candidate.candidate_code}
            candidateType={candidate.candidate_type}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="t-meta font-mono">
                <bdi>{candidate.candidate_code}</bdi>
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  isApprenticeship
                    ? "bg-track-apprenticeship-soft text-track-apprenticeship"
                    : "bg-track-skilled-soft text-track-skilled"
                }`}
              >
                {tEnums(`candidateType.${candidate.candidate_type}`)}
              </span>
            </div>
            <h2 className={`${isPanel ? "t-entity" : "t-page-title"} mt-1`}>
              <bdi>{candidate.headline_occupation ?? t("noOccupation")}</bdi>
            </h2>
            {narrative?.public_title && (
              <p className="t-value mt-0.5 font-medium">
                <bdi>{narrative.public_title}</bdi>
              </p>
            )}
          </div>
        </div>

        <p className="t-meta mt-2.5">{tDetail("anonymousNote")}</p>

        {fullProfileHref && (
          <Link
            href={fullProfileHref}
            className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
          >
            {tDetail("openFullProfile")}
          </Link>
        )}
      </header>

      {/* Matching against the chosen vacancy. The band and the evidence line
          come straight from the existing evaluation — no percentage is shown
          because the score says nothing about how much was compared. */}
      {fit && (
        <section className="border-b border-hairline bg-teal-soft/40 p-card">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="t-section-label">{t("fitForJob")}</h3>
            {jobTitle && (
              <span className="t-meta">
                <bdi>{jobTitle}</bdi>
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <FitSummary fit={fit} />
          </div>
          <p className="t-meta mt-2.5">{tFit("explanation")}</p>
        </section>
      )}

      <div className="divide-y divide-hairline">
        {sections.map((section) => (
          <section key={section.title} className="p-card">
            <h3 className="t-section-label mb-3">{section.title}</h3>
            <InfoGrid columns={isPanel ? 2 : 3}>
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
          <section className="p-card">
            <h3 className="t-section-label mb-3">{tDetail("narrativeTitle")}</h3>
            <div className="space-y-3.5">
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
          <section className="p-card">
            <p className="t-meta">{tDetail("noNarrative")}</p>
          </section>
        )}

        {/* The existing introduction workflow, unchanged. When an open
            request exists the form shows its status instead of offering a
            second primary action. */}
        <section className="p-card">
          <IntroductionRequestForm
            profileId={candidate.profile_id}
            existingStatus={activeRequest?.status}
            existingJobTitle={activeRequest?.jobs?.title ?? null}
            jobs={jobs}
            preselectedJobId={preselectedJobId}
          />
        </section>
      </div>
    </article>
  );
}
