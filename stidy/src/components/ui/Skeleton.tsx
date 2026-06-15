import { cn } from "@/lib/utils";

/** A single shimmering placeholder block (reuses the `.skeleton` CSS shimmer). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Card-shaped placeholder matching the subject/resource card silhouette. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass flex h-full flex-col gap-4 p-5", className)} aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-auto space-y-3">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

/** A responsive grid of card placeholders for list-page loading states. */
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** A vertical stack of row placeholders for list/table loading states. */
export function SkeletonRows({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
