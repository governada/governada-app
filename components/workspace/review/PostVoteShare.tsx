'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  buildVoteCardUrl,
  buildVoteShareText,
  buildVoteShareUrl,
  shareToX,
  copyToClipboard,
  trackShare,
} from '@/lib/share';
import { posthog } from '@/lib/posthog';

interface PostVoteShareProps {
  drepId: string;
  txHash: string;
  index: number;
  vote: string;
  proposalTitle: string;
  rationale?: string;
  onNextProposal?: () => void;
}

export function PostVoteShare({
  drepId,
  txHash,
  index,
  vote,
  proposalTitle,
  rationale,
  onNextProposal,
}: PostVoteShareProps) {
  const [copied, setCopied] = useState(false);

  const rationalePreview = rationale?.slice(0, 200);
  const ogImageUrl = buildVoteCardUrl(drepId, txHash, index, vote, rationalePreview);
  const shareUrl = buildVoteShareUrl(txHash, index);
  const shareText = buildVoteShareText(proposalTitle, vote, rationalePreview);

  const voteColorClass =
    vote === 'Yes' ? 'text-green-400' : vote === 'No' ? 'text-red-400' : 'text-muted-foreground';

  const handleShareX = () => {
    shareToX(shareText, shareUrl);
    trackShare('post_vote', 'twitter', { txHash, vote });
    posthog.capture('review_vote_shared', { platform: 'twitter', vote, txHash, index });
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    trackShare('post_vote', 'copy_link', { txHash, vote }, success ? 'success' : 'failed');
    posthog.capture('review_vote_shared', { platform: 'copy_link', vote, txHash, index });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Vote Recorded
          <span className={voteColorClass}>({vote})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OG Image Preview */}
        <div className="overflow-hidden rounded-lg border border-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogImageUrl}
            alt={`Vote share card: ${vote} on ${proposalTitle}`}
            className="w-full"
            loading="lazy"
          />
        </div>

        {/* Share Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleShareX}>
            <ExternalLink className="size-4" />
            Share on X
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>

        {/* Next Proposal */}
        {onNextProposal && (
          <Button className="w-full" onClick={onNextProposal}>
            Next Proposal
            <ArrowRight className="size-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
