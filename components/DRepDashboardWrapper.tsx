'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Wallet, Share2, Check, Pencil } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import { CitizenViewPanel } from '@/components/governada/profiles/CitizenViewPanel';
import type { TrustSignal } from '@/components/governada/profiles/TrustSignals';

interface DRepDashboardWrapperProps {
  drepId: string;
  drepName: string;
  isClaimed: boolean;
  /** Trust signals for CitizenViewPanel (shown to DRep owners) */
  trustSignals?: TrustSignal[];
  /** Tier label for CitizenViewPanel */
  tier?: string;
  /** Delegator count for CitizenViewPanel */
  delegatorCount?: number;
  /** Participation rate for CitizenViewPanel */
  participationRate?: number;
  /** Rationale rate for CitizenViewPanel */
  rationaleRate?: number;
}

export function DRepDashboardWrapper({
  drepId,
  drepName,
  isClaimed,
  trustSignals,
  tier,
  delegatorCount,
  participationRate,
  rationaleRate,
}: DRepDashboardWrapperProps) {
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
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">Your DRep profile</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {shareButton}
            <Link href="/workspace">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </Button>
            </Link>
            <Link href="/workspace">
              <Button size="sm" className="gap-1.5 text-xs">
                Open Workspace <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
        {trustSignals && trustSignals.length > 0 && tier && (
          <CitizenViewPanel
            drepId={drepId}
            trustSignals={trustSignals}
            tier={tier}
            delegatorCount={delegatorCount ?? 0}
            participationRate={participationRate ?? 0}
            rationaleRate={rationaleRate ?? 0}
          />
        )}
      </div>
    );
  }

  if (!isClaimed && segment !== 'anonymous' && segment !== 'citizen') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-full bg-primary/10 p-1.5 shrink-0">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground block truncate">
              Claim this profile
            </span>
            <span className="text-xs text-muted-foreground">
              Connect your wallet to unlock your workspace and delegator analytics
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {shareButton}
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              posthog.capture('drep_profile_claimed', { drep_id: drepId, step: 'cta_clicked' });
              window.dispatchEvent(new Event('openWalletConnect'));
            }}
          >
            <Wallet className="h-3.5 w-3.5" /> Claim Profile
          </Button>
        </div>
      </div>
    );
  }

  // Claimed by someone else — just show share
  return <div className="flex items-center justify-end px-1 py-1">{shareButton}</div>;
}
