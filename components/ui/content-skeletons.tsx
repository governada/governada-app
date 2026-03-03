import { Skeleton } from './skeleton';

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`${height} w-full rounded-lg border bg-card/50 p-4 space-y-3`}>
      {/* Y-axis labels */}
      <div className="flex gap-4 h-full">
        <div className="flex flex-col justify-between py-2 w-8">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-6" />
        </div>
        {/* Chart area */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex flex-col justify-between">
            <Skeleton className="h-px w-full opacity-30" />
            <Skeleton className="h-px w-full opacity-30" />
            <Skeleton className="h-px w-full opacity-30" />
            <Skeleton className="h-px w-full opacity-30" />
          </div>
          <svg className="w-full h-full opacity-10" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path
              d="M0 40 Q25 10 50 30 T100 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
          </svg>
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between pl-12">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card/50 p-4 flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatPodSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card/50 p-4 flex flex-col items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TimelineSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4 pl-4 border-l-2 border-muted">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 relative">
          <Skeleton className="h-3 w-3 rounded-full absolute -left-[23px] top-1" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PollSkeleton() {
  return (
    <div className="rounded-lg border bg-card/50 p-5 space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-64" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StanceSkeleton() {
  return (
    <div className="rounded-lg border bg-card/50 p-5 space-y-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border bg-card/30 p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
