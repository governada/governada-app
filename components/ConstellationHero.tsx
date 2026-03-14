'use client';

/* eslint-disable react-hooks/set-state-in-effect -- async/external state sync in useEffect is standard React pattern */
import { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { useGovernanceHolder } from '@/hooks/queries';
import { posthog } from '@/lib/posthog';
import { ActivityTicker } from '@/components/ActivityTicker';
import { PersonalizedStatsStrip } from '@/components/PersonalizedStatsStrip';
import dynamic from 'next/dynamic';
import { ConstellationSearch } from '@/components/ConstellationSearch';
import { ConstellationNodeDetail } from '@/components/ConstellationNodeDetail';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

import type { UserSegment } from '@/components/PersonalGovernanceCard';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import type { AlignmentDimension } from '@/lib/drepIdentity';

interface PersonalCardData {
  segment: UserSegment;
  [key: string]: unknown;
}

interface ConstellationHeroProps {
  stats: {
    totalAdaGoverned: string;
    activeProposals: number;
    activeDReps: number;
    activeSpOs: number;
    ccMembers: number;
  };
  ssrHolderData?: Record<string, unknown>;
  ssrWalletAddress?: string;
  onPersonalCard?: (data: PersonalCardData | null) => void;
}

export function ConstellationHero({
  stats,
  ssrHolderData,
  ssrWalletAddress,
  onPersonalCard,
}: ConstellationHeroProps) {
  const constellationRef = useRef<ConstellationRef>(null);
  const { isAuthenticated, delegatedDrepId, ownDRepId, address } = useWallet();
  const [constellationReady, setConstellationReady] = useState(false);
  const [showPersonalCard, setShowPersonalCard] = useState(!!ssrHolderData);
  const [holderData, setHolderData] = useState<Record<string, unknown> | null>(
    ssrHolderData || null,
  );
  const [contracted, setContracted] = useState(!!ssrHolderData);
  const [hasTriggeredFindMe, setHasTriggeredFindMe] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [hasHovered, setHasHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const isInteractive = false;
  const [selectedNode, setSelectedNode] = useState<ConstellationNode3D | null>(null);

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

  // Fetch holder data via TanStack Query (skip if SSR data provided)
  const holderStakeAddress = !ssrHolderData && isAuthenticated ? (address ?? undefined) : undefined;
  const { data: hookHolderData } = useGovernanceHolder(holderStakeAddress);

  useEffect(() => {
    if (hookHolderData) setHolderData(hookHolderData as Record<string, unknown>);
  }, [hookHolderData]);

  // Trigger find-me animation when holder data becomes available
  useEffect(() => {
    if (!isAuthenticated || ssrHolderData || hasTriggeredFindMe) return;
    if (!hookHolderData) return;
    setHasTriggeredFindMe(true);

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
  }, [
    hookHolderData,
    isAuthenticated,
    ssrHolderData,
    hasTriggeredFindMe,
    constellationReady,
    ownDRepId,
    delegatedDrepId,
  ]);

  const handleConstellationReady = useCallback(() => {
    setConstellationReady(true);
  }, []);

  const handleConstellationContracted = useCallback(() => {
    setContracted(true);
  }, []);

  const handleTickerEvent = useCallback((drepId: string) => {
    constellationRef.current?.pulseNode(drepId);
  }, []);

  const searchInputRef = useRef<HTMLDivElement>(null);

  const handleNodeSelect = useCallback((node: ConstellationNode3D) => {
    setSelectedNode(node);
    posthog.capture('constellation_node_clicked', {
      nodeType: node.nodeType,
      nodeId: node.id,
      nodeName: node.name,
    });
  }, []);

  const handleSearchSelect = useCallback((drepId: string) => {
    constellationRef.current?.flyToNode(drepId);
    posthog.capture('constellation_search_used', { drepId });
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedNode(null);
    constellationRef.current?.resetCamera();
  }, []);

  useEffect(() => {
    if (!isInteractive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedNode) {
        setSelectedNode(null);
        constellationRef.current?.resetCamera();
      }
      if (e.key === '/' && !selectedNode) {
        const active = document.activeElement?.tagName;
        if (active === 'INPUT' || active === 'TEXTAREA') return;
        e.preventDefault();
        const input = searchInputRef.current?.querySelector('input');
        input?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInteractive, selectedNode]);

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
      const h = holderData.delegationHealth as Record<string, unknown>;
      const epochSecondsRemaining = getEpochCountdown();
      return {
        segment: 'delegated' as const,
        delegated: {
          drepName: (h.drepName as string) || 'Your DRep',
          drepId: (h.drepId as string) || delegatedDrepId || '',
          drepScore: (h.drepScore as number) || 0,
          scoreTrend: (holderData.repScoreDelta as number | null) ?? null,
          representationMatch:
            ((holderData.representationScore as Record<string, unknown> | undefined)?.score as
              | number
              | null) ?? null,
          openProposals: (h.openProposalCount as number) || 0,
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
          drepScore:
            ((holderData?.delegationHealth as Record<string, unknown> | undefined)
              ?.drepScore as number) || 0,
          scoreTrend: (holderData?.repScoreDelta as number | null) ?? null,
          rank: 0,
          totalRanked: stats.activeDReps,
          delegatorCount: 0,
          pendingProposals: (holderData?.activeProposals as unknown[] | undefined)?.length || 0,
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
      className={`relative w-full transition-all duration-700 -mt-16 ${contracted ? 'min-h-[calc(35vh+4rem)]' : 'min-h-[calc(65vh+4rem)]'}`}
      onMouseEnter={handleConstellationHover}
    >
      <ConstellationScene
        ref={constellationRef}
        interactive={isInteractive}
        onReady={handleConstellationReady}
        onContracted={handleConstellationContracted}
        onNodeSelect={isInteractive ? handleNodeSelect : undefined}
        className={contracted ? 'h-[35vh]' : 'h-[65vh]'}
      />

      {/* SSR gradient fallback */}
      <div
        className={`absolute inset-0 z-[1] bg-gradient-to-b from-[#0a0b14] via-[#0f1225] to-[#0a0b14] transition-opacity duration-700 pointer-events-none ${constellationReady ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Interactive constellation search overlay */}
      {isInteractive && constellationReady && !showPersonalCard && (
        <div
          ref={searchInputRef}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4 animate-fade-in-up pointer-events-auto"
        >
          <ConstellationSearch onSelect={handleSearchSelect} />
        </div>
      )}

      {/* Interactive constellation detail panel */}
      {isInteractive && <ConstellationNodeDetail node={selectedNode} onClose={handleDetailClose} />}

      {/* First-hover educational tooltip */}
      {showTooltip && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 text-sm animate-fade-in-up pointer-events-none">
          Each point represents a governance participant — DReps, Stake Pools, and Committee Members
        </div>
      )}

      {/* Text Overlay */}
      {!showPersonalCard && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-start pt-[14vh] md:justify-center md:pt-0 z-10 pointer-events-none px-4 transition-opacity duration-700 ${constellationReady ? 'opacity-100' : 'opacity-0'}`}
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center max-w-4xl leading-tight animate-fade-in-up hero-text-shadow">
            <span className="text-white">This is Cardano governance. All of it.</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base md:text-lg text-white/80 text-center max-w-2xl animate-fade-in-up animation-delay-200 hero-text-shadow">
            {stats.activeDReps.toLocaleString()} DReps. {stats.activeSpOs} Pools. {stats.ccMembers}{' '}
            Committee Members. {stats.totalAdaGoverned} ADA.
          </p>

          {/* Live stats strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-white/60 animate-fade-in-up animation-delay-200 hero-text-shadow">
            <span>{stats.activeDReps.toLocaleString()} DReps</span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span>{stats.activeSpOs} Pools</span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span>{stats.ccMembers} CC Members</span>
          </div>

          {segment !== null && !showPersonalCard && (
            <PersonalizedStatsStrip
              drepName={
                (holderData?.delegationHealth as Record<string, unknown> | undefined)?.drepName as
                  | string
                  | undefined
              }
              drepScore={
                (holderData?.delegationHealth as Record<string, unknown> | undefined)?.drepScore as
                  | number
                  | undefined
              }
              scoreTrend={holderData?.repScoreDelta as number | null | undefined}
              openProposals={(holderData?.activeProposals as unknown[] | undefined)?.length}
              governanceLevel={holderData?.governanceLevel as string | undefined}
              visitStreak={holderData?.visitStreak as number | undefined}
              walletAddress={ssrWalletAddress || ''}
            />
          )}

          {/* Tri-body legend */}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-white/60 animate-fade-in-up animation-delay-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              DReps
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              Pools
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Committee
            </span>
          </div>

          {!isAuthenticated && !ssrWalletAddress ? (
            <Link
              href="/match"
              className="mt-8 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-all pointer-events-auto animate-fade-in-up animation-delay-400 animate-cta-pulse inline-block"
            >
              Find your governance match
            </Link>
          ) : isAuthenticated && !showPersonalCard ? (
            <Link
              href="/my-gov"
              className="mt-8 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-all pointer-events-auto animate-fade-in-up animation-delay-400 inline-block"
            >
              See what changed
            </Link>
          ) : null}

          {/* Scroll-down indicator */}
          <div
            className={`mt-6 transition-opacity duration-500 animate-bounce ${scrolledPastHero ? 'opacity-0' : 'opacity-60'}`}
          >
            <ChevronDown className="w-6 h-6 text-white/70" />
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
