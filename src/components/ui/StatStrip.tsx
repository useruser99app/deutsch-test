import { Link } from "@/i18n/navigation";

export interface Stat {
  label: string;
  value: number;
  href: string;
  /** Work that is waiting; louder than a passive total when non-zero. */
  waiting?: boolean;
}

/**
 * The operational numbers as ONE surface divided into cells, not as a row of
 * separate cards. A dashboard's counters belong together — splitting them
 * into floating white boxes is what makes a scaffolded UI look scaffolded,
 * and it wastes vertical space that the actual work needs.
 *
 * Numbers stay at a readable but modest size: they are a starting point for
 * a decision, not the headline of the page.
 */
export default function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface sm:divide-x lg:grid-cols-4 rtl:sm:divide-x-reverse">
      {stats.map((stat) => {
        const waiting = stat.waiting && stat.value > 0;
        return (
          <Link
            key={stat.label}
            href={stat.href}
            className={`group border-hairline px-4 py-3.5 transition-colors [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0 ${
              waiting ? "bg-attention-soft/60 hover:bg-attention-soft" : "hover:bg-ink-50"
            }`}
          >
            <p
              className={`truncate text-[11px] font-medium uppercase tracking-[0.06em] ${
                waiting ? "text-attention" : "text-ink-500"
              }`}
            >
              {stat.label}
            </p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                waiting ? "text-attention" : "text-ink-900"
              }`}
            >
              {stat.value}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
