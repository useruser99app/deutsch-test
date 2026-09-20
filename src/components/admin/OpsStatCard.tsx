import { Link } from "@/i18n/navigation";
import Icon, { type IconName } from "@/components/shell/Icon";

/**
 * One counter in the operations header.
 *
 * Follows the Concept D reference: a tinted glyph tile at the inline start,
 * the count as the loudest element, the status it counts under it and one
 * line saying what that status means operationally. The card that matches
 * the active filter is marked, so the header doubles as the filter state.
 *
 * There is no trend and no delta on any of these: nothing in the data model
 * records a previous value.
 */
export type OpsTone =
  | "neutral"
  | "attention"
  | "accent"
  | "positive"
  | "teal"
  | "critical";

const tile: Record<OpsTone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  attention: "bg-attention-soft text-attention",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  teal: "bg-teal-soft text-teal",
  critical: "bg-critical-soft text-critical",
};

const activeEdge: Record<OpsTone, string> = {
  neutral: "border-ink-300 bg-ink-50",
  attention: "border-attention/40 bg-attention-soft/60",
  accent: "border-accent/45 bg-accent-soft/60",
  positive: "border-positive/40 bg-positive-soft/60",
  teal: "border-teal/40 bg-teal-soft/60",
  critical: "border-critical/40 bg-critical-soft/60",
};

export default function OpsStatCard({
  label,
  hint,
  value,
  href,
  icon,
  tone = "neutral",
  active = false,
}: {
  label: string;
  /** What the status means in the workflow. */
  hint: string;
  value: number;
  href: string;
  icon: IconName;
  tone?: OpsTone;
  /** This card's status is the one currently filtered. */
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-3 rounded-card border px-3.5 py-3 shadow-card transition-colors ${
        active
          ? activeEdge[tone]
          : "border-hairline-strong bg-surface hover:border-ink-300"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${tile[tone]}`}
      >
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0">
        <span className="block text-[1.5rem] font-semibold leading-7 tabular-nums tracking-[-0.02em] text-ink-900">
          {value}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold leading-4 text-ink-800">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-[0.9rem] text-ink-500">
          {hint}
        </span>
      </span>
    </Link>
  );
}
