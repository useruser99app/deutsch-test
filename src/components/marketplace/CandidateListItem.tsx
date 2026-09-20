import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/components/ui/useValueFormatter";
import StatusBadge from "@/components/ui/StatusBadge";
import CandidateAvatar from "@/components/marketplace/CandidateAvatar";
import FitSummary from "@/components/employer/FitSummary";
import type { EmployerCandidate } from "@/lib/employer-data";
import type { FitResult } from "@/lib/matching";

/**
 * One anonymized candidate in the marketplace list.
 *
 * Three levels, in the order a recruiter reads them: the occupation first,
 * the identity of the record second (code and track), the deciding facts
 * third — country, German, start date — on a single middot-separated line
 * rather than as label/value pairs, which cost a line each and say nothing
 * a recruiter does not already know how to read.
 *
 * Status and fit sit together on the end edge, so "where does this stand"
 * and "does this fit" are answered in one glance without scanning the row.
 *
 * The whole row is the link. Selecting a candidate is a navigation, which
 * is what keeps the two-column layout free of client state.
 */
export default function CandidateListItem({
  candidate,
  href,
  selected,
  locale,
  formatDate,
  fit,
  requestStatus,
}: {
  candidate: EmployerCandidate;
  href: string;
  selected: boolean;
  locale: string;
  formatDate: (value: string | null) => string | null;
  /** Present only when the employer picked a vacancy to compare against. */
  fit?: FitResult;
  /** The company's own open request for this candidate, if there is one. */
  requestStatus?: string;
}) {
  const t = useTranslations("employer.marketplace");
  const tEnums = useTranslations("enums");
  const tFields = useTranslations("fields");
  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";

  // Level 3 — only facts that exist. No "—" filler, no empty pairs.
  const facts: string[] = [];
  if (candidate.country) facts.push(countryName(candidate.country, locale));
  facts.push(`${tFields("german_level")} ${candidate.german_level}`);

  const when = formatDate(
    isApprenticeship
      ? candidate.desired_training_start
      : candidate.availability_date,
  );
  if (when) facts.push(`${t("fromDate")} ${when}`);

  if (!isApprenticeship && candidate.years_experience !== null) {
    facts.push(t("years", { count: candidate.years_experience }));
  }
  if (isApprenticeship && candidate.has_practical_experience) {
    facts.push(t("practicalExperience"));
  }

  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={`group relative block border-b border-hairline px-4 py-3 transition-colors last:border-b-0 ${
          selected ? "bg-accent-soft/55" : "hover:bg-surface-sunken"
        }`}
      >
        {/* The selected row is marked by a rail on the inline-start edge as
            well as by ground colour: clear, but not a highlighter. */}
        <span
          aria-hidden
          className={`absolute inset-y-0 start-0 w-[3px] ${
            selected ? "bg-accent" : "bg-transparent"
          }`}
        />

        <div className="flex items-start gap-3">
          <CandidateAvatar
            candidateCode={candidate.candidate_code}
            candidateType={candidate.candidate_type}
          />

          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-[17rem]">
              {/* Level 1 — canonical German occupation, bidi-isolated so it
                  reads correctly inside Arabic copy and is never translated. */}
              <p className="mk-title truncate group-hover:text-accent">
                <bdi>{candidate.headline_occupation ?? t("noOccupation")}</bdi>
              </p>

              {/* Level 2 — which record this is. */}
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

              {/* Level 3 — the deciding facts, one line. */}
              <p className="mk-meta mt-1">
                {facts.map((fact, index) => (
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
            </div>

            {/* Status and fit, grouped on the end edge. */}
            {(requestStatus || fit) && (
              <div className="flex shrink-0 basis-full flex-col items-start gap-1.5 sm:basis-auto sm:max-w-[13.5rem] sm:items-end sm:text-end">
                {requestStatus && (
                  <StatusBadge status={requestStatus} size="sm" />
                )}
                {fit && <FitSummary fit={fit} compact />}
              </div>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
