import { useLocale, useTranslations } from "next-intl";
import {
  placementPhaseStates,
  type PlacementPhase,
  type PlacementPhaseState,
} from "@/lib/domain";
import { formatDateValue } from "@/components/ui/useValueFormatter";

/**
 * The placement process as a compact timeline.
 *
 * Presentation only — no client state, no action — so the same component
 * can be dropped into the candidate's own dashboard later as a read-only
 * view. Every phase's state is derived from the one stored current phase:
 * earlier phases are done, the current one is highlighted, later ones are
 * open. With no phase set, all eight are open; nothing is assumed.
 *
 * Wide screens get one horizontal row; a phone gets a vertical list, where
 * eight labels side by side would be unreadable. Both are the same ordered
 * list, and each step names its state for assistive technology rather than
 * relying on colour.
 */
export default function PlacementTimeline({
  current,
  changedAt,
}: {
  current: PlacementPhase | null;
  /** When the current phase was set. Shown only if it exists. */
  changedAt?: string | null;
}) {
  const t = useTranslations("placement");
  const locale = useLocale();
  const steps = placementPhaseStates(current);
  const since = changedAt ? formatDateValue(changedAt, locale) : null;

  const node = (state: PlacementPhaseState) =>
    state === "done"
      ? "bg-positive text-white"
      : state === "current"
        ? "bg-accent text-white ring-4 ring-accent-soft"
        : "border-2 border-ink-200 bg-surface";

  return (
    <div>
      <ol className="flex flex-col gap-0 sm:flex-row">
        {steps.map(({ phase, state }, index) => {
          const last = index === steps.length - 1;
          return (
            <li
              key={phase}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex min-w-0 gap-3 pb-4 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
            >
              {/* Connector to the next step: down on a phone, across on a
                  wide screen. Travelled once the next step is reached. */}
              {!last && (
                <span
                  aria-hidden
                  className={`absolute start-[0.6875rem] top-6 bottom-0 w-[2px] sm:start-1/2 sm:top-[0.6875rem] sm:bottom-auto sm:h-[2px] sm:w-full ${
                    steps[index + 1].state !== "open"
                      ? "bg-positive"
                      : "bg-ink-200"
                  }`}
                />
              )}

              <span
                aria-hidden
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill ${node(
                  state,
                )}`}
              >
                {state === "done" && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
                {state === "current" && (
                  <span className="h-2 w-2 rounded-pill bg-white" />
                )}
              </span>

              <span className="min-w-0 sm:px-1">
                <span
                  className={`block text-[13px] leading-5 ${
                    state === "current"
                      ? "font-semibold text-ink-900"
                      : state === "done"
                        ? "font-medium text-ink-700"
                        : "text-ink-500"
                  }`}
                >
                  {t(`phase.${phase}`)}
                </span>
                {state === "current" ? (
                  <span className="mt-0.5 inline-block rounded-pill bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
                    {t("state.current")}
                    {since && (
                      <span className="font-normal">
                        {" · "}
                        {t("since", { date: since })}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="sr-only">{t(`state.${state}`)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {current === null && <p className="t-meta mt-3">{t("notSet")}</p>}

      {/* A visible key, so the three states never depend on colour alone. */}
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-3">
        {(["done", "current", "open"] as const).map((state) => (
          <li
            key={state}
            className="flex items-center gap-1.5 text-[12px] text-ink-500"
          >
            <span
              aria-hidden
              className={`h-3 w-3 rounded-pill ${
                state === "done"
                  ? "bg-positive"
                  : state === "current"
                    ? "bg-accent"
                    : "border-2 border-ink-200 bg-surface"
              }`}
            />
            {t(`state.${state}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
