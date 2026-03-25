'use client';

/**
 * ObservatoryLayout — the unified governance observatory.
 *
 * Three instrument panels (Treasury, Committee, Health) synchronized
 * via a shared playback engine. Desktop: three-column mission control.
 * Mobile: swipeable carousel with fixed playback bar.
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Wallet, Shield, Activity, ArrowLeft, Maximize2, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ObservatoryFocus } from '@/lib/observatory/types';
import { TreasurySankeyPanel } from './instruments/TreasurySankeyPanel';
import { CommitteeHemicyclePanel } from './instruments/CommitteeHemicyclePanel';
import { HealthVitalTracesPanel } from './instruments/HealthVitalTracesPanel';
import { ObservatoryNarrativeBar } from './narrative/ObservatoryNarrativeBar';
import { GovernanceWrapped } from './wrapped/GovernanceWrapped';
import { useGovernanceHealthIndex, useObservatoryNarratives } from '@/hooks/queries';
import { useEpochContext } from '@/hooks/useEpochContext';
import { FeatureGate } from '@/components/FeatureGate';

interface ObservatoryLayoutProps {
  initialFocus?: ObservatoryFocus;
}

const PANEL_CONFIG = [
  { key: 'treasury' as const, label: 'Treasury', icon: Wallet, color: 'text-amber-400' },
  { key: 'committee' as const, label: 'Chamber', icon: Shield, color: 'text-violet-400' },
  { key: 'health' as const, label: 'Vitals', icon: Activity, color: 'text-emerald-400' },
];

export function ObservatoryLayout({ initialFocus }: ObservatoryLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  // Determine focus from URL or prop
  const focusParam = (searchParams.get('focus') as ObservatoryFocus) ?? initialFocus ?? null;
  const [expandedPanel, setExpandedPanel] = useState<ObservatoryFocus>(focusParam);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [showWrapped, setShowWrapped] = useState(false);

  // Get current epoch: prefer GHI history, fall back to EpochContext (always valid)
  const epochCtx = useEpochContext();
  const { data: ghiData, isLoading: ghiLoading } = useGovernanceHealthIndex(5);
  const currentEpoch = useMemo(() => {
    const data = ghiData as { history?: { epoch: number }[] } | undefined;
    const history = data?.history;
    if (!ghiLoading && Array.isArray(history) && history.length > 0) {
      return Math.max(...history.map((h) => h.epoch));
    }
    // Fall back to client-computed current epoch so we never show epoch 0
    return epochCtx.epoch;
  }, [ghiData, ghiLoading, epochCtx.epoch]);

  // Observatory narratives (for drilldown panels)
  const { data: narratives } = useObservatoryNarratives(currentEpoch);

  const handleExpand = useCallback(
    (panel: ObservatoryFocus) => {
      setExpandedPanel(panel);
      if (panel) {
        router.replace(`/governance/observatory?focus=${panel}`, { scroll: false });
      }
    },
    [router],
  );

  const handleCollapse = useCallback(() => {
    setExpandedPanel(null);
    router.replace('/governance/observatory', { scroll: false });
  }, [router]);

  // Mobile swipe tracking
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    setMobileIndex((prev) => {
      if (direction === 'left') return Math.min(prev + 1, 2);
      return Math.max(prev - 1, 0);
    });
  }, []);

  // Always show live data — no playback/replay
  const playbackPosition = 1;
  const isLive = true;

  // If a panel is expanded, show the full detail view
  if (expandedPanel) {
    return (
      <div className="space-y-0">
        {/* Back button */}
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={handleCollapse}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Observatory
          </button>
        </div>

        {/* Expanded panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={expandedPanel}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {expandedPanel === 'treasury' && (
              <TreasurySankeyPanel
                expanded
                position={playbackPosition}
                isLive={isLive}
                narrative={narratives?.treasury}
              />
            )}
            {expandedPanel === 'committee' && (
              <CommitteeHemicyclePanel
                expanded
                position={playbackPosition}
                isLive={isLive}
                narrative={narratives?.committee}
              />
            )}
            {expandedPanel === 'health' && (
              <HealthVitalTracesPanel
                expanded
                position={playbackPosition}
                isLive={isLive}
                narrative={narratives?.health}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Three-panel Observatory view
  return (
    <div className="space-y-0">
      {/* AI Narrative */}
      <ObservatoryNarrativeBar epoch={currentEpoch} />

      {/* Desktop: Three-panel layout */}
      <div className="hidden md:grid md:grid-cols-3 gap-3 px-4 py-3">
        {PANEL_CONFIG.map((panel) => (
          <motion.div
            key={panel.key}
            className="relative rounded-xl border border-border/30 bg-card/60 backdrop-blur-md overflow-hidden cursor-pointer group hover:border-border/60 transition-colors"
            onClick={() => handleExpand(panel.key)}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.005 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
              <div className="flex items-center gap-1.5">
                <panel.icon className={cn('w-3.5 h-3.5', panel.color)} />
                <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  {panel.label}
                </span>
              </div>
              <Maximize2 className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
            </div>

            {/* Panel content */}
            <div className="p-3 min-h-[240px]">
              {panel.key === 'treasury' && (
                <TreasurySankeyPanel position={playbackPosition} isLive={isLive} />
              )}
              {panel.key === 'committee' && (
                <CommitteeHemicyclePanel position={playbackPosition} isLive={isLive} />
              )}
              {panel.key === 'health' && (
                <HealthVitalTracesPanel position={playbackPosition} isLive={isLive} />
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mobile: Swipeable carousel */}
      <div className="md:hidden">
        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 py-2">
          {PANEL_CONFIG.map((panel, i) => (
            <button
              key={panel.key}
              onClick={() => setMobileIndex(i)}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                mobileIndex === i ? 'bg-primary' : 'bg-muted-foreground/20',
              )}
              aria-label={`View ${panel.label}`}
            />
          ))}
        </div>

        {/* Swipeable panel */}
        <motion.div
          className="px-4 overflow-hidden"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) handleSwipe('left');
            if (info.offset.x > 50) handleSwipe('right');
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={mobileIndex}
              initial={prefersReducedMotion ? undefined : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              <div
                className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md overflow-hidden"
                onClick={() => handleExpand(PANEL_CONFIG[mobileIndex].key)}
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const Icon = PANEL_CONFIG[mobileIndex].icon;
                      return (
                        <Icon className={cn('w-3.5 h-3.5', PANEL_CONFIG[mobileIndex].color)} />
                      );
                    })()}
                    <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                      {PANEL_CONFIG[mobileIndex].label}
                    </span>
                  </div>
                  <Maximize2 className="w-3 h-3 text-muted-foreground/40" />
                </div>

                {/* Panel content */}
                <div className="p-3 min-h-[280px]">
                  {mobileIndex === 0 && (
                    <TreasurySankeyPanel position={playbackPosition} isLive={isLive} />
                  )}
                  {mobileIndex === 1 && (
                    <CommitteeHemicyclePanel position={playbackPosition} isLive={isLive} />
                  )}
                  {mobileIndex === 2 && (
                    <HealthVitalTracesPanel position={playbackPosition} isLive={isLive} />
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Governance Wrapped CTA */}
      {currentEpoch > 0 && (
        <FeatureGate flag="governance_wrapped">
          <div className="px-4 py-3">
            <button
              onClick={() => setShowWrapped(true)}
              className="w-full rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 px-4 py-3 flex items-center gap-3 transition-colors group"
            >
              <Gift className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">
                  Epoch {currentEpoch > 1 ? currentEpoch - 1 : currentEpoch} Wrapped is ready
                </p>
                <p className="text-xs text-muted-foreground">
                  See your governance recap and share it
                </p>
              </div>
              <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View →
              </span>
            </button>
          </div>
        </FeatureGate>
      )}

      {/* Wrapped modal */}
      {showWrapped && currentEpoch > 0 && (
        <GovernanceWrapped
          epoch={currentEpoch > 1 ? currentEpoch - 1 : currentEpoch}
          onClose={() => setShowWrapped(false)}
        />
      )}
    </div>
  );
}
