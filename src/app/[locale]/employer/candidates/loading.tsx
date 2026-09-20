import { SkeletonBlock, SkeletonListItem } from "@/components/ui/Skeleton";

/**
 * Shown by the App Router while the marketplace query runs. It mirrors the
 * real layout so the page does not jump when the data arrives, and it shows
 * shapes only — never placeholder candidates.
 */
export default function MarketplaceLoading() {
  return (
    <div aria-busy="true">
      <div className="mb-stack space-y-2.5">
        <SkeletonBlock className="h-3 w-44" />
        <SkeletonBlock className="h-7 w-2/3 max-w-md" />
        <SkeletonBlock className="h-4 w-full max-w-xl" />
      </div>

      <SkeletonBlock className="h-28 w-full rounded-card" />

      <div className="mt-stack lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="overflow-hidden rounded-card border border-hairline bg-surface">
          <ul>
            {[0, 1, 2, 3, 4].map((row) => (
              <SkeletonListItem key={row} />
            ))}
          </ul>
        </div>
        <div className="mt-4 hidden lg:mt-0 lg:block">
          <SkeletonBlock className="h-[28rem] w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
