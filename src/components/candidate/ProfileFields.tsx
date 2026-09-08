import { useTranslations } from "next-intl";
import { useValueFormatter } from "@/components/ui/useValueFormatter";
import { InfoGrid, InfoItem } from "@/components/ui/InfoGrid";
import { approvedValue, type CandidateSnapshot } from "@/lib/candidate-data";
import {
  fieldSections,
  fieldsForSection,
  type FieldSection,
} from "@/lib/candidate-fields";
import StatusBadge from "@/components/ui/StatusBadge";

/** One section's approved values, laid out as a compact grid. */
function SectionFields({
  snapshot,
  section,
  pendingValues,
  columns,
}: {
  snapshot: CandidateSnapshot;
  section: FieldSection;
  pendingValues?: Map<string, unknown>;
  columns: 2 | 3;
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
          <ol className="flex flex-wrap gap-x-4 gap-y-1.5">
            {snapshot.occupations.map((entry) => (
              <li key={entry.occupation} className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600 tabular-nums">
                  {entry.rank}
                </span>
                <span className="font-medium text-ink-900">
                  {/* Canonical German occupation value, never translated —
                      isolated so it reads LTR inside Arabic copy without
                      flipping the row. */}
                  <bdi>{entry.occupation}</bdi>
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
        const value = format(
          approvedValue(snapshot, field.key),
          field.input,
          field.key
        );
        const pendingValue = pendingValues?.has(field.key)
          ? format(pendingValues.get(field.key), field.input, field.key)
          : null;

        return (
          <InfoItem
            key={field.key}
            label={tFields.has(field.key) ? tFields(field.key) : field.key}
            wide={field.input === "textarea"}
            empty={value.isEmpty}
            hint={
              pendingValue ? (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="pending" size="sm" />
                  <span className="t-meta">
                    {t("proposedLabel")}: <bdi>{pendingValue.text}</bdi>
                  </span>
                </span>
              ) : undefined
            }
          >
            {value.text}
          </InfoItem>
        );
      })}
    </InfoGrid>
  );
}

/**
 * The whole approved profile as ONE surface with internal dividers, rather
 * than a stack of separate panels for a handful of fields each. Shared by
 * the candidate dashboard and the admin candidate workspace.
 */
export default function ProfileFields({
  snapshot,
  pendingValues,
  columns = 3,
}: {
  snapshot: CandidateSnapshot;
  pendingValues?: Map<string, unknown>;
  columns?: 2 | 3;
}) {
  const tSections = useTranslations("candidate.sections");

  const sections = fieldSections.filter(
    (section) =>
      fieldsForSection(snapshot.candidate.candidate_type, section).length > 0
  );

  return (
    <div className="divide-y divide-hairline">
      {sections.map((section) => (
        <section key={section} className="px-5 py-5 first:pt-4 last:pb-4">
          <h3 className="t-section-label mb-3.5">{tSections(section)}</h3>
          <SectionFields
            snapshot={snapshot}
            section={section}
            pendingValues={pendingValues}
            columns={columns}
          />
        </section>
      ))}
    </div>
  );
}
