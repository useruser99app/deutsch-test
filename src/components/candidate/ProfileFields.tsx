import { useTranslations } from "next-intl";
import { useValueFormatter } from "@/components/ui/useValueFormatter";
import { InfoGrid, InfoItem } from "@/components/ui/InfoGrid";
import { approvedValue, type CandidateSnapshot } from "@/lib/candidate-data";
import {
  fieldsForSection,
  type FieldSection,
} from "@/lib/candidate-fields";
import StatusBadge from "@/components/ui/StatusBadge";

/**
 * Approved profile values for one section, laid out as a compact grid.
 * Shared by the candidate dashboard and the admin candidate workspace so
 * both read from the same field registry and formatting rules.
 */
export default function ProfileFields({
  snapshot,
  section,
  pendingValues,
  columns = 3,
}: {
  snapshot: CandidateSnapshot;
  section: FieldSection;
  /** field_key → proposed value, when a proposal is open for that field. */
  pendingValues?: Map<string, unknown>;
  columns?: 2 | 3;
}) {
  const format = useValueFormatter();
  const tFields = useTranslations("fields");
  const t = useTranslations("candidate.dashboard");

  const fields = fieldsForSection(snapshot.candidate.candidate_type, section);
  const showOccupationList =
    section === "occupation" &&
    snapshot.isApprenticeship &&
    snapshot.occupations.length > 0;

  return (
    <InfoGrid columns={columns}>
      {showOccupationList && (
        <InfoItem label={tFields("target_occupations")} wide>
          <ol className="space-y-1.5">
            {snapshot.occupations.map((entry) => (
              <li
                key={entry.occupation}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600 tabular-nums">
                  {entry.rank}
                </span>
                <span className="font-medium text-ink-900">
                  {entry.occupation}
                </span>
                {entry.rank === 1 && (
                  <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                    {t("primaryOccupation")}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </InfoItem>
      )}

      {fields.map((field) => {
        if (field.key === "target_occupations" && showOccupationList) {
          return null;
        }
        const hasPending = pendingValues?.has(field.key) ?? false;

        return (
          <InfoItem
            key={field.key}
            label={tFields.has(field.key) ? tFields(field.key) : field.key}
            wide={field.input === "textarea"}
            hint={
              hasPending ? (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="pending" size="sm" />
                  <span className="t-meta">
                    {t("proposedLabel")}:{" "}
                    {format(pendingValues?.get(field.key), field.input)}
                  </span>
                </span>
              ) : undefined
            }
          >
            {format(approvedValue(snapshot, field.key), field.input)}
          </InfoItem>
        );
      })}
    </InfoGrid>
  );
}
