'use client';

/**
 * DiscoveryPanel — Sheet content for the Discovery Hub.
 *
 * Shows persona-filtered feature map organized by JTBD categories,
 * tour launchers, and exploration progress.
 */

import { useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Play,
  Trophy,
  BookOpen,
  Users,
  Eye,
  Zap,
  Fingerprint,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDiscovery } from '@/hooks/useDiscovery';
import { posthog } from '@/lib/posthog';

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  understand: BookOpen,
  'find-reps': Users,
  monitor: Eye,
  'take-action': Zap,
  identity: Fingerprint,
  learn: GraduationCap,
};

interface DiscoveryPanelProps {
  onStartTour: (tourId: string, startRoute: string) => void;
  onClose: () => void;
}

export function DiscoveryPanel({ onStartTour, onClose }: DiscoveryPanelProps) {
  const { state, featuresByCategory, tours, explorationProgress, markFeatureExplored } =
    useDiscovery();

  const handleFeatureClick = useCallback(
    (featureId: string) => {
      markFeatureExplored(featureId);
      posthog.capture('discovery_feature_clicked', {
        feature_id: featureId,
      });
      onClose();
    },
    [markFeatureExplored, onClose],
  );

  const handleTourStart = useCallback(
    (tourId: string, startRoute: string) => {
      posthog.capture('discovery_tour_started', {
        tour_id: tourId,
        source: 'hub',
      });
      onStartTour(tourId, startRoute);
    },
    [onStartTour],
  );

  // Progress ring (larger for the panel header)
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (explorationProgress.percent / 100) * circumference;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header with progress ── */}
      <div className="flex items-center gap-4 px-5 pt-5 pb-4 border-b border-border/30">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="-rotate-90" aria-hidden="true">
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted/20"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-primary transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
            {explorationProgress.percent}%
          </span>
        </div>
        <div>
          <h2 className="text-base font-semibold">Explore Governada</h2>
          <p className="text-xs text-muted-foreground">
            {explorationProgress.explored} of {explorationProgress.total} features discovered
          </p>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-hide">
        {/* Available tours */}
        {tours.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Guided Tours
            </h3>
            <div className="space-y-1.5">
              {tours.map((tour) => {
                const isCompleted = state.toursCompleted.includes(tour.id);
                return (
                  <button
                    key={tour.id}
                    onClick={() => handleTourStart(tour.id, tour.startRoute)}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      isCompleted ? 'opacity-60 hover:bg-muted/30' : 'hover:bg-primary/5',
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-full shrink-0',
                        isCompleted ? 'bg-emerald-500/10' : 'bg-primary/10',
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          isCompleted && 'text-muted-foreground',
                        )}
                      >
                        {tour.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{tour.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature map by JTBD category */}
        {featuresByCategory.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] ?? BookOpen;
          return (
            <div key={category.id}>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Icon className="h-3.5 w-3.5" />
                {category.label}
              </h3>
              <div className="space-y-0.5">
                {category.features.map((feature) => {
                  const isExplored = state.featuresExplored.includes(feature.id);
                  return (
                    <Link
                      key={feature.id}
                      href={feature.href}
                      onClick={() => handleFeatureClick(feature.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                        isExplored ? 'opacity-60' : 'hover:bg-primary/5',
                      )}
                    >
                      {isExplored ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{feature.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {feature.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Recent milestones */}
        {state.milestonesShown.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <Trophy className="h-3.5 w-3.5" />
              Milestones
            </h3>
            <div className="flex flex-wrap gap-2">
              {state.milestonesShown.slice(-3).map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20"
                >
                  <Trophy className="h-3 w-3" />
                  {id.replace(/-/g, ' ').replace(/^first /, '')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-3 border-t border-border/30">
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" asChild>
          <Link href="/help" onClick={onClose}>
            View all help resources
          </Link>
        </Button>
      </div>
    </div>
  );
}
