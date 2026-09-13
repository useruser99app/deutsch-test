import { useLocale, useTranslations } from "next-intl";
import type { FitResult } from "@/lib/matching";
import { formatDateValue } from "@/components/ui/useValueFormatter";

/**
 * Criterion values stay canonical in the data (an ISO date, a CEFR level)
 * and are formatted only here, so the reason reads like the rest of the UI
 * instead of exposing a raw database value.
 */
function presentable(
  values: Record<string, string | number> | undefined,
  locale: string
): Record<string, string | number> {
  if (!values) return {};
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] =
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? (formatDateValue(value, locale) ?? value)
        : value;
  }
  return out;
}

const toneFor: Record<string, string> = {
  strong: "bg-positive-soft text-positive",
  good: "bg-accent-soft text-accent",
  partial: "bg-attention-soft text-attention",
  weak: "bg-ink-100 text-ink-600",
};

/**
 * Why this candidate appears. The band is the headline and the score is
 * secondary on purpose: the number is a deterministic sum of named
 * criteria, not a measurement, and presenting it as a precise figure would
 * claim more than the calculation can support.
 */
export default function FitSummary({
  fit,
  compact = false,
}: {
  fit: FitResult;
  compact?: boolean;
}) {
  const t = useTranslations("employer.fit");

  const line = (
    <span className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          toneFor[fit.level] ?? toneFor.weak
        }`}
      >
        {t(`level.${fit.level}`)}
      </span>
      <span className="t-meta tabular-nums">{t("score", { score: fit.score })}</span>
    </span>
  );

  if (compact) return line;

  return (
    <div className="space-y-2.5">
      {line}
      {fit.strengths.length > 0 && (
        <ReasonList title={t("strengths")} items={fit.strengths} marker="✓" tone="text-positive" />
      )}
      {fit.gaps.length > 0 && (
        <ReasonList title={t("gaps")} items={fit.gaps} marker="△" tone="text-attention" />
      )}
      {fit.missing.length > 0 && (
        <ReasonList title={t("missing")} items={fit.missing} marker="?" tone="text-ink-500" />
      )}
    </div>
  );
}

function ReasonList({
  title,
  items,
  marker,
  tone,
}: {
  title: string;
  items: FitResult["strengths"];
  marker: string;
  tone: string;
}) {
  const t = useTranslations("employer.fit");
  const locale = useLocale();
  return (
    <div>
      <p className="t-label">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item.key + JSON.stringify(item.values ?? {})} className="flex gap-2 text-sm text-ink-700">
            <span aria-hidden className={`shrink-0 ${tone}`}>{marker}</span>
            {/* Canonical criterion key -> localized sentence. Values stay
                language-neutral and are interpolated, never translated. */}
            <span><bdi>{t(`reason.${item.key}`, presentable(item.values, locale))}</bdi></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
