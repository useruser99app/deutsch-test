import { useLocale, useTranslations } from "next-intl";
import type { FieldInput } from "@/lib/candidate-fields";

/** Formats a language-neutral canonical value for display (§23/§14). */
export function useValueFormatter() {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tEnums = useTranslations("enums");

  return function format(value: unknown, input?: FieldInput): string {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map(String).join(", ") : "—";
    }
    if (typeof value === "boolean") {
      return value ? tCommon("yes") : tCommon("no");
    }
    if (input === "certificate_status") {
      const key = `certificateStatus.${String(value)}`;
      return tEnums.has(key) ? tEnums(key) : String(value);
    }
    if (input === "date" && typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(parsed);
      }
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };
}

/**
 * One approved field. When a proposal is pending for the same field, the
 * approved value stays the headline and the proposal is shown as clearly
 * subordinate — a candidate must never read their proposal as if it were
 * already live (§4).
 */
export default function FieldValue({
  label,
  value,
  input,
  pendingValue,
  hasPending = false,
}: {
  label: string;
  value: unknown;
  input?: FieldInput;
  pendingValue?: unknown;
  hasPending?: boolean;
}) {
  const format = useValueFormatter();
  const t = useTranslations("candidate.dashboard");
  const tStatus = useTranslations("status");

  return (
    <div className="border-b border-gray-100 py-2.5 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">
        <span className="font-medium break-words">{format(value, input)}</span>
        {hasPending && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-amber-800">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium">
              {tStatus("pending")}
            </span>
            <span className="text-gray-600">
              {t("proposedLabel")}: {format(pendingValue, input)}
            </span>
          </span>
        )}
      </dd>
    </div>
  );
}
