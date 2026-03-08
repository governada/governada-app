'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award, Calendar, Shield, Share2 } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { useGovernanceHolder } from '@/hooks/queries';
import { Card, CardContent } from './ui/card';
import { ShareActions } from './ShareActions';
import { fadeInUp } from '@/lib/animations';
import { BASE_URL } from '@/lib/constants';

interface GovernanceIdentity {
  drepName: string | null;
  drepScore: number | null;
  drepId: string | null;
  delegatedSinceEpoch: number | null;
  currentEpoch: number | null;
  quizAlignment: string | null;
  delegationStreak: number;
}

export function DelegatorGovernanceCard() {
  const { isAuthenticated, address, delegatedDrepId } = useWallet();
  const stakeAddress = isAuthenticated ? (address ?? undefined) : undefined;
  const { data: holderData, isLoading } = useGovernanceHolder(stakeAddress);

  const identity = useMemo<GovernanceIdentity | null>(() => {
    const d = holderData as Record<string, unknown> | undefined;
    if (!d) return null;
    const del = d.delegation as Record<string, unknown> | undefined;
    const quiz = d.quizResult as Record<string, unknown> | undefined;
    return {
      drepName: (del?.drepName as string) ?? null,
      drepScore: (del?.drepScore as number) ?? null,
      drepId: (del?.drepId as string) ?? delegatedDrepId ?? null,
      delegatedSinceEpoch: (del?.delegatedSinceEpoch as number) ?? null,
      currentEpoch: (d.currentEpoch as number) ?? null,
      quizAlignment: (quiz?.topAlignment as string) ?? null,
      delegationStreak: (del?.streak as number) ?? 0,
    };
  }, [holderData, delegatedDrepId]);

  if (!isAuthenticated || isLoading || !identity) return null;

  const epochsActive =
    identity.currentEpoch && identity.delegatedSinceEpoch
      ? identity.currentEpoch - identity.delegatedSinceEpoch
      : null;

  const shareUrl = `${BASE_URL}/governance`;
  const shareText = identity.drepName
    ? `I've been an active governance citizen for ${epochsActive ?? '?'} epochs, delegating to ${identity.drepName} (score: ${identity.drepScore ?? '?'}/100) on @drepscore.`
    : `I'm participating in Cardano governance on @drepscore.`;

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Your Governance Identity</h3>
                <p className="text-[11px] text-muted-foreground">
                  Share your governance participation
                </p>
              </div>
            </div>
            <ShareActions
              url={shareUrl}
              text={shareText}
              imageUrl={`${BASE_URL}/api/og/governance-identity?wallet=${address ?? ''}`}
              imageFilename="governance-identity.png"
              surface="delegator_governance_card"
              variant="compact"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {epochsActive != null && (
              <StatBadge
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Epochs Active"
                value={String(epochsActive)}
              />
            )}
            {identity.drepName && (
              <StatBadge
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Delegated To"
                value={
                  identity.drepName.length > 14
                    ? `${identity.drepName.slice(0, 14)}...`
                    : identity.drepName
                }
              />
            )}
            {identity.drepScore != null && (
              <StatBadge
                icon={<Award className="h-3.5 w-3.5" />}
                label="DRep Score"
                value={`${identity.drepScore}/100`}
              />
            )}
            {identity.quizAlignment && (
              <StatBadge
                icon={<Share2 className="h-3.5 w-3.5" />}
                label="Alignment"
                value={identity.quizAlignment}
              />
            )}
          </div>

          {identity.delegatedSinceEpoch && (
            <div className="mt-3 rounded-lg bg-primary/5 px-3 py-1.5 text-center">
              <span className="text-[11px] font-medium text-primary">
                Governance Citizen since Epoch {identity.delegatedSinceEpoch}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-2 text-center">
      <div className="mb-1 flex justify-center text-muted-foreground">{icon}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
