'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Share2 } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';

interface DRepReportCardProps {
  drepId: string;
  name: string;
  score: number;
  rank: number | null;
  delegators: number;
  participation: number;
  rationale: number;
  reliability: number;
  profile: number;
}

export function DRepReportCard({
  drepId,
  name,
  score,
  rank,
  delegators,
  participation,
  rationale,
  reliability,
}: DRepReportCardProps) {
  const url = buildDRepUrl(drepId);
  const ogImageUrl = `/api/og/drep/${encodeURIComponent(drepId)}`;
  const shareText = `My Governada Score: ${score}/100\n\nParticipation: ${participation}%\nRationale: ${rationale}%\nReliability: ${reliability}%\n${rank ? `Ranked #${rank}` : ''}\n\n${delegators} delegators trust my governance.\n\nCheck your DRep's score:`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4" />
          Share Your Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ogImageUrl}
          alt={`${name} Governada Card`}
          className="w-full rounded-lg border"
          loading="lazy"
        />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {rank && (
            <Badge variant="secondary" className="text-[10px]">
              #{rank}
            </Badge>
          )}
          <span>{delegators} delegators</span>
        </div>

        <ShareActions
          url={url}
          text={shareText}
          imageUrl={ogImageUrl}
          imageFilename={`governada-${name.replace(/\s+/g, '-').toLowerCase()}.png`}
          surface="report_card"
          metadata={{ drep_id: drepId, score }}
        />
      </CardContent>
    </Card>
  );
}
