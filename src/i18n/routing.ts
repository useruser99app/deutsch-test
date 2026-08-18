import { defineRouting } from "next-intl/routing";

export const locales = ["de", "en", "fr", "ar"] as const;
export type Locale = (typeof locales)[number];

/** Locales rendered right-to-left. RTL is handled structurally via the
 * `dir` attribute on <html> plus CSS logical properties — not via CSS hacks. */
export const rtlLocales: readonly string[] = ["ar"];

export function directionFor(locale: string): "rtl" | "ltr" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

export const routing = defineRouting({
  locales,
  defaultLocale: "de",
  localePrefix: "always",
});
