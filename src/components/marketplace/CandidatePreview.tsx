import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  countryName,
  formatDateValue,
} from "@/components/ui/useValueFormatter";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonClass } from "@/components/ui/button";
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
  const tIntro = useTranslations("employer.introduction");

  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";
  const isPanel = variant === "panel";
  // Anchor for the header CTA. Unique per profile so two panels on one
  // page could never fight over the same id.
  const requestAnchor = `introduction-${candidate.profile_id}`;

  const date = (value: string | null) => formatDateValue(value, locale);
  const list = (values: string[] | null) =>
    values && values.length > 0 ? values.join(", ") : null;
  const bool = (value: boolean | null) =>
    value === null ? null : value ? t("yes") : t("no");

  /**
   * ONE list of facts, not three sections.
   *
   * With a thin profile the old grouping produced three headed blocks of
   * two rows each — a datasheet. The hierarchy that matters is type
   * specific and lives in the ORDER: for an Ausbildung candidate the
   * target occupation and school background lead, and years of
   * professional experience are deliberately not the quality indicator.
   * Anything without a value is dropped, so nothing is padded out.
   */
  const facts: { label: string; value: string | null; wide?: boolean }[] =
    isApprenticeship
      ? [
          {
            label: tFields("target_occupations"),
            value: list(candidate.target_occupations),
            wide: true,
          },
          {
            label: tFields("desired_training_start"),
            value: date(candidate.desired_training_start),
          },
          {
            label: tDetail("practicalExperience"),
            value: bool(candidate.has_practical_experience),
          },
          {
            label: tFields("school_qualification"),
            value: candidate.school_qualification,
          },
          {
            label: tFields("graduation_year"),
            value: candidate.graduation_year?.toString() ?? null,
          },
          {
            label: tFields("school_specialization"),
            value: candidate.school_specialization,
            wide: true,
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
                `certificateStatus.${candidate.german_certificate_status}`,
              )
                ? tEnums(
                    `certificateStatus.${candidate.german_certificate_status}`,
                  )
                : candidate.german_certificate_status,
          },
          {
            label: tFields("preferred_locations"),
            value: list(candidate.preferred_locations),
            wide: true,
          },
          {
            label: tFields("relocation_ready"),
            value: bool(candidate.relocation_ready),
          },
        ]
      : [
          { label: tFields("profession"), value: candidate.profession },
          { label: tFields("specialization"), value: candidate.specialization },
          {
            label: tFields("years_experience"),
            value:
              candidate.years_experience === null
                ? null
                : t("years", { count: candidate.years_experience }),
          },
          {
            label: tFields("highest_qualification"),
            value: candidate.highest_qualification,
          },
          {
            label: tDetail("skills"),
            value: list(candidate.skills),
            wide: true,
          },
          {
            label: tFields("preferred_positions"),
            value: list(candidate.preferred_positions),
            wide: true,
          },
          {
            label: tFields("availability_date"),
            value: date(candidate.availability_date),
          },
          {
            label: tFields("relocation_ready"),
            value: bool(candidate.relocation_ready),
          },
          {
            label: tFields("preferred_locations"),
            value: list(candidate.preferred_locations),
            wide: true,
          },
        ];

  const shownFacts = facts.filter((fact) => fact.value);

  const narrativeBlocks = [
    { label: tDetail("summary"), value: narrative?.public_summary },
    { label: tDetail("education"), value: narrative?.education_summary },
    { label: tDetail("experience"), value: narrative?.experience_summary },
    { label: tDetail("motivation"), value: narrative?.motivation_summary },
  ].filter((block) => block.value);

  // Header facts — the same three an employer scans in the list, so the
  // panel confirms the row rather than restating it in another shape.
  const headerFacts: string[] = [];
  if (candidate.country) {
    headerFacts.push(countryName(candidate.country, locale));
  }
  headerFacts.push(`${tFields("german_level")} ${candidate.german_level}`);
  const startsOn = date(
    isApprenticeship
      ? candidate.desired_training_start
      : candidate.availability_date,
  );
  if (startsOn) headerFacts.push(`${t("fromDate")} ${startsOn}`);

  return (
    <article className="overflow-hidden rounded-card border border-hairline-strong bg-surface shadow-card">
      <header className="border-b border-hairline bg-surface-sunken px-5 py-4">
        {backHref && (
          // Mobile only: on desktop the list is right next to the panel.
          <Link
            href={backHref}
            className="t-meta mb-3 inline-flex items-center gap-1 hover:text-accent lg:hidden"
          >
            <span aria-hidden className="rtl:rotate-180">
              &#8592;
            </span>
            {tDetail("backToList")}
          </Link>
        )}

        <div className="flex items-start gap-3.5">
          <CandidateAvatar
            candidateCode={candidate.candidate_code}
            candidateType={candidate.candidate_type}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <h2 className={isPanel ? "mk-title-lg" : "t-page-title"}>
                <bdi>{candidate.headline_occupation ?? t("noOccupation")}</bdi>
              </h2>
              {/* The ONE place the request state is shown. The block at the
                  foot of the panel is omitted entirely when it is set, so
                  the same status can never appear twice. */}
              {activeRequest && <StatusBadge status={activeRequest.status} />}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="t-meta font-mono">
                <bdi>{candidate.candidate_code}</bdi>
              </span>
              <span aria-hidden className="t-meta">
                ·
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isApprenticeship
                    ? "text-track-apprenticeship"
                    : "text-track-skilled"
                }`}
              >
                {tEnums(`candidateType.${candidate.candidate_type}`)}
              </span>
            </div>

            <p className="mk-meta mt-1.5">
              {headerFacts.map((fact, index) => (
                <span key={fact}>
                  {index > 0 && (
                    <span aria-hidden className="mx-1.5 text-ink-300">
                      ·
                    </span>
                  )}
                  <bdi>{fact}</bdi>
                </span>
              ))}
            </p>

            {narrative?.public_title && (
              <p className="mk-value mt-1.5 text-ink-700">
                <bdi>{narrative.public_title}</bdi>
              </p>
            )}
          </div>
        </div>

        {/* One primary action, or — when a request is already open — what
            that request is waiting on, in its place. */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {activeRequest ? (
            <p className="mk-meta">
              {tIntro.has(`statusNote.${activeRequest.status}`)
                ? tIntro(`statusNote.${activeRequest.status}`)
                : tIntro("alreadySent")}
              {activeRequest.jobs?.title && (
                <>
                  {" · "}
                  <bdi>{activeRequest.jobs.title}</bdi>
                </>
              )}
              <span className="block text-ink-400">
                {tDetail("anonymousShort")}
              </span>
            </p>
          ) : (
            <a
              href={`#${requestAnchor}`}
              className={buttonClass("primary", "sm")}
            >
              {tIntro("cta")}
            </a>
          )}
          {fullProfileHref && (
            <Link
              href={fullProfileHref}
              className={buttonClass("secondary", "sm")}
            >
              {tDetail("openFullProfile")}
            </Link>
          )}
        </div>
      </header>

      {/* Matching against the chosen vacancy. The band and the evidence
          line come straight from the existing evaluation — no percentage,
          because the score says nothing about how much was compared. */}
      {fit && (
        <section className="border-b border-hairline bg-teal-soft/50 px-5 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="mk-section">{t("fitForJob")}</h3>
            {jobTitle && (
              <span className="mk-meta">
                <bdi>{jobTitle}</bdi>
              </span>
            )}
          </div>
          <div className="mt-2">
            <FitSummary fit={fit} emphasis />
          </div>
          <p className="t-meta mt-2.5">{tFit("explanation")}</p>
        </section>
      )}

      <div className="px-5 py-4">
        {/* One grid, no heading above it: with a thin profile a heading per
            pair was more chrome than content. */}
        {shownFacts.length > 0 && (
          <dl
            className={`grid gap-x-6 gap-y-3 ${
              isPanel ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {shownFacts.map((fact) => (
              <div
                key={fact.label}
                className={`min-w-0 ${
                  fact.wide
                    ? isPanel
                      ? "col-span-2"
                      : "sm:col-span-2 lg:col-span-3"
                    : ""
                }`}
              >
                <dt className="mk-label">{fact.label}</dt>
                <dd className="mk-value mt-0.5 break-words font-medium">
                  <bdi>{fact.value}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Approved employer-language prose only. Nothing is machine
            translated and no unapproved source-language text is shown.
            Separated by space rather than by another ruled section. */}
        {narrativeBlocks.length > 0 ? (
          <div
            className={`space-y-3 ${shownFacts.length > 0 ? "mt-4 border-t border-hairline pt-4" : ""}`}
          >
            {narrativeBlocks.map((block) => (
              <div key={block.label}>
                <p className="mk-label">{block.label}</p>
                <p className="mt-0.5 max-w-[68ch] text-sm leading-[1.35rem] text-ink-700">
                  <bdi>{block.value}</bdi>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p
            className={`t-meta ${shownFacts.length > 0 ? "mt-4 border-t border-hairline pt-3" : ""}`}
          >
            {tDetail("noNarrative")}
          </p>
        )}
      </div>

      {/* The existing introduction workflow, unchanged. Rendered only when
          there is no open request — when there is one, its state already
          sits in the header and a second box would just repeat it. */}
      {!activeRequest && (
        <section
          id={requestAnchor}
          className="scroll-mt-4 border-t border-hairline px-5 py-4"
        >
          <IntroductionRequestForm
            profileId={candidate.profile_id}
            jobs={jobs}
            preselectedJobId={preselectedJobId}
          />
        </section>
      )}
    </article>
  );
}
