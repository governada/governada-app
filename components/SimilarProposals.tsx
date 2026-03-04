'use client';

import Link from 'next/link';
import { useSimilarProposals } from '@/hooks/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, GitCompare } from 'lucide-react';

interface SimilarProposal {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  similarityScore: number;
}

interface SimilarProposalsProps {
  txHash: string;
  proposalIndex: number;
}

export function SimilarProposals({ txHash, proposalIndex }: SimilarProposalsProps) {
  const { data: rawData, isLoading } = useSimilarProposals(txHash, proposalIndex);
  const proposals = Array.isArray(rawData) ? (rawData as SimilarProposal[]) : [];

  if (isLoading || proposals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Similar Proposals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {proposals.map((p) => (
            <Link
              key={`${p.txHash}-${p.index}`}
              href={`/proposals/${p.txHash}/${p.index}`}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {p.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {p.proposalType}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {Math.round(p.similarityScore * 100)}% match
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
