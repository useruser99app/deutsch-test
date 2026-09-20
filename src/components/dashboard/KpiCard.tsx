import { Link } from "@/i18n/navigation";
import Icon, { type IconName } from "@/components/shell/Icon";

/**
 * One operational number.
 *
 * The value is the card: it is set large and carries the ink, the label
 * sits above it as secondary text. There is no trend line and no delta,
 * because nothing in the data model records a previous value — inventing
 * one would be the most convincing lie on the screen.
 */
export default function KpiCard({
  label,
  value,
  href,
  icon,
  context,
  atLeast = false,
  waiting = false,
}: {
  label: string;
  value: number;
  href: string;
  icon: IconName;
  /** One short, factual line. Omitted when there is nothing true to say. */
  context?: string;
  /** The query is capped, so the real total is this value OR MORE. */
  atLeast?: boolean;
  /** Work that is waiting; louder than a passive total when non-zero. */
  waiting?: boolean;
}) {
  const isWaiting = waiting && value > 0;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3.5 rounded-card border px-4 py-4 shadow-card transition-colors sm:px-5 ${
        isWaiting
          ? "border-attention/30 bg-attention-soft/70 hover:bg-attention-soft"
          : "border-hairline-strong bg-surface hover:border-ink-300"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control transition-colors ${
          isWaiting
            ? "bg-attention/12 text-attention"
            : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-white"
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13px] font-medium leading-4 ${
            isWaiting ? "text-attention" : "text-ink-500"
          }`}
        >
          {label}
        </span>
        {/* bidi-ltr keeps "100+" from being reordered to "+100" in Arabic:
            the marker belongs after the digits in every language. */}
        <span
          className={`bidi-ltr mt-1 block text-[2rem] font-semibold leading-9 tabular-nums tracking-[-0.02em] ${
            isWaiting ? "text-attention" : "text-ink-900"
          }`}
        >
          {value}
          {/* The marketplace query returns at most 100 rows. Showing a bare
              "100" would state a total the data does not support. */}
          {atLeast && <span aria-hidden>+</span>}
        </span>
        {/* One factual line where there is something true to say. Never a
            trend: nothing records a previous value, so a delta would be
            invented. */}
        {context && (
          <span
            className={`mt-1 block text-[12px] leading-4 ${
              isWaiting ? "font-medium text-attention" : "text-ink-500"
            }`}
          >
            {context}
          </span>
        )}
      </span>

      {/* The card is a link; the chevron says so. */}
      <span
        aria-hidden
        className={`shrink-0 transition-colors rtl:rotate-180 ${
          isWaiting ? "text-attention/60" : "text-ink-300 group-hover:text-accent"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
