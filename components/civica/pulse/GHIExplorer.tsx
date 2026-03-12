'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainerSlow, fadeInUp, spring } from '@/lib/animations';
import { ShareModal } from '@/components/civica/shared/ShareModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GHIComponentData {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

interface CalibrationCurve {
  floor: number;
  targetLow: number;
  targetHigh: number;
  ceiling: number;
}

interface HistoryEntry {
  epoch: number;
  components: GHIComponentData[] | null;
}

interface GHIExplorerProps {
  components: GHIComponentData[];
  componentHistory: HistoryEntry[];
  calibration: Record<string, CalibrationCurve>;
  componentTrends: Record<string, { direction: string; delta: number }>;
  band: string;
  score: number;
}

const BAND_COLORS: Record<string, string> = {
  strong: 'bg-emerald-500',
  good: 'bg-green-500',
  fair: 'bg-amber-500',
  critical: 'bg-rose-500',
};

const COMPONENT_LABELS: Record<string, string> = {
  drepParticipation: 'DRep Participation',
  citizenEngagement: 'Citizen Engagement',
  deliberationQuality: 'Deliberation Quality',
  governanceEffectiveness: 'Governance Effectiveness',
  powerDistribution: 'Power Distribution',
  systemStability: 'System Stability',
};

const COMPONENT_TOOLTIPS: Record<string, string> = {
  drepParticipation: 'Percentage of active DReps who voted on proposals this epoch',
  citizenEngagement: 'Delegation activity, endorsements, and community sentiment participation',
  deliberationQuality: 'Rationale provision rate and depth of governance deliberation',
  governanceEffectiveness: 'Proposal throughput, vote decisiveness, and outcome delivery',
  powerDistribution: 'Distribution of voting power and delegation diversity across DReps',
  systemStability: 'Protocol parameter stability and governance process consistency',
};

function getCalibrationKey(name: string): string {
  return name.replace(/\s+/g, '').replace(/^./, (c) => c.toLowerCase());
}

function MiniSparkline({ data }: { data: (number | null)[] }) {
  const valid = data.filter((d): d is number => d != null);
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const w = 60;
  const h = 16;
  const points = valid
    .map((v, i) => `${(i / (valid.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');

  const isUp = valid[valid.length - 1] > valid[0];

  return (
    <svg
      width={w}
      height={h}
      className={isUp ? 'text-emerald-500' : 'text-rose-400'}
      aria-label={`Trend: ${valid.map((v) => v.toFixed(0)).join(', ')}`}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function ZoneIndicator({ value, curve }: { value: number; curve: CalibrationCurve }) {
  const position = Math.min(value / curve.ceiling, 1) * 100;
  const zones = [
    { pct: 0, color: 'bg-rose-500/30' },
    { pct: (curve.floor / curve.ceiling) * 100, color: 'bg-amber-500/30' },
    { pct: (curve.targetLow / curve.ceiling) * 100, color: 'bg-green-500/30' },
    { pct: (curve.targetHigh / curve.ceiling) * 100, color: 'bg-emerald-500/30' },
  ];

  return (
    <div
      className="relative h-1.5 rounded-full bg-muted overflow-hidden"
      role="img"
      aria-label={`Calibration zone: value ${Math.round(value)} of ${Math.round(curve.ceiling)} (target range ${Math.round(curve.targetLow)}–${Math.round(curve.targetHigh)})`}
    >
      {zones.map((z, i) => {
        const next = zones[i + 1]?.pct ?? 100;
        return (
          <div
            key={i}
            className={cn('absolute inset-y-0', z.color)}
            style={{ left: `${z.pct}%`, width: `${next - z.pct}%` }}
          />
        );
      })}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-foreground border border-background"
        style={{ left: `${position}%`, transform: `translate(-50%, -50%)` }}
      />
    </div>
  );
}

export function GHIExplorer({
  components,
  componentHistory,
  calibration,
  componentTrends,
  band,
  score,
}: GHIExplorerProps) {
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const barColor = BAND_COLORS[band] ?? BAND_COLORS.fair;

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="ghi-explorer-panel"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? 'Hide breakdown' : 'See what drives this score'}
        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id="ghi-explorer-panel"
            variants={staggerContainerSlow}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3"
          >
            {components
              .filter((c) => c.weight > 0)
              .map((comp) => {
                const calKey = getCalibrationKey(comp.name);
                const curve = calibration[calKey];
                const trend = componentTrends[comp.name];
                const label = COMPONENT_LABELS[calKey] ?? comp.name;
                const tooltipText = COMPONENT_TOOLTIPS[calKey];

                const sparkData = componentHistory
                  .filter((h) => h.components)
                  .map((h) => {
                    const match = h.components!.find((c) => c.name === comp.name);
                    return match?.value ?? null;
                  })
                  .slice(-5);

                const scorePct = Math.min((comp.contribution / comp.weight) * 100, 100);

                return (
                  <motion.div
                    key={comp.name}
                    variants={fadeInUp}
                    className="rounded-lg border border-border/50 bg-card/70 backdrop-blur-md p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      {tooltipText ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-medium cursor-help border-b border-dashed border-muted-foreground/40">
                                {label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-60">
                              <p>{tooltipText}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm font-medium">{label}</span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(comp.weight * 100)}%
                      </span>
                    </div>

                    {/* Score bar */}
                    <div
                      className="relative h-2 rounded-full bg-muted overflow-hidden"
                      role="meter"
                      aria-valuenow={Math.round(comp.value)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${label}: ${Math.round(comp.value)} out of 100`}
                    >
                      <motion.div
                        className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${scorePct}%` }}
                        transition={
                          shouldReduceMotion ? { duration: 0 } : (spring.smooth as object)
                        }
                        aria-hidden="true"
                      />
                    </div>

                    {/* Zone indicator */}
                    {curve && <ZoneIndicator value={comp.value} curve={curve} />}

                    {/* Footer: sparkline + trend */}
                    <div className="flex items-center justify-between">
                      <MiniSparkline data={sparkData} />
                      {trend && trend.delta !== 0 && (
                        <span
                          className={cn(
                            'text-[10px] font-medium',
                            trend.direction === 'up'
                              ? 'text-emerald-500'
                              : trend.direction === 'down'
                                ? 'text-rose-500'
                                : 'text-muted-foreground',
                          )}
                        >
                          {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.delta).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}

            {/* Share button */}
            <motion.div variants={fadeInUp} className="col-span-full flex justify-end">
              <button
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="h-3 w-3" />
                Share GHI Report
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Governance Health Report"
        shareText={`Cardano Governance Health Index: ${Math.round(score)} (${band}). See the full breakdown on Governada.`}
        shareUrl="https://governada.io/pulse"
        ogImageUrl="/api/og/governance-health"
      />
    </>
  );
}
