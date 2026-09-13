"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * A localized file field.
 *
 * The native control renders its button and "no file chosen" text in the
 * BROWSER's language, not the app's — a French or Arabic candidate was
 * shown German chrome. So the native chrome is hidden and the same strings
 * are rendered from the message catalogue instead.
 *
 * The real <input type="file"> is still the control: it keeps the name, the
 * required attribute and the form submission untouched. It is visually
 * hidden but NOT removed from the tab order, so it is still reachable by
 * keyboard and opens the file dialog with Enter or Space; the visible
 * button is its <label>, and the focus ring is mirrored onto it.
 */
export default function FilePicker({
  name,
  required = false,
  accept,
}: {
  name: string;
  required?: boolean;
  accept?: string;
}) {
  const t = useTranslations("candidate.documents");
  const id = useId();
  const [filename, setFilename] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="file"
        name={name}
        required={required}
        accept={accept}
        onChange={(event) => setFilename(event.target.files?.[0]?.name ?? null)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className="inline-flex shrink-0 cursor-pointer items-center rounded-md border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      >
        {t("chooseFile")}
      </label>
      {/* The chosen name is announced when it changes, so a screen-reader
          user gets the same confirmation a sighted user sees. */}
      <span
        aria-live="polite"
        className={`min-w-0 flex-1 truncate text-sm ${
          filename ? "text-ink-800" : "text-ink-400"
        }`}
        title={filename ?? undefined}
      >
        <bdi>{filename ?? t("noFileSelected")}</bdi>
      </span>
    </div>
  );
}
