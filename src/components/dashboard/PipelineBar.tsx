import StatusBadge from "@/components/ui/StatusBadge";

/**
 * The introduction-request pipeline, read as ONE process.
 *
 * The stages ARE the workflow statuses this product already has — nothing
 * is added, merged or renamed. Each stage shows a real count and nothing
 * else: no share, no conversion rate, no percentage, because a percentage
 * over a handful of requests says more than the data knows.
 *
 * The tone bar under each count is UNIFORM by design. A bar whose length
 * varied with the count would read as a proportion, which is exactly the
 * claim the data cannot support.
 */

/**
 * Stage tone. Mirrors the semantic mapping StatusBadge already uses, so a
 * stage and its badge can never disagree.
 */
const toneBar: Record<string, string> = {
  new: "bg-attention",
  reviewing: "bg-accent",
  approved: "bg-positive",
  introduced: "bg-positive",
  rejected: "bg-critical",
};

/** The notch that makes a cell read as a step in a chain. */
const NOTCH = "15px";

function clipFor(
  position: "first" | "middle" | "last",
  rtl: boolean
): string | undefined {
  if (rtl) {
    // Mirrored horizontally: the chain runs right to left.
    if (position === "first") {
      return `polygon(100% 0, ${NOTCH} 0, 0 50%, ${NOTCH} 100%, 100% 100%)`;
    }
    if (position === "last") {
      return `polygon(100% 0, 0 0, 0 100%, 100% 100%, calc(100% - ${NOTCH}) 50%)`;
    }
    return `polygon(100% 0, ${NOTCH} 0, 0 50%, ${NOTCH} 100%, 100% 100%, calc(100% - ${NOTCH}) 50%)`;
  }
  if (position === "first") {
    return `polygon(0 0, calc(100% - ${NOTCH}) 0, 100% 50%, calc(100% - ${NOTCH}) 100%, 0 100%)`;
  }
  if (position === "last") {
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${NOTCH} 50%)`;
  }
  return `polygon(0 0, calc(100% - ${NOTCH}) 0, 100% 50%, calc(100% - ${NOTCH}) 100%, 0 100%, ${NOTCH} 50%)`;
}

export default function PipelineBar({
  stages,
  rtl = false,
}: {
  stages: { status: string; count: number }[];
  /** Mirrors the chevrons. Resolved from the locale on the server, so no
   *  direction-specific CSS hack is needed for a non-logical property. */
  rtl?: boolean;
}) {
  return (
    <>
      {/* Desktop: interlocking chevrons. The cells overlap by the notch so
          the points sit inside their neighbour. */}
      {/* The strip behind the chain is the darker surface; the stages sit on
          white and overlap by slightly less than the notch, so the canvas
          shows through as a 2px seam (the hairline colour) and the chevrons actually read. */}
      <div className="hidden overflow-hidden rounded-control bg-hairline lg:flex lg:items-stretch">
        {stages.map((stage, index) => {
          const position =
            index === 0 ? "first" : index === stages.length - 1 ? "last" : "middle";
          return (
            <div
              key={stage.status}
              className={`min-w-0 flex-1 bg-surface py-3 ${
                index === 0 ? "ps-4" : "-ms-[13px] ps-7"
              } pe-4`}
              style={{ clipPath: clipFor(position, rtl) }}
            >
              <StatusBadge status={stage.status} size="sm" />
              <p
                className={`mt-2 text-[1.625rem] font-semibold leading-8 tabular-nums tracking-[-0.02em] ${
                  stage.count === 0 ? "text-ink-300" : "text-ink-900"
                }`}
              >
                {stage.count}
              </p>
              <span
                aria-hidden
                className={`mt-1.5 block h-[3px] w-10 rounded-pill ${
                  stage.count === 0 ? "bg-ink-200" : toneBar[stage.status] ?? "bg-ink-300"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Below `lg` a squeezed five-column chain is unreadable, so the
          stages become a plain grid. */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:hidden">
        {stages.map((stage) => (
          <div
            key={stage.status}
            className="min-w-0 rounded-control bg-surface-sunken px-3 py-3"
          >
            <StatusBadge status={stage.status} size="sm" />
            <p
              className={`mt-2 text-[1.625rem] font-semibold leading-8 tabular-nums tracking-[-0.02em] ${
                stage.count === 0 ? "text-ink-300" : "text-ink-900"
              }`}
            >
              {stage.count}
            </p>
            <span
              aria-hidden
              className={`mt-1.5 block h-[3px] w-10 rounded-pill ${
                stage.count === 0 ? "bg-ink-200" : toneBar[stage.status] ?? "bg-ink-300"
              }`}
            />
          </div>
        ))}
      </div>
    </>
  );
}
