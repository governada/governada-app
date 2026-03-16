'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Lightbulb, AlertTriangle } from 'lucide-react';
import type { PerspectiveClustersData, PerspectiveCluster } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Cluster card
// ---------------------------------------------------------------------------

function ClusterCard({ cluster }: { cluster: PerspectiveCluster }) {
  return (
    <Card className={cluster.isMinority ? 'border-amber-500/40 bg-amber-500/5' : ''}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{cluster.label}</h3>
          <div className="flex items-center gap-1.5">
            {cluster.isMinority && (
              <Badge
                variant="outline"
                className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                Minority view
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              <Users className="mr-1 h-3 w-3" />
              {cluster.size}
            </Badge>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{cluster.summary}</p>

        {cluster.representativeQuotes.length > 0 && (
          <div className="space-y-1.5 mt-2">
            {cluster.representativeQuotes.map((quote, i) => (
              <blockquote
                key={i}
                className="border-l-2 border-muted-foreground/20 pl-3 text-xs text-muted-foreground italic"
              >
                &ldquo;{quote}&rdquo;
              </blockquote>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PerspectiveMapProps {
  data: PerspectiveClustersData;
}

export function PerspectiveMap({ data }: PerspectiveMapProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Perspective Clusters</h2>
        <Badge variant="outline" className="text-xs">
          {data.rationaleCount} rationales analyzed
        </Badge>
      </div>

      {/* Cluster cards */}
      <div className="grid gap-3">
        {data.clusters.map((cluster, i) => (
          <ClusterCard key={i} cluster={cluster} />
        ))}
      </div>

      {/* Bridging points */}
      {data.bridgingPoints.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Points of Agreement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {data.bridgingPoints.map((point, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">&#x2022;</span>
                  {point}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
