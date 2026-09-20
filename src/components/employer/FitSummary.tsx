import { useLocale, useTranslations } from "next-intl";
import type { FitResult } from "@/lib/matching";
import { formatDateValue } from "@/components/ui/useValueFormatter";

const toneFor: Record<string, string> = {
  very_good: "bg-positive-soft text-positive",
  good: "bg-accent-soft text-accent",
  partial: "bg-attention-soft text-attention",
  insufficient_data: "bg-ink-100 text-ink-600",
};

/**
 * Criterion values stay canonical in the data (an ISO date, a CEFR level)
 * and are formatted only here, so the reason reads like the rest of the UI
 * instead of exposing a raw database value.
 */
function presentable(
  values: Record<string, string | number> | undefined,
  locale: string,
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

/**
 * Why this candidate appears.
 *
 * The numeric score is deliberately NOT shown. Out of a single comparable
 * requirement it reads 100, which an employer would take as a verified
 * match when in truth almost nothing was checked. The band plus a one-line
 * evidence summary say how much was actually compared; the score stays
 * internal and only orders the list.
 */
export default function FitSummary({
  fit,
  compact = false,
  emphasis = false,
}: {
  fit: FitResult;
  compact?: boolean;
  /** Larger band and tighter reason groups, for the marketplace preview.
   *  Off by default so the vacancy page renders exactly as before. */
  emphasis?: boolean;
}) {
  const t = useTranslations("employer.fit");
  const { evidence } = fit;

  const badge = (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold ${
        toneFor[fit.level] ?? toneFor.insufficient_data
      } ${emphasis ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"}`}
    >
      {t(`level.${fit.level}`)}
    </span>
  );

  // One quiet line, not a metrics block: what was checked, what differs,
  // what the profile does not say.
  const evidenceLine =
    evidence.evaluatedCriteria === 0 ? (
      <span className="t-meta">{t("evidenceNone")}</span>
    ) : (
      <span className="t-meta">
        {t("evidenceMatched", {
          matched: evidence.matchedCriteria,
          evaluated: evidence.evaluatedCriteria,
        })}
        {evidence.gapCriteria > 0 &&
          ` · ${t("evidenceGaps", { count: evidence.gapCriteria })}`}
        {evidence.missingCriteria > 0 &&
          ` · ${t("evidenceMissing", { count: evidence.missingCriteria })}`}
      </span>
    );

  // How many of the three reason groups actually have entries.
  const groupCount = [fit.strengths, fit.gaps, fit.missing].filter(
    (group) => group.length > 0,
  ).length;

  if (compact) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        {badge}
        {evidenceLine}
      </span>
    );
  }

  return (
    <div className={emphasis ? "space-y-3" : "space-y-2.5"}>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {badge}
        {evidenceLine}
      </span>
      {/* Three groups, side by side once there is room: what fits, what
          differs and what the profile simply does not say are different
          kinds of information and must not read as one list. */}
      <div
        className={
          emphasis
            ? `grid gap-x-5 gap-y-3 ${groupCount > 1 ? "sm:grid-cols-2" : ""}`
            : "space-y-2.5"
        }
      >
        {fit.strengths.length > 0 && (
          <ReasonList
            title={t("strengths")}
            items={fit.strengths}
            marker="✓"
            tone="text-positive"
            dense={emphasis}
          />
        )}
        {fit.gaps.length > 0 && (
          <ReasonList
            title={t("gaps")}
            items={fit.gaps}
            marker="△"
            tone="text-attention"
            dense={emphasis}
          />
        )}
        {fit.missing.length > 0 && (
          <ReasonList
            title={t("missing")}
            items={fit.missing}
            marker="?"
            tone="text-ink-500"
            dense={emphasis}
          />
        )}
      </div>
    </div>
  );
}

function ReasonList({
  title,
  items,
  marker,
  tone,
  dense = false,
}: {
  title: string;
  items: FitResult["strengths"];
  marker: string;
  tone: string;
  dense?: boolean;
}) {
  const t = useTranslations("employer.fit");
  const locale = useLocale();
  return (
    <div>
      <p className={dense ? "mk-label" : "t-label"}>{title}</p>
      <ul className={dense ? "mt-1.5 space-y-1" : "mt-1 space-y-0.5"}>
        {items.map((item) => (
          <li
            key={item.key + JSON.stringify(item.values ?? {})}
            className={`flex gap-2 text-ink-700 ${dense ? "text-[13px] leading-[1.25rem]" : "text-sm"}`}
          >
            <span aria-hidden className={`shrink-0 ${tone}`}>
              {marker}
            </span>
            {/* Canonical criterion key -> localized sentence. Values stay
                language-neutral and are interpolated, never translated. */}
            <span>
              <bdi>
                {t(`reason.${item.key}`, presentable(item.values, locale))}
              </bdi>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
