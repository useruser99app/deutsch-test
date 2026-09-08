"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { persistPreferredLocale } from "@/lib/actions/auth";

const localeLabels: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export default function LocaleSwitcher({
  persist = false,
  tone = "dark",
}: {
  persist?: boolean;
  /** "light" for the dark sidebar, "dark" for light surfaces. */
  tone?: "light" | "dark";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <select
      value={locale}
      aria-label="Language"
      onChange={(event) => {
        const nextLocale = event.target.value;
        startTransition(() => {
          if (persist) {
            void persistPreferredLocale(nextLocale);
          }
          router.replace(pathname, { locale: nextLocale });
        });
      }}
      className={
        tone === "light"
          ? "rounded-md border border-white/15 bg-transparent px-2 py-1.5 text-sm text-ink-200 [&>option]:text-ink-900"
          : "rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-700"
      }
    >
      {locales.map((code) => (
        <option key={code} value={code}>
          {localeLabels[code] ?? code}
        </option>
      ))}
    </select>
  );
}
