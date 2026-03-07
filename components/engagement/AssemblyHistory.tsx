'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Users } from 'lucide-react';
import { useAssemblyHistory, type Assembly } from '@/hooks/useEngagement';

export function AssemblyHistory() {
  const { data: assemblies, isLoading } = useAssemblyHistory();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!assemblies || assemblies.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" />
        Past Assemblies
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {assemblies.map((assembly) => (
          <PastAssemblyCard key={assembly.id} assembly={assembly} />
        ))}
      </div>
    </div>
  );
}

function PastAssemblyCard({ assembly }: { assembly: Assembly }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{assembly.title}</CardTitle>
          <Badge variant="outline" className="text-xs">
            Epoch {assembly.epoch}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{assembly.question}</p>

        {assembly.results && assembly.results.length > 0 && (
          <div className="space-y-1.5">
            {assembly.results.map((opt, i) => (
              <div key={opt.key} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className={i === 0 ? 'font-medium' : ''}>{opt.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {opt.count} ({opt.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i === 0 ? 'bg-primary' : 'bg-primary/30'
                    }`}
                    style={{ width: `${opt.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
          <Users className="h-3 w-3" />
          {assembly.totalVotes} citizen{assembly.totalVotes !== 1 ? 's' : ''} participated
        </p>
      </CardContent>
    </Card>
  );
}
