import { useTranslations } from "next-intl";
import StatusBadge from "@/components/ui/StatusBadge";
import { useValueFormatter } from "@/components/ui/useValueFormatter";
import type { ChangeItem } from "@/lib/domain";

/**
 * One change item as the candidate sees it (§13): which field, the approved
 * value, the proposal, the outcome and the reviewer's comment. Open items
 * carry the attention tone; decided ones stay quiet. No admin-internal data
 * (no reviewer identity) is exposed.
 */
export default function ChangeItemRow({ item }: { item: ChangeItem }) {
  const format = useValueFormatter();
  const t = useTranslations("candidate.reviews");
  const tFields = useTranslations("fields");

  const isPending = item.status === "pending";

  return (
    <li
      className={`rounded-md border p-4 ${
        isPending
          ? "border-attention/30 bg-attention-soft/40"
          : "border-hairline bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">
          {tFields.has(item.field_key) ? tFields(item.field_key) : item.field_key}
        </span>
        <StatusBadge status={item.status} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-ink-500 line-through decoration-ink-300">
          {format(item.current_value)}
        </span>
        <span aria-hidden className="text-ink-300">
          <span className="rtl:hidden">→</span>
          <span className="hidden rtl:inline">←</span>
        </span>
        <span
          className={`text-sm font-semibold ${
            item.status === "rejected" ? "text-ink-600" : "text-ink-900"
          }`}
        >
          {format(item.proposed_value)}
        </span>
      </div>

      <p className="t-meta mt-2.5">
        {t("submittedAt")}: {item.created_at.slice(0, 10)}
        {item.reviewed_at ? ` · ${t("reviewedAt")}: ${item.reviewed_at.slice(0, 10)}` : ""}
        {item.source_language ? ` · ${t("sourceLanguage")}: ${item.source_language}` : ""}
      </p>

      {item.review_comment && (
        <p className="t-body mt-2 rounded-md bg-ink-50 px-3 py-2">
          <span className="font-medium">{t("reviewComment")}: </span>
          {item.review_comment}
        </p>
      )}
    </li>
  );
}
