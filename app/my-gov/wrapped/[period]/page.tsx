'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Share2, X } from 'lucide-react';
import { ShareModal } from '@/components/civica/shared/ShareModal';
import { useSegment } from '@/components/providers/SegmentProvider';

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

// ── Slide Definitions ─────────────────────────────────────────────────────────

interface Slide {
  id: string;
  stat: string;
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
      label: 'Your governance score this epoch',
      subLabel:
        data.score_delta !== undefined
          ? `${data.score_delta > 0 ? '+' : ''}${data.score_delta} pts`
          : undefined,
    },
    {
      id: 'votes',
      stat: String(data.votes_cast ?? 0),
      label: 'Proposals you voted on',
    },
    {
      id: 'rationales',
      stat: String(data.rationales_written ?? 0),
      label: 'Rationales you wrote',
    },
    {
      id: 'delegators',
      stat: String(data.delegators_end ?? 0),
      label: 'Delegators trusting you',
    },
    {
      id: 'final',
      stat: '✨',
      label: 'Share your Governance Wrapped',
      isFinal: true,
      ogImageUrl: `${BASE}/api/og/wrapped/drep/${encodeURIComponent(entityId)}?period=${period}`,
      shareText: `My Governance Wrapped ${period} — score ${data.score_end ?? '—'}/100, voted on ${data.votes_cast ?? 0} proposals. Check yours on DRepScore!`,
    },
  ];
}

function buildSPOSlides(data: SPOWrappedData, entityId: string, period: string): Slide[] {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return [
    {
      id: 'score',
      stat: `${data.score_end ?? '—'}/100`,
      label: 'Your governance score',
    },
    {
      id: 'participation',
      stat: String(data.votes_cast ?? 0),
      label: 'Proposals you voted on',
      subLabel:
        data.participation_rate !== undefined
          ? `${data.participation_rate}% participation`
          : undefined,
    },
    {
      id: 'delegators',
      stat: String(data.delegators_end ?? 0),
      label: 'Delegators trust you',
    },
    {
      id: 'final',
      stat: '✨',
      label: 'Share your Governance Wrapped',
      isFinal: true,
      ogImageUrl: `${BASE}/api/og/wrapped/spo/${encodeURIComponent(entityId)}?period=${period}`,
      shareText: `My SPO Governance Wrapped ${period} — score ${data.score_end ?? '—'}/100. Check yours on DRepScore!`,
    },
  ];
}

function buildCitizenSlides(data: CitizenWrappedData, entityId: string, period: string): Slide[] {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return [
    {
      id: 'drep_votes',
      stat: String(data.drep_votes_cast ?? 0),
      label: 'Proposals your DRep voted on this epoch',
    },
    {
      id: 'rationales',
      stat: String(data.drep_rationales ?? 0),
      label: 'Votes with published rationales',
    },
    {
      id: 'epochs',
      stat: String(data.epochs_delegating ?? 0),
      label: "Epochs you've been delegating",
    },
    {
      id: 'final',
      stat: '✨',
      label: 'Share your governance story',
      isFinal: true,
      ogImageUrl: `${BASE}/api/og/wrapped/drep/${encodeURIComponent(data.delegated_drep_id ?? entityId)}?period=${period}`,
      shareText: `My Governance Story ${period}. Check yours on DRepScore!`,
    },
  ];
}

// ── Slide card component ───────────────────────────────────────────────────────

function SlideCard({ slide, onShare }: { slide: Slide; onShare: () => void }) {
  const isPositive = slide.subLabel?.startsWith('+');
  const isNegative = slide.subLabel?.startsWith('-');

  return (
    <motion.div
      key={slide.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-6 text-center px-8"
    >
      <p className="text-6xl md:text-8xl font-bold tracking-tight text-foreground leading-none">
        {slide.stat}
      </p>

      {slide.subLabel && (
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${
            isPositive
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
              : isNegative
                ? 'bg-red-950/40 text-red-400 border-red-900/50'
                : 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {slide.subLabel}
        </span>
      )}

      <p className="text-lg md:text-xl text-muted-foreground max-w-xs leading-snug">
        {slide.label}
      </p>

      {slide.isFinal && (
        <Button onClick={onShare} className="mt-2 gap-2">
          <Share2 className="h-4 w-4" />
          Share this
        </Button>
      )}
    </motion.div>
  );
}

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
      // no entityId available — redirect
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

  const prev = () => setSlideIndex((i) => Math.max(0, i - 1));
  const next = () => setSlideIndex((i) => Math.min(slides.length - 1, i + 1));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading || segmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── No data ──────────────────────────────────────────────────────────────
  if (!wrappedData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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

      {/* Progress bar */}
      <div className="flex gap-1 px-4 pt-3">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= slideIndex ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          {currentSlide && (
            <SlideCard
              key={currentSlide.id}
              slide={currentSlide}
              onShare={() => setShareOpen(true)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 pb-8">
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
              onClick={() => setSlideIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === slideIndex ? 'bg-primary w-4 h-2' : 'bg-muted w-2 h-2'
              }`}
            />
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
          shareText={currentSlide.shareText ?? `My Governance Wrapped ${period} — DRepScore`}
          shareUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/wrapped/${entityType}/${encodeURIComponent(resolvedEntityId ?? '')}/${period}`}
          title="Share your Governance Wrapped"
        />
      )}
    </div>
  );
}
