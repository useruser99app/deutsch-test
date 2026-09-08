import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface CandidateIdentityData {
  candidate_code: string;
  first_name: string;
  last_name: string;
  candidate_type: string;
}

/** Muted track colours — differentiated, not decorative. */
export function trackClass(candidateType: string): string {
  return candidateType === "apprenticeship_candidate"
    ? "bg-track-apprenticeship-soft text-track-apprenticeship"
    : "bg-track-skilled-soft text-track-skilled";
}

/**
 * Candidate identity with the NAME as the primary, obvious link (§21) and the
 * code plus type as secondary metadata beneath it.
 */
export default function CandidateIdentity({
  candidate,
  candidateId,
  secondary,
  size = "md",
}: {
  candidate: CandidateIdentityData | null;
  candidateId?: string;
  /** Extra metadata line, e.g. the e-mail address. */
  secondary?: string;
  size?: "sm" | "md";
}) {
  const tEnums = useTranslations("enums");

  if (!candidate) {
    return <span className="t-meta">—</span>;
  }

  const name = `${candidate.first_name} ${candidate.last_name}`;
  const nameClass =
    size === "sm"
      ? "text-sm font-semibold text-ink-900"
      : "t-entity";

  return (
    <div className="min-w-0">
      {candidateId ? (
        <Link
          href={`/admin/candidates/${candidateId}`}
          className={`${nameClass} hover:text-accent hover:underline`}
        >
          {name}
        </Link>
      ) : (
        <span className={nameClass}>{name}</span>
      )}

      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {candidateId ? (
          <Link
            href={`/admin/candidates/${candidateId}`}
            className="t-meta font-mono hover:text-accent hover:underline"
          >
            {candidate.candidate_code}
          </Link>
        ) : (
          <span className="t-meta font-mono">{candidate.candidate_code}</span>
        )}
        <span aria-hidden className="t-meta">
          ·
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${trackClass(
            candidate.candidate_type
          )}`}
        >
          {tEnums(`candidateType.${candidate.candidate_type}`)}
        </span>
        {secondary && (
          <>
            <span aria-hidden className="t-meta">
              ·
            </span>
            <span className="t-meta truncate">{secondary}</span>
          </>
        )}
      </div>
    </div>
  );
}
