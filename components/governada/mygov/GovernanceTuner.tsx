'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BellOff,
  Bell,
  BellRing,
  ChevronDown,
  Loader2,
  CheckCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useUser } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getStoredSession } from '@/lib/supabaseAuth';
import {
  GOVERNANCE_DEPTHS,
  TUNER_LEVELS,
  type GovernanceDepth,
  type TunerLevel,
} from '@/lib/governanceTuner';
import { EVENT_REGISTRY, type EventCategory } from '@/lib/notificationRegistry';
import { cn } from '@/lib/utils';

// ── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  BellOff,
  Bell,
  BellRing,
};

// ── Category display metadata ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<EventCategory, string> = {
  drep: 'DRep Activity',
  holder: 'Delegation & Holder',
  ecosystem: 'Ecosystem & Governance',
  digest: 'Digests & Summaries',
  spo: 'Stake Pool Operator',
  citizen: 'Citizen Engagement',
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  drep: 'bg-blue-500/10 text-blue-300',
  holder: 'bg-violet-500/10 text-violet-300',
  ecosystem: 'bg-amber-500/10 text-amber-300',
  digest: 'bg-emerald-500/10 text-emerald-300',
  spo: 'bg-cyan-500/10 text-cyan-300',
  citizen: 'bg-rose-500/10 text-rose-300',
};

const DIGEST_LABELS: Record<string, string> = {
  none: 'No digest emails',
  weekly: 'Weekly digest',
  epoch: 'Every epoch (~5 days)',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoriesForLevel(level: TunerLevel): { category: EventCategory; count: number }[] {
  const enabledSet = new Set(level.eventTypes);
  const categoryMap = new Map<EventCategory, number>();

  for (const event of EVENT_REGISTRY) {
    if (event.key === 'profile-view' || event.key === 'api-health-alert') continue;
    if (!enabledSet.has(event.key)) continue;
    categoryMap.set(event.category, (categoryMap.get(event.category) ?? 0) + 1);
  }

  return Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function getFineTuneEvents() {
  return EVENT_REGISTRY.filter((e) => e.key !== 'profile-view' && e.key !== 'api-health-alert');
}

/** Get a segment-aware depth recommendation hint. */
function getDepthHint(
  segment: string,
  currentDepth: GovernanceDepth,
): { message: string; suggestedDepth: GovernanceDepth } | null {
  if (segment === 'drep' && currentDepth !== 'engaged') {
    return {
      message: 'Most DReps use Engaged to stay on top of votes, deadlines, and delegator signals.',
      suggestedDepth: 'engaged',
    };
  }
  if (segment === 'spo' && currentDepth === 'hands_off') {
    return {
      message:
        'Active pool operators typically use Informed or Engaged to track governance proposals.',
      suggestedDepth: 'informed',
    };
  }
  if (segment === 'citizen' && currentDepth === 'hands_off') {
    return {
      message:
        'Informed keeps you updated on your DRep and critical proposals without overwhelming you.',
      suggestedDepth: 'informed',
    };
  }
  return null;
}

// ── Save function ────────────────────────────────────────────────────────────

async function saveGovernanceDepth(depth: GovernanceDepth): Promise<void> {
  const token = getStoredSession();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ governance_depth: depth }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to save');
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function GovernanceTuner() {
  const { segment } = useSegment();
  const { data: rawUser } = useUser();
  const queryClient = useQueryClient();

  const user = rawUser as Record<string, unknown> | undefined;
  const currentDepth = (user?.governance_depth as GovernanceDepth) ?? 'informed';
  const [selectedDepth, setSelectedDepth] = useState<GovernanceDepth | null>(null);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCascade, setShowCascade] = useState(false);

  // Track previous depth for crossfade
  const [fading, setFading] = useState(false);
  const prevDepthRef = useRef(currentDepth);

  // Effective depth: optimistic selection or persisted value
  const effectiveDepth = selectedDepth ?? currentDepth;
  const level = TUNER_LEVELS[effectiveDepth];

  // Crossfade when depth changes
  useEffect(() => {
    if (prevDepthRef.current !== effectiveDepth) {
      setFading(true);
      const timer = setTimeout(() => setFading(false), 150);
      prevDepthRef.current = effectiveDepth;
      return () => clearTimeout(timer);
    }
  }, [effectiveDepth]);

  const { mutate, isPending } = useMutation({
    mutationFn: saveGovernanceDepth,
    onSuccess: (_data, newDepth) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setSaved(true);
      setShowCascade(true);
      setTimeout(() => setSaved(false), 2000);
      setTimeout(() => setShowCascade(false), 3000);
      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('governance_depth_changed', {
            from: currentDepth,
            to: newDepth,
            source: 'settings_tuner',
          });
        })
        .catch(() => {});
    },
    onError: () => {
      // Revert optimistic selection
      setSelectedDepth(null);
    },
  });

  const handleSelect = useCallback(
    (depth: GovernanceDepth) => {
      if (depth === effectiveDepth) return;
      setSelectedDepth(depth);
      setFineTuneOpen(false);
      mutate(depth);
    },
    [effectiveDepth, mutate],
  );

  const categories = useMemo(() => getCategoriesForLevel(level), [level]);
  const fineTuneEvents = useMemo(() => getFineTuneEvents(), []);

  // Depth hint (C1: segment-aware recommendation)
  const depthHint = useMemo(() => getDepthHint(segment, effectiveDepth), [segment, effectiveDepth]);

  // Event count comparison (B2)
  const eventComparison = useMemo(() => {
    const currentCount = TUNER_LEVELS[effectiveDepth].eventTypes.length;
    const engagedCount = TUNER_LEVELS.engaged.eventTypes.length;
    if (effectiveDepth === 'engaged') return null;
    const diff = engagedCount - currentCount;
    return `${diff} more event types available at Engaged`;
  }, [effectiveDepth]);

  if (segment === 'anonymous') {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-10 text-center space-y-2">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Connect your wallet</p>
        <p className="text-xs text-muted-foreground">Sign in to set your governance depth.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Governance Depth</h3>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {saved && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
        </div>
        <p className="text-sm text-muted-foreground">
          Choose how closely you follow Cardano governance. We&apos;ll tailor your entire experience
          &mdash; notifications, navigation, and information density.
        </p>
      </div>

      {/* Segmented control */}
      <div className="grid grid-cols-3 gap-2">
        {GOVERNANCE_DEPTHS.map((depth) => {
          const lvl = TUNER_LEVELS[depth];
          const Icon = ICON_MAP[lvl.iconName] ?? Bell;
          const isSelected = depth === effectiveDepth;

          return (
            <button
              key={depth}
              onClick={() => handleSelect(depth)}
              disabled={isPending}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center transition-all duration-200 outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-primary bg-primary/15 shadow-lg shadow-primary/20'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
              )}
            >
              {/* Top accent bar */}
              <div
                className={cn(
                  'absolute top-0 left-0 right-0 h-0.5 rounded-t-xl transition-all duration-200',
                  isSelected ? 'bg-primary' : 'bg-transparent',
                )}
              />
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors duration-200',
                  isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span
                className={cn(
                  'text-sm font-medium transition-colors duration-200',
                  isSelected ? 'text-primary' : 'text-foreground',
                )}
              >
                {lvl.label}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {lvl.shortDescription}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cascade confirmation */}
      {showCascade && (
        <p className="text-xs text-emerald-400 animate-in fade-in slide-in-from-top-1 duration-200">
          Experience updated across Hub, Briefing &amp; Notifications
        </p>
      )}

      {/* Preview card */}
      <Card className="overflow-hidden">
        <CardContent
          className={cn(
            'space-y-4 transition-opacity duration-150',
            fading ? 'opacity-0' : 'opacity-100',
          )}
        >
          {/* Level description */}
          <p className="text-sm text-muted-foreground leading-relaxed">{level.description}</p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Digest: </span>
              <span className="font-medium">
                {DIGEST_LABELS[level.digestFrequency] ?? level.digestFrequency}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Events: </span>
              <span className="font-medium">{level.eventTypes.length} types enabled</span>
            </div>
          </div>

          {/* Event comparison (B2) */}
          {eventComparison && (
            <p className="text-xs text-muted-foreground/70 italic">{eventComparison}</p>
          )}

          {/* Category breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Includes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(({ category, count }) => (
                <span
                  key={category}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                    CATEGORY_COLORS[category],
                  )}
                >
                  {CATEGORY_LABELS[category]}
                  <span className="opacity-60">({count})</span>
                </span>
              ))}
            </div>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Only critical system alerts &mdash; no regular notifications.
              </p>
            )}
          </div>
        </CardContent>

        {/* Fine-tune section (Engaged level only) */}
        {effectiveDepth === 'engaged' && (
          <div className="border-t border-border">
            <button
              onClick={() => setFineTuneOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Fine-tune individual events</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  fineTuneOpen && 'rotate-180',
                )}
              />
            </button>

            <div
              className={cn(
                'grid transition-all duration-200',
                fineTuneOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
            >
              <div className="overflow-hidden">
                <FineTunePanel events={fineTuneEvents} enabledKeys={level.eventTypes} />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Depth hint (C1: segment-aware recommendation) */}
      {depthHint && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/5 px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed">{depthHint.message}</p>
            <button
              onClick={() => handleSelect(depthHint.suggestedDepth)}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Switch to {TUNER_LEVELS[depthHint.suggestedDepth].label}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fine-tune panel (read-only preview of what Engaged enables) ──────────────

function FineTunePanel({
  events,
  enabledKeys,
}: {
  events: typeof EVENT_REGISTRY;
  enabledKeys: string[];
}) {
  const enabledSet = useMemo(() => new Set(enabledKeys), [enabledKeys]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<EventCategory, typeof EVENT_REGISTRY>();
    for (const event of events) {
      const list = map.get(event.category) ?? [];
      list.push(event);
      map.set(event.category, list);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="space-y-4 px-6 pb-4">
      <p className="text-xs text-muted-foreground">
        {enabledKeys.length} event types enabled at this level. Individual toggles coming soon.
      </p>
      {grouped.map(([category, categoryEvents]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {CATEGORY_LABELS[category]}
          </p>
          <div className="space-y-1">
            {categoryEvents.map((event) => (
              <div
                key={event.key}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                </div>
                <Switch
                  size="sm"
                  checked={enabledSet.has(event.key)}
                  disabled
                  aria-label={`Toggle ${event.label}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
