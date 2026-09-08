import { useTranslations } from "next-intl";
import { useValueFormatter } from "@/components/ui/useValueFormatter";

/**
 * Current approved value → proposed value (§9). The comparison is the point
 * of the screen, so it gets weight: the current value reads as the
 * established fact, the proposal as the thing being decided. Muted when the
 * decision has already been made, so history stays quieter than open work.
 */
export default function ValueComparison({
  currentValue,
  proposedValue,
  muted = false,
}: {
  currentValue: unknown;
  proposedValue: unknown;
  muted?: boolean;
}) {
  const format = useValueFormatter();
  const t = useTranslations("admin.review");

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
      <div className="rounded-md border border-hairline bg-ink-50 px-3 py-2.5">
        <p className="t-label">{t("current")}</p>
        <p className="mt-1 break-words text-sm text-ink-600 line-through decoration-ink-300">
          {format(currentValue)}
        </p>
      </div>

      <div
        aria-hidden
        className="hidden items-center justify-center px-1 text-ink-300 sm:flex"
      >
        <span className="rtl:hidden">→</span>
        <span className="hidden rtl:inline">←</span>
      </div>

      <div
        className={`rounded-md border px-3 py-2.5 ${
          muted
            ? "border-hairline bg-surface"
            : "border-positive/30 bg-positive-soft"
        }`}
      >
        <p className={`t-label ${muted ? "" : "text-positive"}`}>
          {t("proposed")}
        </p>
        <p
          className={`mt-1 break-words text-sm font-semibold ${
            muted ? "text-ink-800" : "text-positive"
          }`}
        >
          {format(proposedValue)}
        </p>
      </div>
    </div>
  );
}
