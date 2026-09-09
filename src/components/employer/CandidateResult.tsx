import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/components/ui/useValueFormatter";
import { trackClass } from "@/components/ui/CandidateIdentity";
import type { EmployerCandidate } from "@/lib/employer-data";

/**
 * One anonymized candidate in the marketplace list (§10).
 *
 * Built for scanning, not for decoration: the professional headline is the
 * loudest element, the supporting facts sit on one quiet line, and the
 * candidate code identifies the person instead of a name. This is a
 * recruiting surface, so it deliberately does not reuse the admin table.
 */
export default function CandidateResult({
  candidate,
  locale,
  formatDate,
}: {
  candidate: EmployerCandidate;
  locale: string;
  formatDate: (value: string | null) => string | null;
}) {
  const t = useTranslations("employer.marketplace");
  const tEnums = useTranslations("enums");
  const tFields = useTranslations("fields");
  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";

  // Only facts that actually exist are shown — no "—" filler rows (§20).
  const facts: { label: string; value: string }[] = [];

  facts.push({
    label: tFields("german_level"),
    value: candidate.german_level,
  });

  if (isApprenticeship) {
    const start = formatDate(candidate.desired_training_start);
    if (start) {
      facts.push({ label: tFields("desired_training_start"), value: start });
    }
    if (candidate.school_qualification) {
      facts.push({
        label: tFields("school_qualification"),
        value: candidate.school_qualification,
      });
    }
    if (candidate.has_practical_experience) {
      facts.push({ label: t("practicalExperience"), value: t("yes") });
    }
  } else {
    if (candidate.years_experience !== null) {
      facts.push({
        label: tFields("years_experience"),
        value: t("years", { count: candidate.years_experience }),
      });
    }
    if (candidate.highest_qualification) {
      facts.push({
        label: tFields("highest_qualification"),
        value: candidate.highest_qualification,
      });
    }
    const available = formatDate(candidate.availability_date);
    if (available) {
      facts.push({ label: tFields("availability_date"), value: available });
    }
  }

  if (candidate.country) {
    facts.push({
      label: t("location"),
      value: countryName(candidate.country, locale),
    });
  }
  if (candidate.relocation_ready) {
    facts.push({ label: tFields("relocation_ready"), value: t("yes") });
  }

  return (
    <li className="px-5 py-4 transition-colors hover:bg-ink-50">
      <div className="flex items-start justify-between gap-x-4 gap-y-3">
        {/* flex-1 keeps the facts wrapping inside their own column so the
            CTA stays on the end edge instead of jumping sides. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
          </div>

          {/* The professional headline: canonical German value, isolated so
              it reads correctly inside Arabic copy and never translated. */}
          <p className="t-entity mt-1.5">
            <bdi>{candidate.headline_occupation ?? t("noOccupation")}</bdi>
          </p>

          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline gap-1.5">
                <dt className="t-meta">{fact.label}:</dt>
                <dd className="text-sm font-medium text-ink-800">
                  <bdi>{fact.value}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <Link
          href={`/employer/candidates/${candidate.profile_id}`}
          className="shrink-0 text-sm font-medium text-accent hover:underline"
        >
          {t("viewProfile")}
        </Link>
      </div>
    </li>
  );
}
