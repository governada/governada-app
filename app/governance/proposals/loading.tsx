import { Skeleton } from '@/components/ui/skeleton';

export default function ProposalsLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 space-y-4">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Proposal card skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-4 pt-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
