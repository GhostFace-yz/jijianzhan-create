import { Skeleton } from '../shadcn/skeleton';

/**
 * Skeleton placeholder for the OutlinePage while AI is generating
 * or while the existing outline is being fetched.
 */
export function OutlineSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
        <Skeleton className="h-6 w-1/4 mb-4" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-[280px] space-y-3 rounded-lg border border-hairline-soft p-4"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
