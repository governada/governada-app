import { Skeleton } from '@/components/ui/skeleton';

export default function DataLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-48" />

      {/* Title skeleton */}
      <Skeleton className="h-8 w-64" />

      {/* Heatmap skeleton */}
      <div className="rounded-xl border p-5 space-y-4">
        <Skeleton className="h-5 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 shrink-0" />
              <div className="flex-1 flex gap-1">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 flex-1 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export buttons skeleton */}
      <div className="rounded-xl border p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Methodology skeleton */}
      <div className="rounded-xl border p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
