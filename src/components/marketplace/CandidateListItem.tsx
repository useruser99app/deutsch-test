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
 * Built for scanning: the occupation is the loudest element, the facts sit
 * on one quiet line below it, and the row carries no name, photo or contact
 * detail — the candidate code is the identity an employer works with.
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

  // Only facts that actually exist are shown — no "—" filler.
  const facts: { label: string; value: string }[] = [
    { label: tFields("german_level"), value: candidate.german_level },
  ];

  if (candidate.country) {
    facts.push({
      label: t("location"),
      value: countryName(candidate.country, locale),
    });
  }

  const when = formatDate(
    isApprenticeship
      ? candidate.desired_training_start
      : candidate.availability_date
  );
  if (when) {
    facts.push({
      label: isApprenticeship
        ? tFields("desired_training_start")
        : tFields("availability_date"),
      value: when,
    });
  }

  if (!isApprenticeship && candidate.years_experience !== null) {
    facts.push({
      label: tFields("years_experience"),
      value: t("years", { count: candidate.years_experience }),
    });
  }
  if (isApprenticeship && candidate.has_practical_experience) {
    facts.push({ label: t("practicalExperience"), value: t("yes") });
  }

  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={`group relative block border-b border-hairline px-4 py-3.5 transition-colors last:border-b-0 ${
          selected ? "bg-accent-soft/60" : "hover:bg-surface-sunken"
        }`}
      >
        {/* The selected row is marked by a solid inline-start rail as well
            as by ground colour, so the state survives RTL and low contrast. */}
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
              {requestStatus && <StatusBadge status={requestStatus} size="sm" />}
            </div>

            {/* Canonical German occupation, bidi-isolated so it reads
                correctly inside Arabic copy and is never translated. */}
            <p className="t-entity mt-1 group-hover:text-accent">
              <bdi>{candidate.headline_occupation ?? t("noOccupation")}</bdi>
            </p>

            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex flex-wrap items-baseline gap-x-1.5"
                >
                  <dt className="t-meta">{fact.label}:</dt>
                  <dd className="text-sm font-medium text-ink-800">
                    <bdi>{fact.value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>

            {/* Only shown when a vacancy was chosen: without one there is
                nothing real to compare against, and an invented band would
                be worse than no band. */}
            {fit && (
              <div className="mt-2">
                <FitSummary fit={fit} compact />
              </div>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
