import { Link } from "@/i18n/navigation";

/**
 * One active filter, with the value visible and a one-click way out.
 *
 * The remove control is a LINK to the same view minus this filter, not a
 * button: it needs no JavaScript, it is shareable, and it keeps the whole
 * marketplace on a single URL-driven model.
 */
export default function FilterChip({
  label,
  value,
  removeHref,
  removeLabel,
}: {
  label: string;
  value: string;
  removeHref: string;
  /** Accessible name for the remove control, e.g. "Filter entfernen: Beruf". */
  removeLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong bg-surface py-1 pe-1 ps-2.5 text-xs text-ink-700 shadow-card">
      <span className="text-ink-500">{label}:</span>
      <span className="font-medium text-ink-900">
        <bdi>{value}</bdi>
      </span>
      <Link
        href={removeHref}
        aria-label={`${removeLabel}: ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-pill text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-3 w-3"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </Link>
    </span>
  );
}
