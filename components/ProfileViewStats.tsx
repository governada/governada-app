'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

export function ProfileViewStats({ drepId }: { drepId: string }) {
  const [stats, setStats] = useState<{ weekViews: number; totalViews: number } | null>(null);

  useEffect(() => {
    fetch(`/api/views?drepId=${encodeURIComponent(drepId)}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [drepId]);

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
