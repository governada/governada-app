'use client';

import { useRef, useState, useCallback, useEffect, lazy, Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Users,
  ShieldCheck,
  Activity,
  Zap,
  Vote,
  HelpCircle,
  Coins,
} from 'lucide-react';
import {
  useInView,
  useSpring,
  useTransform,
  useScroll,
  useReducedMotion,
  motion,
  AnimatePresence,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { posthog } from '@/lib/posthog';
import dynamic from 'next/dynamic';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import type { ConstellationRef } from '@/components/GovernanceConstellation';

const MatchPromptPanel = lazy(() =>
  import('@/components/governada/match/MatchPromptPanel').then((m) => ({
    default: m.MatchPromptPanel,
  })),
);

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);
import { useQuery } from '@tanstack/react-query';
import { staggerContainer, fadeInUp } from '@/lib/animations';

/** Typewriter text — reveals text character by character */
function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedLength(text.length);
      return;
    }
    setDisplayedLength(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedLength(i);
      if (i >= text.length) clearInterval(interval);
    }, 25); // ~40 chars/second
    return () => clearInterval(interval);
  }, [text, prefersReducedMotion]);

  return (
    <span className={className}>
      {text.slice(0, displayedLength)}
      {displayedLength < text.length && <span className="animate-pulse text-primary/60">|</span>}
    </span>
  );
}

/** Fetches governance narrative and renders with typewriter effect */
function NarrativeLine({ fallback }: { fallback: string }) {
  const { data } = useQuery({
    queryKey: ['homepage-narrative'],
    queryFn: async () => {
      const res = await fetch('/api/homepage/narrative');
      if (!res.ok) return null;
      return res.json() as Promise<{ narrative: string; healthScore: number; urgency: number }>;
    },
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });

  const text = data?.narrative ?? fallback;

  return (
    <p
      className="text-sm sm:text-base text-white/70 text-center tabular-nums max-w-lg"
      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
    >
      <TypewriterText text={text} />
    </p>
  );
}

// --- Tier badge colors ---
const TIER_STYLES: Record<string, string> = {
  diamond: 'bg-cyan-950/40 text-cyan-300',
  legendary: 'bg-purple-950/40 text-purple-300',
  gold: 'bg-yellow-950/40 text-yellow-400',
  silver: 'bg-gray-800/40 text-gray-300',
  bronze: 'bg-orange-950/40 text-orange-400',
  emerging: 'bg-teal-950/40 text-teal-400',
};

function getTierFromScore(score: number): string {
  if (score >= 90) return 'diamond';
  if (score >= 80) return 'legendary';
  if (score >= 65) return 'gold';
  if (score >= 50) return 'silver';
  if (score >= 35) return 'bronze';
  return 'emerging';
}

/** Floating hover card for globe node interaction */
function NodeHoverCard({ node }: { node: ConstellationNode3D }) {
  const tier = getTierFromScore(node.score);
  const typeLabel =
    node.nodeType === 'drep' ? 'DRep' : node.nodeType === 'spo' ? 'SPO' : 'CC Member';
  const typeColor =
    node.nodeType === 'drep'
      ? 'text-teal-400'
      : node.nodeType === 'spo'
        ? 'text-violet-400'
        : 'text-amber-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-white/10 bg-black/85 backdrop-blur-md px-4 py-3 shadow-2xl max-w-[280px]"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', typeColor)}>
          {typeLabel}
        </span>
        <span
          className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded',
            TIER_STYLES[tier] ?? TIER_STYLES.emerging,
          )}
        >
          {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </span>
      </div>
      <p className="text-sm font-semibold text-white truncate">
        {node.name || `${node.id.slice(0, 12)}...`}
      </p>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-white/60">
        <span>
          Score <strong className="text-white/90">{node.score}</strong>
        </span>
        {node.power > 0 && (
          <span>
            Power{' '}
            <strong className="text-white/90">
              {'\u20B3'}
              {(node.power * 100).toFixed(0)}M
            </strong>
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/40 mt-1.5">Click to explore &rarr;</p>
    </motion.div>
  );
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const spring = useSpring(0, { stiffness: 75, damping: 15 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());

  if (prefersReducedMotion) {
    return <span className={className}>{value.toLocaleString()}</span>;
  }

  if (isInView) spring.set(value);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
}

interface HomeAnonymousProps {
  pulseData: PulseData;
}

export function HomeAnonymous({ pulseData }: HomeAnonymousProps) {
  const heroRef = useRef<HTMLElement>(null);
  const globeRef = useRef<ConstellationRef>(null);
  const prefersReducedMotion = useReducedMotion();
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [matchPanelOpen, setMatchPanelOpen] = useState(false);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const handleNodeHover = useCallback((node: ConstellationNode3D | null) => {
    setHoveredNode(node);
  }, []);

  const handleAlignmentChange = useCallback((alignments: number[], threshold: number) => {
    globeRef.current?.highlightMatches(alignments, threshold);
  }, []);

  const handleMatchFound = useCallback((drepId: string) => {
    globeRef.current?.flyToMatch(drepId);
  }, []);

  const handleMatchClose = useCallback(() => {
    setMatchPanelOpen(false);
    globeRef.current?.clearMatches();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* ── Living Globe hero ──────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative h-[65vh] sm:h-[calc(65vh+3.5rem)] min-h-[500px] sm:-mt-14 overflow-hidden"
        aria-label="Living governance constellation — interactive 3D visualization"
      >
        <div className="absolute inset-0">
          <ConstellationScene
            ref={globeRef}
            className="w-full h-full"
            interactive
            breathing={!prefersReducedMotion}
            healthScore={75}
            urgency={Math.min(100, pulseData.activeProposals * 2)}
            onNodeHover={handleNodeHover}
          />
        </div>

        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Hover card for globe nodes */}
        <AnimatePresence>
          {hoveredNode && !matchPanelOpen && <NodeHoverCard node={hoveredNode} />}
        </AnimatePresence>

        {/* Match CTA — floating button when panel is closed */}
        {!matchPanelOpen && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            onClick={() => {
              setMatchPanelOpen(true);
              posthog?.capture('living_globe_match_cta_clicked');
            }}
            className="absolute bottom-6 left-4 z-40 inline-flex items-center gap-2 rounded-xl bg-primary/90 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary transition-colors shadow-lg"
          >
            <Zap className="h-4 w-4" />
            Find Your Match
          </motion.button>
        )}

        {/* Match prompt panel — compact side panel */}
        <AnimatePresence>
          {matchPanelOpen && (
            <Suspense fallback={null}>
              <MatchPromptPanel
                onAlignmentChange={handleAlignmentChange}
                onMatchFound={handleMatchFound}
                onClose={handleMatchClose}
              />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Live data overlay on constellation */}
        <div className="absolute top-16 sm:top-20 left-4 right-4 flex justify-center pointer-events-none">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-3 sm:gap-6 text-white/60 text-[10px] sm:text-xs tracking-wider uppercase rounded-full bg-black/40 backdrop-blur-sm px-4 py-1.5 shadow-lg pointer-events-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="tabular-nums hover:text-white/90 transition-colors duration-200 cursor-default">
                    <strong className="text-teal-400 font-bold">{pulseData.activeDReps}</strong>{' '}
                    DReps
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-black/90 border-white/10 backdrop-blur-md max-w-[220px]"
                >
                  <p className="text-xs text-white/90 leading-relaxed">
                    <strong className="text-teal-400">Delegated Representatives</strong> who vote on
                    governance proposals on behalf of ADA holders
                  </p>
                </TooltipContent>
              </Tooltip>
              <span className="text-white/20">&middot;</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="tabular-nums hover:text-white/90 transition-colors duration-200 cursor-default">
                    <strong className="text-violet-400 font-bold">{pulseData.activeSpOs}</strong>{' '}
                    SPOs
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-black/90 border-white/10 backdrop-blur-md max-w-[220px]"
                >
                  <p className="text-xs text-white/90 leading-relaxed">
                    <strong className="text-violet-400">Stake Pool Operators</strong> who run the
                    network and vote on protocol changes
                  </p>
                </TooltipContent>
              </Tooltip>
              <span className="text-white/20">&middot;</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="tabular-nums hover:text-white/90 transition-colors duration-200 cursor-default">
                    <strong className="text-amber-400 font-bold">{pulseData.ccMembers}</strong> CC
                    Members
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-black/90 border-white/10 backdrop-blur-md max-w-[220px]"
                >
                  <p className="text-xs text-white/90 leading-relaxed">
                    <strong className="text-amber-400">Constitutional Committee</strong> members who
                    ensure proposals comply with the Cardano Constitution
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Value prop + dynamic narrative overlay */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-end pb-20 px-4 pointer-events-none"
          style={prefersReducedMotion ? {} : { opacity: heroTextOpacity }}
        >
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-lg leading-tight text-center mb-3">
            Your ADA gives you a voice.
          </h1>

          {/* Dynamic AI narrative — changes every visit */}
          <NarrativeLine
            fallback={
              pulseData.activeProposals > 0
                ? `${pulseData.activeProposals} proposals being decided. ₳${pulseData.totalAdaGoverned} at stake.`
                : 'Explore the governance network above.'
            }
          />
        </motion.div>
      </section>

      {/* ── Two-Path Entry ─────────────────────────────────────────── */}
      <section className="relative z-10 -mt-10 px-4 mx-auto w-full max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Path 1: Govern — Quick Match */}
          <Link
            href="/match"
            onClick={() => posthog?.capture('citizen_path_clicked', { path: 'govern' })}
            className={cn(
              'group relative rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm p-6',
              'hover:border-primary/60 hover:bg-card/90 transition-all',
            )}
          >
            <div className="absolute -inset-0.5 rounded-xl bg-primary/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Govern</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Find a DRep who votes the way you would. 3 questions, 60 seconds, matched to{' '}
                {pulseData.activeDReps}+ representatives.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Find My DRep
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Path 2: Stake — Pool Discovery */}
          <Link
            href="/governance/pools"
            onClick={() => posthog?.capture('citizen_path_clicked', { path: 'stake' })}
            className={cn(
              'group relative rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6',
              'hover:border-primary/40 hover:bg-card/90 transition-all',
            )}
          >
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <Coins className="h-5 w-5 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Stake</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Find a stake pool that represents your values. Compare governance scores, voting
                records, and community alignment.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Browse Pools
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── What is governance? ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-2xl px-4 mt-8">
        <div className="rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Why does this matter?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cardano has a ratified constitution, a treasury worth billions of ADA, and elected
                representatives. Protocol changes, treasury spending, and staking rewards are all
                decided by governance votes. Every ADA holder has a voice &mdash; you just need to
                use it.
              </p>
              <Link href="/learn" className="text-xs text-primary hover:underline inline-block">
                Learn more about Cardano governance &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live governance stats ──────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 mt-8 mb-8">
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {[
            {
              icon: Vote,
              label: 'Open Proposals',
              value: pulseData.activeProposals,
              sub: 'awaiting votes',
            },
            {
              icon: Users,
              label: 'Active DReps',
              value: pulseData.activeDReps,
              sub: 'voting right now',
            },
            {
              icon: ShieldCheck,
              label: 'SPOs Governing',
              value: pulseData.activeSpOs,
              sub: 'pools participating',
            },
            {
              icon: Activity,
              label: 'Votes This Week',
              value: pulseData.votesThisWeek.toLocaleString(),
              sub: 'across all bodies',
            },
          ].map((s) => (
            <motion.div
              key={s.label}
              variants={fadeInUp}
              className={cn(
                'rounded-xl border bg-card/60 backdrop-blur-sm p-4 space-y-1',
                s.label === 'Open Proposals' && (s.value as number) > 0
                  ? 'border-primary/40'
                  : 'border-border',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="h-3.5 w-3.5 text-primary/50" />
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                {typeof s.value === 'number' ? <AnimatedNumber value={s.value} /> : s.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Social proof strip ──────────────────────────────────────── */}
      <motion.section
        className="mx-auto w-full max-w-4xl px-4 pb-8"
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        <div className="rounded-xl border border-border/50 bg-muted/30 px-6 py-4 space-y-2">
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Citizens are already shaping Cardano&apos;s future
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                <AnimatedNumber value={pulseData.totalDReps} />
              </strong>{' '}
              DReps scored
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                <AnimatedNumber value={pulseData.claimedDReps} />
              </strong>{' '}
              profiles claimed
            </span>
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                <AnimatedNumber value={pulseData.votesThisWeek} />
              </strong>{' '}
              votes cast this week
            </span>
          </div>
        </div>
      </motion.section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <motion.section
        className="mx-auto w-full max-w-2xl px-4 pb-16"
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-foreground">Ready to use your voice?</p>
          <Link
            href="/match"
            onClick={() => posthog?.capture('citizen_path_clicked', { path: 'govern_bottom' })}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3',
              'text-sm font-semibold text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
            )}
          >
            <Zap className="h-4 w-4" />
            Find My DRep — 60 Seconds
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
