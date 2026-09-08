import { useTranslations } from "next-intl";
import { useValueFormatter } from "@/components/candidate/FieldValue";

/**
 * Current approved value next to the proposal (§9). Rendered as two labelled
 * values rather than raw JSON, so a reviewer can read the decision at a
 * glance. Stacks on narrow screens.
 */
export default function ValueCompare({
  currentValue,
  proposedValue,
}: {
  currentValue: unknown;
  proposedValue: unknown;
}) {
  const format = useValueFormatter();
  const t = useTranslations("admin.review");

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {t("current")}
        </p>
        <p className="mt-1 break-words text-sm text-gray-800">
          {format(currentValue)}
        </p>
      </div>

      <div
        aria-hidden
        className="hidden items-center justify-center text-gray-400 sm:flex"
      >
        <span className="rtl:rotate-180">→</span>
      </div>

      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-green-800">
          {t("proposed")}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-green-900">
          {format(proposedValue)}
        </p>
      </div>
    </div>
  );
}
