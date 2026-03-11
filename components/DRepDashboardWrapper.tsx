'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Wallet, Share2, Check } from 'lucide-react';

interface DRepDashboardWrapperProps {
  drepId: string;
  drepName: string;
  isClaimed: boolean;
}

export function DRepDashboardWrapper({ drepId, drepName, isClaimed }: DRepDashboardWrapperProps) {
  const { isAuthenticated, ownDRepId } = useWallet();
  const { segment } = useSegment();
  const [copied, setCopied] = useState(false);

  const isOwner = isAuthenticated && ownDRepId === drepId;
  const profileUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/drep/${drepId}` : `/drep/${drepId}`;

  const handleShare = async () => {
    const shareData = {
      title: `${drepName} — Governada`,
      text: `Check out ${drepName}'s DRep scorecard on Governada`,
      url: profileUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user cancelled */
      }
    }

    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareButton = (
    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleShare}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Share'}
    </Button>
  );

  if (isOwner) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">Your DRep profile</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {shareButton}
          <Link href="/my-gov">
            <Button size="sm" className="gap-1.5 text-xs">
              Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isClaimed && segment !== 'anonymous' && segment !== 'citizen') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-muted-foreground/25 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            Is this your DRep? Claim it to access insights.
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {shareButton}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => window.dispatchEvent(new Event('openWalletConnect'))}
          >
            <Wallet className="h-3.5 w-3.5" /> Claim
          </Button>
        </div>
      </div>
    );
  }

  // Claimed by someone else — just show share
  return <div className="flex items-center justify-end px-1 py-1">{shareButton}</div>;
}
