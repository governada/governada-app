'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertTriangle } from 'lucide-react';
import { usePerspectives } from '@/hooks/usePerspectives';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MinorityReportProps {
  proposalTxHash: string;
  proposalIndex: number;
}

export function MinorityReport({ proposalTxHash, proposalIndex }: MinorityReportProps) {
  const { data } = usePerspectives(proposalTxHash, proposalIndex);

  const clusters = data?.data;
  if (!clusters) return null;

  const minorities = clusters.minorityPerspectives;
  if (minorities.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-amber-500" />
          Minority Perspectives
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {minorities.map((minority, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-sm font-medium">{minority.label}</span>
              <Badge variant="outline" className="text-xs">
                {minority.size} voice{minority.size !== 1 ? 's' : ''}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground ml-5">{minority.summary}</p>
            {minority.representativeQuotes.length > 0 && (
              <blockquote className="ml-5 border-l-2 border-amber-500/30 pl-3 text-xs text-muted-foreground italic">
                &ldquo;{minority.representativeQuotes[0]}&rdquo;
              </blockquote>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
