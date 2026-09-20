import StatusBadge from "@/components/ui/StatusBadge";

/**
 * The introduction-request pipeline, read as ONE process rather than five
 * table cells.
 *
 * The stages ARE the workflow statuses this product already has — nothing
 * is added, merged or renamed. Each stage shows a real count and nothing
 * else: no share, no conversion rate, no percentage, because a percentage
 * over a handful of requests says more than the data knows.
 *
 * The chevrons carry the direction of travel and are decorative only; they
 * are hidden below `lg`, where the stages become a plain readable grid
 * instead of a squeezed horizontal strip.
 */
export default function PipelineBar({
  stages,
}: {
  stages: { status: string; count: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:flex lg:items-stretch lg:gap-0">
      {stages.map((stage, index) => (
        <div key={stage.status} className="flex min-w-0 items-center lg:flex-1">
          <div className="min-w-0 flex-1 rounded-control bg-surface-sunken px-3 py-3 lg:px-3.5">
            <StatusBadge status={stage.status} size="sm" />
            <p
              className={`mt-2 text-[1.625rem] font-semibold leading-8 tabular-nums tracking-[-0.02em] ${
                stage.count === 0 ? "text-ink-300" : "text-ink-900"
              }`}
            >
              {stage.count}
            </p>
          </div>

          {/* Direction of travel. Logical rotation keeps it pointing the
              right way in RTL. */}
          {index < stages.length - 1 && (
            <span
              aria-hidden
              className="hidden shrink-0 px-1 text-ink-300 lg:block"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 rtl:rotate-180"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
