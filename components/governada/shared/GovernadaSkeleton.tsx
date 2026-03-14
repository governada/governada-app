import { cn } from '@/lib/utils';

type SkeletonVariant = 'profile-hero' | 'card' | 'tab-panel';

interface GovernadaSkeletonProps {
  variant: SkeletonVariant;
  className?: string;
}

export function GovernadaSkeleton({ variant, className }: GovernadaSkeletonProps) {
  const shimmer = 'animate-pulse rounded-lg bg-muted/60';

  if (variant === 'profile-hero') {
    return (
      <div className={cn('space-y-4 p-6', className)}>
        <div className="flex items-start gap-4">
          <div className={cn(shimmer, 'h-16 w-16 rounded-full')} />
          <div className="space-y-2 flex-1">
            <div className={cn(shimmer, 'h-6 w-48')} />
            <div className={cn(shimmer, 'h-4 w-32')} />
          </div>
        </div>
        <div className={cn(shimmer, 'h-24 w-full')} />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={cn(shimmer, 'h-8 w-20')} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('space-y-3 p-4 rounded-xl border border-border', className)}>
        <div className={cn(shimmer, 'h-4 w-24')} />
        <div className={cn(shimmer, 'h-8 w-full')} />
        <div className={cn(shimmer, 'h-4 w-3/4')} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 p-4', className)}>
      {[...Array(3)].map((_, i) => (
        <div key={i} className={cn(shimmer, 'h-16 w-full')} />
      ))}
    </div>
  );
}
