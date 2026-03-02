'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { ActivityTicker } from '@/components/ActivityTicker';
import type { UserSegment } from '@/components/PersonalGovernanceCard';
import { getStoredSession } from '@/lib/supabaseAuth';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { AlignmentDimension } from '@/lib/drepIdentity';

const GovernanceConstellation = dynamic(
  () => import('@/components/GovernanceConstellation').then(m => ({ default: m.GovernanceConstellation })),
  { ssr: false }
);

interface PersonalCardData {
  segment: UserSegment;
  [key: string]: any;
}

interface ConstellationHeroProps {
  stats: {
    totalAdaGoverned: string;
    activeProposals: number;
    activeDReps: number;
  };
  ssrHolderData?: any;
  ssrWalletAddress?: string;
  onPersonalCard?: (data: PersonalCardData | null) => void;
}

export function ConstellationHero({ stats, ssrHolderData, ssrWalletAddress, onPersonalCard }: ConstellationHeroProps) {
  const constellationRef = useRef<ConstellationRef>(null);
  const { isAuthenticated, delegatedDrepId, ownDRepId } = useWallet();
  const [constellationReady, setConstellationReady] = useState(false);
  const [showPersonalCard, setShowPersonalCard] = useState(!!ssrHolderData);
  const [holderData, setHolderData] = useState<any>(ssrHolderData || null);
  const [contracted, setContracted] = useState(!!ssrHolderData);
  const [hasTriggeredFindMe, setHasTriggeredFindMe] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [hasHovered, setHasHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Determine user segment
  const segment: UserSegment | null = (() => {
    if (!isAuthenticated && !ssrWalletAddress) return null;
    if (ownDRepId) return 'drep';
    if (delegatedDrepId) return 'delegated';
    return 'undelegated';
  })();

  // Reset state when wallet disconnects
  const prevAuth = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) {
      setShowPersonalCard(false);
      setContracted(false);
      setHolderData(null);
      setHasTriggeredFindMe(false);
      constellationRef.current?.resetCamera();
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated]);

  // When wallet connects (client-side), fetch holder data and trigger find-me
  useEffect(() => {
    if (!isAuthenticated || ssrHolderData || hasTriggeredFindMe) return;
    setHasTriggeredFindMe(true);

    const token = getStoredSession();
    if (!token) return;

    const params = new URLSearchParams();
    if (delegatedDrepId) params.set('drepId', delegatedDrepId);

    fetch(`/api/governance/holder?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setHolderData(data);

        // Trigger find-me animation
        if (constellationReady && constellationRef.current) {
          const target = ownDRepId
            ? { type: 'drep' as const, drepId: ownDRepId }
            : delegatedDrepId
              ? { type: 'delegated' as const, drepId: delegatedDrepId }
              : { type: 'undelegated' as const };

          constellationRef.current.findMe(target).then(() => {
            setContracted(true);
            setShowPersonalCard(true);
          });
        } else {
          setContracted(true);
          setShowPersonalCard(true);
        }
      })
      .catch(() => {
        setContracted(true);
        setShowPersonalCard(true);
      });
  }, [isAuthenticated, delegatedDrepId, ownDRepId, ssrHolderData, constellationReady, hasTriggeredFindMe]);

  const handleConstellationReady = useCallback(() => {
    setConstellationReady(true);
  }, []);

  const handleConstellationContracted = useCallback(() => {
    setContracted(true);
  }, []);

  const handleTickerEvent = useCallback((drepId: string) => {
    constellationRef.current?.pulseNode(drepId);
  }, []);

  const handleConnectWallet = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openWalletConnect', { detail: { skipPushPrompt: true } }));
  }, []);

  const handleConstellationHover = useCallback(() => {
    if (hasHovered) return;
    setHasHovered(true);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 3500);
  }, [hasHovered]);

  // Build personal card data from holder API response
  const personalCardProps = (() => {
    if (!segment) return null;

    if (segment === 'undelegated') {
      return {
        segment: 'undelegated' as const,
        undelegated: { totalAdaGoverned: stats.totalAdaGoverned },
      };
    }

    if (segment === 'delegated' && holderData?.delegationHealth) {
      const h = holderData.delegationHealth;
      const epochSecondsRemaining = getEpochCountdown();
      return {
        segment: 'delegated' as const,
        delegated: {
          drepName: h.drepName || 'Your DRep',
          drepId: h.drepId || delegatedDrepId || '',
          drepScore: h.drepScore || 0,
          scoreTrend: holderData.repScoreDelta ?? null,
          representationMatch: holderData.representationScore?.score ?? null,
          openProposals: h.openProposalCount || 0,
          epochCountdown: epochSecondsRemaining,
          dominant: 'transparency' as AlignmentDimension,
        },
      };
    }

    if (segment === 'drep') {
      return {
        segment: 'drep' as const,
        drep: {
          drepId: ownDRepId || '',
          drepScore: holderData?.delegationHealth?.drepScore || 0,
          scoreTrend: holderData?.repScoreDelta ?? null,
          rank: 0,
          totalRanked: stats.activeDReps,
          delegatorCount: 0,
          pendingProposals: holderData?.activeProposals?.length || 0,
          dominant: 'transparency' as AlignmentDimension,
        },
      };
    }

    return null;
  })();

  // Notify parent of personal card data changes
  useEffect(() => {
    onPersonalCard?.(showPersonalCard ? personalCardProps : null);
  }, [showPersonalCard, personalCardProps, onPersonalCard]);

  return (
    <div
      className={`relative w-full transition-all duration-700 ${contracted ? 'min-h-[40vh]' : 'min-h-[85vh]'}`}
      onMouseEnter={handleConstellationHover}
      onClick={!isAuthenticated && !ssrWalletAddress ? handleConnectWallet : undefined}
      role={!isAuthenticated && !ssrWalletAddress ? 'button' : undefined}
      style={!isAuthenticated && !ssrWalletAddress ? { cursor: 'pointer' } : undefined}
    >
      <GovernanceConstellation
        ref={constellationRef}
        onReady={handleConstellationReady}
        onContracted={handleConstellationContracted}
        className={contracted ? 'h-[40vh]' : 'h-[85vh]'}
      />

      {/* SSR gradient fallback */}
      <div
        className={`absolute inset-0 z-[1] bg-gradient-to-b from-[#0a0b14] via-[#0f1225] to-[#0a0b14] transition-opacity duration-700 pointer-events-none ${constellationReady ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* First-hover educational tooltip */}
      {showTooltip && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 text-sm animate-fade-in-up pointer-events-none">
          Each point is a real DRep representative
        </div>
      )}

      {/* Text Overlay */}
      {!showPersonalCard && (
        <div className={`absolute inset-0 flex flex-col items-center justify-start pt-[14vh] md:justify-center md:pt-0 z-10 pointer-events-none px-4 transition-opacity duration-700 ${constellationReady ? 'opacity-100' : 'opacity-0'}`}>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center max-w-4xl leading-tight animate-fade-in-up hero-text-shadow"
          >
            <span className="text-white">
              This is what decentralized governance looks like.
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base md:text-lg text-white/60 text-center max-w-2xl animate-fade-in-up animation-delay-200 hero-text-shadow">
            {stats.activeDReps.toLocaleString()} representatives. {stats.totalAdaGoverned} ADA. Every vote shapes Cardano&apos;s future.
          </p>

          {/* Live stats strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-white/40 animate-fade-in-up animation-delay-200 hero-text-shadow">
            <span>{stats.activeDReps.toLocaleString()} Active DReps</span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span>{stats.totalAdaGoverned} ADA Governed</span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span>{stats.activeProposals} Open Proposals</span>
          </div>

          {!isAuthenticated && !ssrWalletAddress && (
            <button
              onClick={(e) => { e.stopPropagation(); handleConnectWallet(); }}
              className="mt-8 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-all pointer-events-auto animate-fade-in-up animation-delay-400 animate-cta-pulse"
            >
              Enter Governance
            </button>
          )}

          {/* Scroll-down indicator */}
          <div
            className={`mt-6 transition-opacity duration-500 animate-bounce ${scrolledPastHero ? 'opacity-0' : 'opacity-60'}`}
          >
            <ChevronDown className="w-6 h-6 text-white/50" />
          </div>
        </div>
      )}

      <ActivityTicker onEventVisible={handleTickerEvent} />
    </div>
  );
}

function getEpochCountdown(): string {
  // Cardano epochs are 5 days. Epoch 0 started at 1596491091 (unix)
  const epochLength = 432000; // 5 days in seconds
  const epochStart = 1596491091;
  const now = Math.floor(Date.now() / 1000);
  const currentEpochStart = epochStart + Math.floor((now - epochStart) / epochLength) * epochLength;
  const nextEpochStart = currentEpochStart + epochLength;
  const remaining = nextEpochStart - now;

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}
