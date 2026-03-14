'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RationaleEntry {
  drepId: string;
  drepName: string | null;
  vote: 'Yes' | 'No' | 'Abstain';
  rationaleText: string | null;
  rationaleAiSummary: string | null;
  hashVerified: boolean | null;
}

interface ProposalTopRationalesProps {
  rationales: RationaleEntry[];
}

export function ProposalTopRationales({ rationales }: ProposalTopRationalesProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const withRationale = rationales.filter((r) => r.rationaleAiSummary || r.rationaleText);

  if (withRationale.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            What Representatives Are Saying
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No representatives have provided rationales for this proposal yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by vote
  const yesRationales = withRationale.filter((r) => r.vote === 'Yes');
  const noRationales = withRationale.filter((r) => r.vote === 'No');
  const abstainRationales = withRationale.filter((r) => r.vote === 'Abstain');

  // Take top 3 from each group (balanced representation)
  const featured = [
    ...yesRationales.slice(0, 3),
    ...noRationales.slice(0, 3),
    ...abstainRationales.slice(0, 2),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          What Representatives Are Saying
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {withRationale.length} rationale{withRationale.length !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {featured.map((r) => {
          const isExpanded = expanded === r.drepId;
          const displayText = r.rationaleAiSummary || r.rationaleText;
          const hasFullText = r.rationaleText && r.rationaleText.length > 200;

          return (
            <div key={r.drepId} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    r.vote === 'Yes' ? 'default' : r.vote === 'No' ? 'destructive' : 'secondary'
                  }
                  className="text-xs"
                >
                  {r.vote}
                </Badge>
                <Link
                  href={`/drep/${r.drepId}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {r.drepName || `${r.drepId.slice(0, 16)}…`}
                </Link>
                {r.hashVerified === true && (
                  <span title="On-chain hash verified">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  </span>
                )}
                {r.hashVerified === false && (
                  <span title="Hash mismatch">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                )}
              </div>

              <p
                className={cn(
                  'text-sm text-foreground/80 leading-relaxed',
                  !isExpanded && 'line-clamp-3',
                )}
              >
                {isExpanded && hasFullText ? r.rationaleText : displayText}
              </p>

              {hasFullText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(isExpanded ? null : r.drepId)}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3 ml-1" />
                    </>
                  ) : (
                    <>
                      Read full rationale <ChevronDown className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
