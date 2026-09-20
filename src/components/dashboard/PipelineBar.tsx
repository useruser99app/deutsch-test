import StatusBadge from "@/components/ui/StatusBadge";

/**
 * The introduction-request pipeline.
 *
 * The stages ARE the workflow statuses this product already has — nothing
 * is added, merged or renamed. Each cell shows a real count and nothing
 * else: no share, no conversion rate, no percentage, because a percentage
 * over a handful of requests says more than the data knows.
 *
 * It wraps instead of forcing five columns onto a phone, where a squeezed
 * horizontal pipeline is unreadable.
 */
export default function PipelineBar({
  stages,
}: {
  stages: { status: string; count: number }[];
}) {
  return (
    // Each cell draws its own end/bottom rule; the negative margins push the
    // trailing row and column rules outside the clipped container. That keeps
    // the grid clean at two, three or five columns without per-index logic,
    // and the logical properties keep it correct in RTL.
    <div className="overflow-hidden rounded-control border border-hairline">
      <div className="-me-px -mb-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {stages.map((stage) => (
          <div
            key={stage.status}
            className="border-b border-e border-hairline px-3 py-2.5"
          >
            <StatusBadge status={stage.status} size="sm" />
            <p
              className={`mt-1.5 text-xl font-semibold tabular-nums ${
                stage.count === 0 ? "text-ink-300" : "text-ink-900"
              }`}
            >
              {stage.count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
