import { Skeleton } from '@/components/ui/skeleton';

export default function ReviewLoading() {
  return (
    <div className="flex h-full">
      {/* Queue rail skeleton */}
      <div className="hidden md:block w-72 border-r border-border shrink-0">
        <div className="p-3 space-y-3">
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
