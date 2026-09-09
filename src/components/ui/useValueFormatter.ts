import { useLocale, useTranslations } from "next-intl";
import type { FieldInput } from "@/lib/candidate-fields";

export interface FormattedValue {
  text: string;
  /** No value stored — rendered quieter than real data, never as an error. */
  isEmpty: boolean;
}

/** Field keys whose canonical value is an ISO country code. */
const countryFields = new Set(["nationality", "country_of_residence", "country"]);

/**
 * Formats a language-neutral canonical value for display (§23/§14).
 *
 * Canonical values are never rewritten — only their presentation is
 * localized. ISO country codes stay "MA" in the database and render as
 * Marokko / Maroc / المغرب / Morocco via Intl.DisplayNames.
 */
export function useValueFormatter() {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tEnums = useTranslations("enums");

  return function format(
    value: unknown,
    input?: FieldInput,
    fieldKey?: string
  ): FormattedValue {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return { text: tCommon("notProvided"), isEmpty: true };
    }

    if (Array.isArray(value)) {
      return { text: value.map(String).join(", "), isEmpty: false };
    }
    if (typeof value === "boolean") {
      return { text: value ? tCommon("yes") : tCommon("no"), isEmpty: false };
    }
    if (input === "certificate_status") {
      const key = `certificateStatus.${String(value)}`;
      return {
        text: tEnums.has(key) ? tEnums(key) : String(value),
        isEmpty: false,
      };
    }
    if (fieldKey && countryFields.has(fieldKey) && typeof value === "string") {
      return { text: countryName(value, locale), isEmpty: false };
    }
    if (input === "date" && typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return {
          text: new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          }).format(parsed),
          isEmpty: false,
        };
      }
    }
    if (typeof value === "object") {
      return { text: JSON.stringify(value), isEmpty: false };
    }
    return { text: String(value), isEmpty: false };
  };
}

/**
 * ISO 3166-1 alpha-2 → localized country name. Anything that is not a plain
 * two-letter code is passed through unchanged, so free-text entries survive.
 */
/**
 * Date-only values, formatted for the reader's locale. Pinned to UTC: a
 * plain `new Date("2027-09-01")` is midnight UTC and would render as the
 * previous day for anyone west of Greenwich.
 */
export function formatDateValue(
  value: string | null | undefined,
  locale: string
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function countryName(code: string, locale: string): string {
  const trimmed = code.trim();
  if (!/^[A-Za-z]{2}$/.test(trimmed)) return code;
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(
        trimmed.toUpperCase()
      ) ?? code
    );
  } catch {
    return code;
  }
}
