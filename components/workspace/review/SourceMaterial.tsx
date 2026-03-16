'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronDown, ChevronUp, FileSearch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReviewQueueItem } from '@/lib/workspace/types';

interface SourceMaterialProps {
  item: ReviewQueueItem;
}

const CARDANOSCAN_BASE = 'https://cardanoscan.io';

/**
 * SourceMaterial — raw proposal data display with full abstract,
 * metadata, and external links.
 */
export function SourceMaterial({ item }: SourceMaterialProps) {
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  const abstractText = item.abstract ?? '';
  const isLongAbstract = abstractText.length > 300;
  const displayAbstract =
    isLongAbstract && !abstractExpanded ? abstractText.slice(0, 300) + '...' : abstractText;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileSearch className="h-3.5 w-3.5" />
          Source Material
        </div>

        {/* Full Abstract */}
        {abstractText && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Full Abstract
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {displayAbstract}
            </p>
            {isLongAbstract && (
              <button
                onClick={() => setAbstractExpanded(!abstractExpanded)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                aria-label={abstractExpanded ? 'Show less of abstract' : 'Read full abstract'}
              >
                {abstractExpanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Read full abstract <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Proposal Metadata */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Metadata
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium text-foreground">{item.proposalType}</p>
            </div>
            {item.withdrawalAmount !== null && (
              <div>
                <span className="text-muted-foreground">Amount</span>
                <p className="font-medium text-foreground tabular-nums">
                  {(item.withdrawalAmount / 1_000_000).toLocaleString()} ADA
                </p>
              </div>
            )}
            {item.epochsRemaining !== null && (
              <div>
                <span className="text-muted-foreground">Expires</span>
                <p
                  className={cn('font-medium', item.isUrgent ? 'text-rose-500' : 'text-foreground')}
                >
                  {item.epochsRemaining === 0
                    ? 'This epoch'
                    : `${item.epochsRemaining} epoch${item.epochsRemaining !== 1 ? 's' : ''}`}
                </p>
              </div>
            )}
            {item.existingVote && (
              <div>
                <span className="text-muted-foreground">Your vote</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    item.existingVote === 'Yes'
                      ? 'text-emerald-600 border-emerald-500/30'
                      : item.existingVote === 'No'
                        ? 'text-rose-600 border-rose-500/30'
                        : 'text-muted-foreground',
                  )}
                >
                  {item.existingVote}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* External Links */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/50">
          <Link
            href={`/proposal/${item.txHash}/${item.proposalIndex}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View full proposal
            <ExternalLink className="h-3 w-3" />
          </Link>
          <a
            href={`${CARDANOSCAN_BASE}/transaction/${item.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View on CardanoScan
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
