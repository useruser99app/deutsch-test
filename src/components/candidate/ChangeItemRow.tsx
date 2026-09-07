import { useTranslations } from "next-intl";
import StatusBadge from "@/components/StatusBadge";
import { useValueFormatter } from "@/components/candidate/FieldValue";
import type { ChangeItem } from "@/lib/domain";

/**
 * One change item as the candidate sees it: which field, the approved value
 * at submission time, the proposal, the outcome and the reviewer's comment.
 * No admin-internal data (no reviewer identity) is exposed (§10).
 */
export default function ChangeItemRow({ item }: { item: ChangeItem }) {
  const format = useValueFormatter();
  const t = useTranslations("candidate.reviews");
  const tFields = useTranslations("fields");

  const label = tFields.has(item.field_key)
    ? tFields(item.field_key)
    : item.field_key;
  const decidedAt = item.reviewed_at ?? null;

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <StatusBadge status={item.status} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {t("currentValue")}
          </p>
          <p className="mt-0.5 text-sm break-words text-gray-700">
            {format(item.current_value)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {t("proposedValue")}
          </p>
          <p className="mt-0.5 text-sm font-medium break-words text-gray-900">
            {format(item.proposed_value)}
          </p>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        <div className="flex gap-1">
          <dt>{t("submittedAt")}:</dt>
          <dd>{item.created_at.slice(0, 10)}</dd>
        </div>
        {decidedAt && (
          <div className="flex gap-1">
            <dt>{t("reviewedAt")}:</dt>
            <dd>{decidedAt.slice(0, 10)}</dd>
          </div>
        )}
        {item.source_language && (
          <div className="flex gap-1">
            <dt>{t("sourceLanguage")}:</dt>
            <dd>{item.source_language}</dd>
          </div>
        )}
      </dl>

      {item.review_comment && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">{t("reviewComment")}: </span>
          {item.review_comment}
        </p>
      )}
    </li>
  );
}
