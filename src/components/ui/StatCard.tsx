import { Link } from "@/i18n/navigation";

/**
 * One operational number. Work waiting for the reviewer is visually louder
 * than a passive total (§6): it gets the attention tone and a solid number,
 * a passive total stays quiet.
 */
export default function StatCard({
  label,
  value,
  href,
  actionLabel,
  emphasis = false,
}: {
  label: string;
  value: number;
  href: string;
  actionLabel: string;
  emphasis?: boolean;
}) {
  const waiting = emphasis && value > 0;

  return (
    <Link
      href={href}
      aria-label={`${label}: ${value} — ${actionLabel}`}
      className={`group block rounded-lg border p-5 transition-colors ${
        waiting
          ? "border-attention/35 bg-attention-soft hover:border-attention/60"
          : "border-hairline bg-surface hover:border-ink-300"
      }`}
    >
      <p className={waiting ? "t-label text-attention" : "t-label"}>{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          waiting ? "text-attention" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-2 text-xs font-medium ${
          waiting ? "text-attention" : "text-ink-500 group-hover:text-accent"
        }`}
      >
        {actionLabel} <span aria-hidden className="rtl:hidden">→</span>
        <span aria-hidden className="hidden rtl:inline">
          ←
        </span>
      </p>
    </Link>
  );
}
