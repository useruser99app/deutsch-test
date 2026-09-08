import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CandidateRef as CandidateRefData } from "@/lib/admin-data";

/** Compact, type-aware candidate identifier used across the admin queues. */
export default function CandidateRef({
  candidate,
  candidateId,
}: {
  candidate: CandidateRefData | null;
  candidateId?: string;
}) {
  const tEnums = useTranslations("enums");

  if (!candidate) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";
  const label = tEnums(`candidateType.${candidate.candidate_type}`);
  const name = `${candidate.first_name} ${candidate.last_name}`;

  const content = (
    <>
      <span className="font-mono text-sm font-medium text-gray-900">
        {candidate.candidate_code}
      </span>
      <span className="text-sm text-gray-700">{name}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          isApprenticeship
            ? "bg-indigo-100 text-indigo-800"
            : "bg-teal-100 text-teal-800"
        }`}
      >
        {label}
      </span>
    </>
  );

  if (!candidateId) {
    return <span className="flex flex-wrap items-center gap-2">{content}</span>;
  }

  return (
    <Link
      href={`/admin/candidates/${candidateId}`}
      className="flex flex-wrap items-center gap-2 hover:underline"
    >
      {content}
    </Link>
  );
}
