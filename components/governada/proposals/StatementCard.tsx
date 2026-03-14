'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface StatementCardProps {
  drepName: string;
  drepId: string;
  statementText: string;
  createdAt: string;
  isUsersDRep?: boolean;
}

export function StatementCard({
  drepName,
  drepId,
  statementText,
  createdAt,
  isUsersDRep,
}: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const truncated = statementText.length > 200 && !expanded;

  return (
    <Card className={isUsersDRep ? 'border-l-4 border-l-amber-500 border-l-solid' : ''}>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/drep/${encodeURIComponent(drepId)}`}
            className="font-medium text-sm hover:underline"
          >
            {drepName}
          </Link>
          <div className="flex items-center gap-2">
            {isUsersDRep && (
              <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-xs">
                Your DRep
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(createdAt)}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {truncated ? statementText.slice(0, 200) + '…' : statementText}
        </p>
        {statementText.length > 200 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-0 px-0 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
