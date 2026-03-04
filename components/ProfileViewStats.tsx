'use client';

import { Eye } from 'lucide-react';
import { useProfileViews } from '@/hooks/queries';

export function ProfileViewStats({ drepId }: { drepId: string }) {
  const { data: raw } = useProfileViews(drepId);
  const stats = raw as { weekViews: number; totalViews: number } | undefined;

  if (!stats || stats.totalViews === 0) return null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Eye className="h-3 w-3" />
        Profile Views
      </span>
      <span className="text-sm font-semibold tabular-nums">
        {stats.weekViews > 0 ? `${stats.weekViews} this week` : stats.totalViews.toLocaleString()}
      </span>
    </div>
  );
}
