'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Calendar, Shield, Share2 } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ShareActions } from './ShareActions';
import { fadeInUp, spring } from '@/lib/animations';
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
  const [identity, setIdentity] = useState<GovernanceIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const token = getStoredSession();
    if (!token) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (delegatedDrepId) params.set('drepId', delegatedDrepId);

    fetch(`/api/governance/holder?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setIdentity({
          drepName: data.delegation?.drepName ?? null,
          drepScore: data.delegation?.drepScore ?? null,
          drepId: data.delegation?.drepId ?? delegatedDrepId ?? null,
          delegatedSinceEpoch: data.delegation?.delegatedSinceEpoch ?? null,
          currentEpoch: data.currentEpoch ?? null,
          quizAlignment: data.quizResult?.topAlignment ?? null,
          delegationStreak: data.delegation?.streak ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, delegatedDrepId]);

  if (!isAuthenticated || loading || !identity) return null;

  const epochsActive = identity.currentEpoch && identity.delegatedSinceEpoch
    ? identity.currentEpoch - identity.delegatedSinceEpoch
    : null;

  const shareUrl = `${BASE_URL}/governance`;
  const shareText = identity.drepName
    ? `I've been an active governance citizen for ${epochsActive ?? '?'} epochs, delegating to ${identity.drepName} (score: ${identity.drepScore ?? '?'}/100) on @drepscore.`
    : `I'm participating in Cardano governance on @drepscore.`;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
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
                <p className="text-[11px] text-muted-foreground">Share your governance participation</p>
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
                value={identity.drepName.length > 14 ? `${identity.drepName.slice(0, 14)}...` : identity.drepName}
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

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-2 text-center">
      <div className="mb-1 flex justify-center text-muted-foreground">{icon}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
