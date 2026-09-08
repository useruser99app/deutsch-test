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
