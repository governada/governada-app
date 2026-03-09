import { Skeleton } from '@/components/ui/skeleton';

export default function PulseLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Tab bar — 3 tabs */}
      <div className="flex gap-1 border-b border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      {/* Stat cards — matches lg:grid-cols-4 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
