import { Link } from "@/i18n/navigation";
import Icon, { type IconName } from "@/components/shell/Icon";

/**
 * One operational number.
 *
 * Compact on purpose: a counter is the starting point of a decision, not
 * the headline of the page. There is no trend line and no delta, because
 * nothing in the data model records a previous value — inventing one would
 * be the most convincing lie on the screen.
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
      className={`group flex items-start gap-2.5 rounded-card border px-3.5 py-2.5 shadow-card transition-colors ${
        isWaiting
          ? "border-attention/30 bg-attention-soft/70 hover:bg-attention-soft"
          : "border-hairline-strong bg-surface hover:border-ink-300"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${
          isWaiting
            ? "bg-attention/10 text-attention"
            : "bg-accent-soft text-accent"
        }`}
      >
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0">
        <span className={`mk-label block ${isWaiting ? "text-attention" : ""}`}>
          {label}
        </span>
        {/* bidi-ltr keeps "100+" from being reordered to "+100" in Arabic:
            the marker belongs after the digits in every language. */}
        <span
          className={`bidi-ltr mt-0.5 block text-[1.375rem] font-semibold tabular-nums leading-7 ${
            isWaiting ? "text-attention" : "text-ink-900"
          }`}
        >
          {value}
          {/* The marketplace query returns at most 100 rows. Showing a bare
              "100" would state a total the data does not support. */}
          {atLeast && <span aria-hidden>+</span>}
        </span>
        {context && <span className="t-meta mt-0.5 block">{context}</span>}
      </span>
    </Link>
  );
}
