import { Skeleton } from '@/components/ui/skeleton';

export default function MemberProfileLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero skeleton */}
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="w-full sm:w-48 h-32 rounded-xl" />
      </div>

      {/* Key stats skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <div className="flex gap-4 border-b pb-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
