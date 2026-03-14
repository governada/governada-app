'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Share2, X } from 'lucide-react';
import { ShareModal } from '@/components/governada/shared/ShareModal';
import { useSegment } from '@/components/providers/SegmentProvider';
import { spring } from '@/lib/animations';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DRepWrappedData {
  score_end?: number;
  score_delta?: number;
  votes_cast?: number;
  rationales_written?: number;
  rationale_rate?: number;
  delegators_end?: number;
  participation_rate?: number;
}

interface SPOWrappedData {
  score_end?: number;
  votes_cast?: number;
  participation_rate?: number;
  delegators_end?: number;
}

interface CitizenWrappedData {
  drep_votes_cast?: number;
  drep_rationales?: number;
  epochs_delegating?: number;
  delegated_drep_id?: string;
}

type WrappedData = DRepWrappedData & SPOWrappedData & CitizenWrappedData;

// ── Per-slide gradient themes ─────────────────────────────────────────────────

interface SlideTheme {
  /** CSS gradient for the background */
  gradient: string;
  /** Glow accent color (CSS) */
  glow: string;
  /** Text accent for the stat */
  accent: string;
}

const SLIDE_THEMES: Record<string, SlideTheme> = {
  score: {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 60%)',
    glow: 'rgba(99,102,241,0.2)',
    accent: 'text-indigo-400',
  },
  votes: {
    gradient: 'radial-gradient(ellipse at 70% 30%, rgba(34,197,94,0.12) 0%, transparent 60%)',
    glow: 'rgba(34,197,94,0.18)',
    accent: 'text-emerald-400',
  },
  rationales: {
    gradient: 'radial-gradient(ellipse at 40% 70%, rgba(251,191,36,0.12) 0%, transparent 60%)',
    glow: 'rgba(251,191,36,0.18)',
    accent: 'text-amber-400',
  },
  delegators: {
    gradient: 'radial-gradient(ellipse at 60% 40%, rgba(59,130,246,0.12) 0%, transparent 60%)',
    glow: 'rgba(59,130,246,0.18)',
    accent: 'text-blue-400',
  },
  participation: {
    gradient: 'radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.12) 0%, transparent 60%)',
    glow: 'rgba(34,197,94,0.18)',
    accent: 'text-emerald-400',
  },
  drep_votes: {
    gradient: 'radial-gradient(ellipse at 30% 60%, rgba(139,92,246,0.12) 0%, transparent 60%)',
    glow: 'rgba(139,92,246,0.18)',
    accent: 'text-violet-400',
  },
  epochs: {
    gradient: 'radial-gradient(ellipse at 70% 70%, rgba(236,72,153,0.12) 0%, transparent 60%)',
    glow: 'rgba(236,72,153,0.18)',
    accent: 'text-pink-400',
  },
  final: {
    gradient:
      'radial-gradient(ellipse at 50% 30%, rgba(168,85,247,0.15) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(59,130,246,0.1) 0%, transparent 50%)',
    glow: 'rgba(168,85,247,0.2)',
    accent: 'text-purple-400',
  },
};

function getTheme(slideId: string): SlideTheme {
  return SLIDE_THEMES[slideId] ?? SLIDE_THEMES.score;
}

// ── Score tier colors ─────────────────────────────────────────────────────────

function scoreTierAccent(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function scoreTierGlow(score: number): string {
  if (score >= 80) return 'rgba(34,197,94,0.2)';
  if (score >= 60) return 'rgba(251,191,36,0.2)';
  return 'rgba(239,68,68,0.2)';
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const duration = 800; // ms
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <>
      {display}
      {suffix}
    </>
  );
}

// ── Slide Definitions ─────────────────────────────────────────────────────────

interface Slide {
  id: string;
  stat: string;
  numericValue?: number;
  statSuffix?: string;
  label: string;
  subLabel?: string;
  isFinal?: boolean;
  ogImageUrl?: string;
  shareText?: string;
}

function buildDRepSlides(data: DRepWrappedData, entityId: string, period: string): Slide[] {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return [
    {
      id: 'score',
      stat: `${data.score_end ?? '—'}/100`,
      numericValue: data.score_end,
      statSuffix: '/100',
      label: 'Your governance score this epoch',
      subLabel:
        data.score_delta !== undefined
          ? `${data.score_delta > 0 ? '+' : ''}${data.score_delta} pts`
          : undefined,
    },
    {
      id: 'votes',
      stat: String(data.votes_cast ?? 0),
      numericValue: data.votes_cast ?? 0,
      label: 'Proposals you voted on',
    },
    {
      id: 'rationales',
      stat: String(data.rationales_written ?? 0),
      numericValue: data.rationales_written ?? 0,
      label: 'Rationales you wrote',
    },
    {
      id: 'delegators',
      stat: String(data.delegators_end ?? 0),
      numericValue: data.delegators_end ?? 0,
      label: 'Delegators trusting you',
    },
    {
      id: 'final',
      stat: '✨',
      label: 'Share your Governance Wrapped',
      isFinal: true,
      ogImageUrl: `${BASE}/api/og/wrapped/drep/${encodeURIComponent(entityId)}?period=${period}`,
      shareText: `My Governance Wrapped ${period} — score ${data.score_end ?? '—'}/100, voted on ${data.votes_cast ?? 0} proposals. Check yours on Governada!`,
    },
  ];
}

function buildSPOSlides(data: SPOWrappedData, entityId: string, period: string): Slide[] {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return [
    {
      id: 'score',
      stat: `${data.score_end ?? '—'}/100`,
      numericValue: data.score_end,
      statSuffix: '/100',
      label: 'Your governance score',
    },
    {
      id: 'participation',
      stat: String(data.votes_cast ?? 0),
      numericValue: data.votes_cast ?? 0,
      label: 'Proposals you voted on',
      subLabel:
        data.participation_rate !== undefined
          ? `${data.participation_rate}% participation`
          : undefined,
    },
    {
      id: 'delegators',
      stat: String(data.delegators_end ?? 0),
      numericValue: data.delegators_end ?? 0,
      label: 'Delegators trust you',
    },
    {
      id: 'final',
      stat: '✨',
      label: 'Share your Governance Wrapped',
      isFinal: true,
      ogImageUrl: `${BASE}/api/og/wrapped/spo/${encodeURIComponent(entityId)}?period=${period}`,
      shareText: `My SPO Governance Wrapped ${period} — score ${data.score_end ?? '—'}/100. Check yours on Governada!`,
    },
  ];
}

function buildCitizenSlides(data: CitizenWrappedData, entityId: string, period: string): Slide[] {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return [
    {
      id: 'drep_votes',
      stat: String(data.drep_votes_cast ?? 0),
      numericValue: data.drep_votes_cast ?? 0,
      label: 'Proposals your DRep voted on this epoch',
    },
    {
      id: 'rationales',
      stat: String(data.drep_rationales ?? 0),
      numericValue: data.drep_rationales ?? 0,
      label: 'Votes with published rationales',
    },
    {
      id: 'epochs',
      stat: String(data.epochs_delegating ?? 0),
      numericValue: data.epochs_delegating ?? 0,
      label: "Epochs you've been delegating",
    },
    {
      id: 'final',
      stat: '✨',
      label: 'Share your governance story',
      isFinal: true,
      ogImageUrl: `${BASE}/api/og/wrapped/drep/${encodeURIComponent(data.delegated_drep_id ?? entityId)}?period=${period}`,
      shareText: `My Governance Story ${period}. Check yours on Governada!`,
    },
  ];
}

// ── Slide card component ───────────────────────────────────────────────────────

function SlideCard({
  slide,
  onShare,
  reducedMotion,
}: {
  slide: Slide;
  onShare: () => void;
  reducedMotion: boolean;
}) {
  const isPositive = slide.subLabel?.startsWith('+');
  const isNegative = slide.subLabel?.startsWith('-');
  const theme = getTheme(slide.id);
  const confettiFired = useRef(false);

  // Score slides use tier-aware accent
  const statAccent =
    slide.id === 'score' && slide.numericValue !== undefined
      ? scoreTierAccent(slide.numericValue)
      : theme.accent;

  // Fire confetti on final slide
  useEffect(() => {
    if (!slide.isFinal || confettiFired.current || reducedMotion) return;
    confettiFired.current = true;

    const fire = (angle: number, originX: number) =>
      confetti({
        particleCount: 60,
        angle,
        spread: 55,
        origin: { x: originX, y: 0.65 },
        colors: ['#8b5cf6', '#6366f1', '#3b82f6', '#22c55e', '#f59e0b'],
        disableForReducedMotion: true,
      });

    fire(60, 0);
    fire(120, 1);
    // Second burst slightly delayed
    setTimeout(() => {
      fire(75, 0.2);
      fire(105, 0.8);
    }, 300);
  }, [slide.isFinal, reducedMotion]);

  const statVariants = {
    hidden: reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8, y: 30 },
    visible: reducedMotion
      ? { opacity: 1 }
      : {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { ...spring.bouncy, delay: 0.1 },
        },
    exit: reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -20 },
  };

  const badgeVariants = {
    hidden: reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 },
    visible: reducedMotion
      ? { opacity: 1 }
      : { opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.3 } },
    exit: { opacity: 0 },
  };

  const labelVariants = {
    hidden: reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 },
    visible: reducedMotion
      ? { opacity: 1 }
      : { opacity: 1, y: 0, transition: { delay: 0.5, duration: 0.3 } },
    exit: { opacity: 0 },
  };

  const buttonVariants = {
    hidden: reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 },
    visible: reducedMotion
      ? { opacity: 1 }
      : { opacity: 1, scale: 1, transition: { delay: 0.65, ...spring.snappy } },
    exit: { opacity: 0 },
  };

  const useAnimatedNumber = !reducedMotion && slide.numericValue !== undefined && !slide.isFinal;

  return (
    <motion.div
      key={slide.id}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center justify-center gap-6 text-center px-8"
    >
      {/* Stat */}
      <motion.p
        variants={statVariants}
        className={`text-6xl md:text-8xl font-bold tracking-tight leading-none ${statAccent}`}
      >
        {useAnimatedNumber ? (
          <AnimatedNumber value={slide.numericValue!} suffix={slide.statSuffix ?? ''} />
        ) : (
          slide.stat
        )}
      </motion.p>

      {/* Sub-label badge */}
      {slide.subLabel && (
        <motion.span
          variants={badgeVariants}
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${
            isPositive
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
              : isNegative
                ? 'bg-red-950/40 text-red-400 border-red-900/50'
                : 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {slide.subLabel}
        </motion.span>
      )}

      {/* Label */}
      <motion.p
        variants={labelVariants}
        className="text-lg md:text-xl text-muted-foreground max-w-xs leading-snug"
      >
        {slide.label}
      </motion.p>

      {/* Share button on final slide */}
      {slide.isFinal && (
        <motion.div variants={buttonVariants}>
          <Button onClick={onShare} size="lg" className="mt-2 gap-2">
            <Share2 className="h-4 w-4" />
            Share your Wrapped
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Swipe threshold ───────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 50;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WrappedPage() {
  const params = useParams();
  const period = params.period as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { segment, drepId, poolId, isLoading: segmentLoading } = useSegment();

  const drepIdParam = searchParams.get('drepId');
  const poolIdParam = searchParams.get('poolId');

  const [wrappedData, setWrappedData] = useState<WrappedData | null>(null);
  const [entityType, setEntityType] = useState<string>('drep');
  const [resolvedEntityId, setResolvedEntityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Resolve entity from query params or segment
  useEffect(() => {
    if (segmentLoading) return;

    if (drepIdParam) {
      setEntityType('drep');
      setResolvedEntityId(drepIdParam);
    } else if (poolIdParam) {
      setEntityType('spo');
      setResolvedEntityId(poolIdParam);
    } else if (segment === 'drep' && drepId) {
      setEntityType('drep');
      setResolvedEntityId(drepId);
    } else if (segment === 'spo' && poolId) {
      setEntityType('spo');
      setResolvedEntityId(poolId);
    } else if (segment === 'citizen' || segment === 'anonymous') {
      router.replace('/my-gov');
    }
  }, [segmentLoading, segment, drepId, poolId, drepIdParam, poolIdParam, router]);

  // Fetch wrapped data once entityId is resolved
  const fetchWrapped = useCallback(async () => {
    if (!resolvedEntityId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/my-gov/wrapped/${encodeURIComponent(period)}?entityType=${entityType}&entityId=${encodeURIComponent(resolvedEntityId)}`,
      );
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setWrappedData(json.data ?? null);
    } catch {
      setWrappedData(null);
    } finally {
      setLoading(false);
    }
  }, [resolvedEntityId, period, entityType]);

  useEffect(() => {
    fetchWrapped();
  }, [fetchWrapped]);

  // Build slides
  const slides: Slide[] = (() => {
    if (!wrappedData || !resolvedEntityId) return [];
    if (entityType === 'spo')
      return buildSPOSlides(wrappedData as SPOWrappedData, resolvedEntityId, period);
    if (entityType === 'citizen')
      return buildCitizenSlides(wrappedData as CitizenWrappedData, resolvedEntityId, period);
    return buildDRepSlides(wrappedData as DRepWrappedData, resolvedEntityId, period);
  })();

  const currentSlide = slides[slideIndex];
  const currentTheme = currentSlide ? getTheme(currentSlide.id) : getTheme('score');

  // Score slide uses tier-aware glow
  const activeGlow =
    currentSlide?.id === 'score' && currentSlide.numericValue !== undefined
      ? scoreTierGlow(currentSlide.numericValue)
      : currentTheme.glow;

  const goTo = useCallback(
    (idx: number) => {
      setDirection(idx > slideIndex ? 1 : -1);
      setSlideIndex(idx);
    },
    [slideIndex],
  );

  const prev = useCallback(() => {
    if (slideIndex > 0) goTo(slideIndex - 1);
  }, [slideIndex, goTo]);

  const next = useCallback(() => {
    if (slideIndex < slides.length - 1) goTo(slideIndex + 1);
  }, [slideIndex, slides.length, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  // Swipe handler
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) next();
    else if (info.offset.x > SWIPE_THRESHOLD) prev();
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading || segmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── No data ──────────────────────────────────────────────────────────────
  if (!wrappedData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-2xl">⏳</p>
          <p className="text-base font-medium text-foreground">
            Your Wrapped for this period is being generated
          </p>
          <p className="text-sm text-muted-foreground">Check back shortly.</p>
          <Button variant="outline" onClick={() => router.push('/my-gov')}>
            Back to My Gov
          </Button>
        </div>
      </div>
    );
  }

  // ── Story ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Animated background gradient — crossfades between slide themes */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide?.id ?? 'bg'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 pointer-events-none"
          style={{ background: currentTheme.gradient }}
        />
      </AnimatePresence>

      {/* Ambient glow orb */}
      <motion.div
        className="absolute pointer-events-none rounded-full blur-3xl"
        style={{
          width: 400,
          height: 400,
          top: '15%',
          left: '50%',
          x: '-50%',
          background: activeGlow,
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border/50 backdrop-blur-sm">
        <button
          onClick={() => router.push('/my-gov')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Governance Wrapped · {period}
        </p>
        <div className="w-5" />
      </div>

      {/* Progress bar — animated segments */}
      <div className="relative z-10 flex gap-1 px-4 pt-3">
        {slides.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 rounded-full bg-muted/50 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: i <= slideIndex ? '100%' : '0%' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        ))}
      </div>

      {/* Slide area — swipeable */}
      <motion.div
        className="flex-1 flex items-center justify-center relative z-10"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          {currentSlide && (
            <SlideCard
              key={currentSlide.id}
              slide={currentSlide}
              onShare={() => setShareOpen(true)}
              reducedMotion={reducedMotion}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Navigation */}
      <div className="relative z-10 flex items-center justify-between px-6 pb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={prev}
          disabled={slideIndex === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="relative"
            >
              <div
                className={`rounded-full transition-all duration-200 ${
                  i === slideIndex ? 'bg-primary w-5 h-2' : 'bg-muted w-2 h-2'
                }`}
              />
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={next}
          disabled={slideIndex === slides.length - 1}
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Share modal */}
      {currentSlide?.isFinal && currentSlide.ogImageUrl && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          ogImageUrl={currentSlide.ogImageUrl}
          shareText={currentSlide.shareText ?? `My Governance Wrapped ${period} — Governada`}
          shareUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/wrapped/${entityType}/${encodeURIComponent(resolvedEntityId ?? '')}/${period}`}
          title="Share your Governance Wrapped"
        />
      )}
    </div>
  );
}
