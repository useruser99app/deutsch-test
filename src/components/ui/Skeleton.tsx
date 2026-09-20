/**
 * Placeholder shapes for content that is genuinely still loading.
 *
 * Deliberately shapes, not invented content: a skeleton must never show a
 * plausible-looking candidate that does not exist. `aria-hidden` plus a
 * labelled live region on the container keeps the wait announced once
 * instead of as a wall of empty boxes.
 */
export function SkeletonLine({ className = "w-full" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-3 animate-pulse rounded-pill bg-ink-100 ${className}`}
    />
  );
}

export function SkeletonBlock({
  className = "h-24 w-full",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-control bg-ink-100 ${className}`}
    />
  );
}

/** One placeholder candidate row, matching CandidateListItem's rhythm. */
export function SkeletonListItem() {
  return (
    <li className="flex items-start gap-3 border-b border-hairline px-4 py-3.5 last:border-b-0">
      <SkeletonBlock className="h-11 w-11 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="w-28" />
        <SkeletonLine className="h-4 w-2/3" />
        <SkeletonLine className="w-1/2" />
      </div>
    </li>
  );
}
