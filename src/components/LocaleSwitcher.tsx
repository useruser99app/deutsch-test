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
}: {
  persist?: boolean;
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
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
    >
      {locales.map((code) => (
        <option key={code} value={code}>
          {localeLabels[code] ?? code}
        </option>
      ))}
    </select>
  );
}
