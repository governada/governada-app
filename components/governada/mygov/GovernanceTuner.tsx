'use client';

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BellOff,
  Bell,
  BellRing,
  BellPlus,
  ChevronDown,
  Loader2,
  CheckCircle,
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
  BellPlus,
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

  // Effective depth: optimistic selection or persisted value
  const effectiveDepth = selectedDepth ?? currentDepth;
  const level = TUNER_LEVELS[effectiveDepth];

  const { mutate, isPending } = useMutation({
    mutationFn: saveGovernanceDepth,
    onSuccess: (_data, newDepth) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  ? 'border-primary bg-primary/15 shadow-sm'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
              )}
            >
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

              {/* Selection indicator dot */}
              <div
                className={cn(
                  'absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background transition-all duration-200',
                  isSelected ? 'scale-100 bg-primary' : 'scale-0 bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Preview card */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-4">
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

          {/* Category breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Includes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(({ category, count }) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
                >
                  {CATEGORY_LABELS[category]}
                  <span className="text-muted-foreground">({count})</span>
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

        {/* Fine-tune section (Deep level only) */}
        {(effectiveDepth === 'engaged' || effectiveDepth === 'deep') && (
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
                'grid transition-all duration-300 ease-in-out',
                fineTuneOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <FineTunePanel events={fineTuneEvents} enabledKeys={level.eventTypes} />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Fine-tune panel (read-only preview of what Deep enables) ─────────────────

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
