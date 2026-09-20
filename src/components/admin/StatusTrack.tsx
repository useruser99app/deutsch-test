/**
 * How far one request has travelled through the workflow.
 *
 * The four nodes ARE the product's forward path — new, reviewing, approved,
 * introduced — and the position is read from the request's own status. No
 * stage is invented and nothing is estimated: a node is either behind the
 * request, the request's current one, or ahead of it.
 *
 * `rejected` is a terminal state, not a stage, so it is drawn as a stop on
 * the first node with the rest of the path left inert.
 */
const PATH = ["new", "reviewing", "approved", "introduced"] as const;

const currentTone: Record<string, string> = {
  new: "bg-attention",
  reviewing: "bg-accent",
  approved: "bg-positive",
  introduced: "bg-teal",
};

export default function StatusTrack({ status }: { status: string }) {
  const rejected = status === "rejected";
  const index = PATH.indexOf(status as (typeof PATH)[number]);

  return (
    <span className="flex items-center" aria-hidden>
      {PATH.map((step, i) => {
        const done = !rejected && index > i;
        const current = !rejected && index === i;
        const stop = rejected && i === 0;

        return (
          <span key={step} className="flex items-center">
            {/* The connector into this node is travelled once the request
                has reached the node. */}
            {i > 0 && (
              <span
                className={`h-[2px] w-5 ${
                  !rejected && index >= i ? "bg-positive" : "bg-ink-200"
                }`}
              />
            )}
            <span
              className={`flex h-3.5 w-3.5 items-center justify-center rounded-pill ${
                stop
                  ? "bg-critical text-white"
                  : done
                    ? "bg-positive text-white"
                    : current
                      ? `${currentTone[step] ?? "bg-accent"} ring-2 ring-white`
                      : "border-2 border-ink-200 bg-surface"
              }`}
            >
              {stop && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="h-2 w-2"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              )}
              {done && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-2 w-2"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}
