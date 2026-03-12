import { Skeleton } from '@/components/ui/skeleton';

export default function CommitteeLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Health Verdict skeleton */}
      <Skeleton className="h-40 rounded-2xl" />

      {/* Insight card skeleton */}
      <Skeleton className="h-20 rounded-xl" />

      {/* Member rankings skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="rounded-xl border divide-y">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-7" />
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="hidden sm:block h-1.5 w-36 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
