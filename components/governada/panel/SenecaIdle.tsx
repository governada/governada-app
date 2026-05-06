/**
 * SenecaIdle — Idle state content for the Seneca panel.
 *
 * Shows narrated briefing per route, quick action chips (authenticated)
 * or guided options (anonymous).
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { CompassSigil } from '@/components/governada/CompassSigil';
import type { PanelRoute } from '@/hooks/useSenecaThread';
import { buildFirstVisitBriefing } from '@/lib/seneca/firstVisitBriefing';
import type { BriefingPathId } from '@/lib/seneca/firstVisitBriefing';
import { getEvergreenFallback } from '@/lib/seneca/evergreenFallbacks';
import { cn } from '@/lib/utils';
import type { UserSegment } from '@/components/providers/SegmentProvider';
import type { PrioritizedItem } from '@/types/cinematic';

// ---------------------------------------------------------------------------
// Route -> human-readable label
// ---------------------------------------------------------------------------

export const ROUTE_LABELS: Record<PanelRoute, string> = {
  hub: 'Home',
  proposal: 'Proposal',
  drep: 'Representative',
  'proposals-list': 'Proposals',
  'representatives-list': 'Representatives',
  health: 'Network Health',
  treasury: 'Treasury',
  workspace: 'Workspace',
  default: 'Governance',
};

// ---------------------------------------------------------------------------
// Idle briefing messages per route
// ---------------------------------------------------------------------------

const IDLE_BRIEFINGS: Record<PanelRoute, string> = {
  hub: "Cardano governance is happening right now. Representatives are voting on proposals that shape the ecosystem's future. I can help you explore what's at stake — or find who should represent your ADA.",
  proposal:
    "Every proposal carries consequences that outlast the epoch it was written in. I can walk you through what this one means, who's voted, and why it matters.",
  drep: 'This representative has a story written in on-chain votes. I can show you their record, their alignment, and how they compare to others you might consider.',
  'proposals-list':
    "Each proposal below could reshape Cardano's direction. Search by topic to find what matters to you, or let me highlight what needs attention.",
  'representatives-list':
    'These are the people who vote on your behalf. Search by priority — treasury transparency, developer funding, decentralization — to find who aligns with your values.',
  health:
    'Governance health tells the story of how well the system is working. Participation, quorum, voting patterns — the vital signs of decentralized democracy.',
  treasury:
    "The treasury funds Cardano's future. I can break down where the money goes, what's being requested, and the spending patterns that shape the ecosystem.",
  workspace:
    'Your workspace is where proposals come to life. I can help with drafting, constitutional compliance, or understanding what makes a proposal succeed.',
  default:
    "I'm Seneca, your governance companion. I can help you explore Cardano governance, find your representative, or discover what's being decided right now.",
};

// ---------------------------------------------------------------------------
// Quick action chips for idle mode (authenticated)
// ---------------------------------------------------------------------------

export interface QuickAction {
  label: string;
  action: 'conversation' | 'research' | 'match' | 'navigate';
  query?: string;
  href?: string;
  /** Globe topic hint — dispatches a warmTopic command when the chip is clicked,
   *  so the globe reacts immediately while Seneca processes the query. */
  globeHint?: string;
}

export function getQuickActions(route: PanelRoute): QuickAction[] {
  switch (route) {
    case 'hub':
      return [
        {
          label: 'Summarize today',
          action: 'conversation',
          query: "What's happening in governance today?",
          globeHint: 'participation',
        },
        { label: 'Find my match', action: 'match' },
        { label: 'Proposals to review', action: 'navigate', href: '/workspace/review' },
        { label: 'My drafts', action: 'navigate', href: '/workspace/author' },
      ];
    case 'proposal':
      return [
        {
          label: 'Summarize this proposal',
          action: 'conversation',
          query: 'Summarize this proposal for me',
        },
        {
          label: 'Who voted and why?',
          action: 'conversation',
          query: 'Who has voted on this proposal and what were their reasons?',
        },
        { label: 'Research deeper', action: 'research', query: 'Deep analysis of this proposal' },
      ];
    case 'drep':
      return [
        {
          label: 'Voting record',
          action: 'conversation',
          query: "What is this representative's voting record?",
        },
        {
          label: 'Alignment profile',
          action: 'conversation',
          query: "Analyze this representative's governance alignment",
        },
      ];
    case 'proposals-list':
      return [
        {
          label: 'What should I vote on?',
          action: 'conversation',
          query: 'Which proposals need attention right now?',
        },
        { label: 'Find my match', action: 'match' },
      ];
    case 'representatives-list':
      return [
        { label: 'Find my match', action: 'match' },
        {
          label: 'Compare top reps',
          action: 'conversation',
          query: 'Compare the top-rated representatives',
        },
      ];
    default:
      return [
        {
          label: 'How does governance work?',
          action: 'conversation',
          query: 'How does Cardano governance work?',
        },
        { label: 'Find my match', action: 'match' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Guided options for anonymous users
// ---------------------------------------------------------------------------

export interface GuidedOption {
  label: string;
  action: 'conversation' | 'match' | 'navigate' | 'search';
  query?: string;
  href?: string;
  path?: BriefingPathId;
}

export function getAnonOptions(route: PanelRoute): GuidedOption[] {
  switch (route) {
    case 'proposals-list':
      return [
        {
          label: 'Treasury spending proposals',
          action: 'search',
          query: 'treasury spending funding',
        },
        { label: 'Protocol changes', action: 'search', query: 'protocol parameter change update' },
        {
          label: 'Most contested proposals',
          action: 'search',
          query: 'contested controversial debate',
        },
        { label: 'Find my representative', action: 'match' },
      ];
    case 'representatives-list':
      return [
        {
          label: 'Treasury transparency advocates',
          action: 'search',
          query: 'treasury transparency accountability',
        },
        {
          label: 'Developer funding supporters',
          action: 'search',
          query: 'developer tooling funding development',
        },
        {
          label: 'Decentralization advocates',
          action: 'search',
          query: 'decentralization community governance',
        },
        { label: 'Find my match', action: 'match' },
      ];
    case 'hub':
      return [
        {
          label: "What's being decided right now?",
          action: 'search',
          query: 'active proposals being voted on',
        },
        { label: 'Find my representative', action: 'match' },
        {
          label: 'How does governance work?',
          action: 'conversation',
          query: 'How does Cardano governance work?',
        },
      ];
    case 'proposal':
      return [
        { label: 'Similar proposals', action: 'search', query: 'proposals like this one' },
        { label: 'Find my representative', action: 'match' },
      ];
    case 'drep':
      return [
        {
          label: 'Similar representatives',
          action: 'search',
          query: 'representatives with similar values',
        },
        { label: 'Find my match', action: 'match' },
      ];
    default:
      return [
        { label: 'Explore proposals', action: 'search', query: 'governance proposals' },
        { label: 'Find my representative', action: 'match' },
        {
          label: 'How does governance work?',
          action: 'conversation',
          query: 'How does Cardano governance work?',
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// Discovery-aware chips for home world (gated by seneca_globe_discovery flag)
// ---------------------------------------------------------------------------

export function getDiscoveryChips(isAuthenticated: boolean): QuickAction[] {
  if (isAuthenticated) {
    return [
      {
        label: 'What did my DRep vote?',
        action: 'conversation',
        query: 'What has my delegated DRep voted on recently?',
        globeHint: 'delegation',
      },
      {
        label: "What's controversial?",
        action: 'conversation',
        query: 'Show me the most controversial proposals with the biggest voting splits',
        globeHint: 'proposals',
      },
      { label: 'Where do I fit?', action: 'match' },
    ];
  }
  return [
    { label: 'Find my place', action: 'match' },
    {
      label: "What's being voted on?",
      action: 'conversation',
      query: 'What proposals are being voted on right now?',
      globeHint: 'proposals',
    },
    {
      label: "Who's most active?",
      action: 'conversation',
      query: 'Show me the most active DReps in governance right now',
      globeHint: 'participation',
    },
  ];
}

// ---------------------------------------------------------------------------
// Sigil state mapping
// ---------------------------------------------------------------------------

export function sigilStateForMode(mode: string) {
  switch (mode) {
    case 'conversation':
      return 'speaking' as const;
    case 'research':
      return 'searching' as const;
    case 'matching':
      return 'thinking' as const;
    case 'search':
      return 'searching' as const;
    default:
      return 'idle' as const;
  }
}

// ---------------------------------------------------------------------------
// IdleContent component
// ---------------------------------------------------------------------------

export function IdleContent({
  panelRoute,
  isAuthenticated,
  quickActions,
  anonOptions,
  onQuickAction,
  onAnonOption,
  cinematicPrimary,
  cinematicSecondary = [],
  cinematicReasoning,
  cinematicSegment = 'anonymous',
  canRecordLifecycle,
  onPrioritizationAction,
  accentColor,
}: {
  panelRoute: PanelRoute;
  isAuthenticated?: boolean;
  quickActions: QuickAction[];
  anonOptions: GuidedOption[];
  onQuickAction: (action: QuickAction) => void;
  onAnonOption: (option: GuidedOption) => void;
  cinematicPrimary?: PrioritizedItem;
  cinematicSecondary?: PrioritizedItem[];
  cinematicReasoning?: string;
  cinematicSegment?: UserSegment;
  canRecordLifecycle?: boolean;
  onPrioritizationAction?: (item: PrioritizedItem, action: 'acknowledge' | 'dismiss') => void;
  accentColor?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const firstVisitBriefing =
    cinematicPrimary?.state === 'first_visit_anonymous'
      ? buildFirstVisitBriefing({ segment: cinematicSegment })
      : null;

  return (
    <div className="px-3 py-3 space-y-3">
      {firstVisitBriefing && cinematicPrimary ? (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="space-y-3"
        >
          <div className="flex gap-2 items-start">
            <div className="shrink-0 mt-0.5">
              <CompassSigil state="idle" size={14} accentColor={accentColor} />
            </div>
            <div className="space-y-2">
              {firstVisitBriefing.moves.map((move) => (
                <p key={move.id} className="text-sm text-foreground/80 leading-relaxed">
                  {move.text}
                </p>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            {firstVisitBriefing.paths.map((path) => (
              <button
                key={path.id}
                type="button"
                onClick={() =>
                  onAnonOption({
                    label: path.label,
                    action: path.action,
                    query: path.query,
                    path: path.id,
                  })
                }
                className={cn(
                  'w-full rounded-lg border border-white/10 px-3 py-2 text-left',
                  'text-sm text-foreground/85 hover:border-white/20 hover:bg-white/5',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                {path.label}
              </button>
            ))}
          </div>

          <LifecycleActions
            item={cinematicPrimary}
            canRecordLifecycle={canRecordLifecycle}
            onPrioritizationAction={onPrioritizationAction}
          />
        </motion.div>
      ) : (
        <>
          {cinematicPrimary && (
            <CinematicStateCard
              item={cinematicPrimary}
              reasoning={cinematicReasoning}
              canRecordLifecycle={canRecordLifecycle}
              onPrioritizationAction={onPrioritizationAction}
            />
          )}

          {/* Narrated briefing */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex gap-2 items-start"
          >
            <div className="shrink-0 mt-0.5">
              <CompassSigil state="idle" size={14} accentColor={accentColor} />
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {IDLE_BRIEFINGS[panelRoute]}
            </p>
          </motion.div>
        </>
      )}

      {/* Quick actions (authenticated) or guided options (anonymous) */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.2 }}
        className="flex flex-wrap gap-1.5"
      >
        {isAuthenticated
          ? quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onQuickAction(action)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  'border border-white/[0.08] bg-white/[0.04]',
                  'hover:bg-white/[0.08] hover:border-white/[0.12]',
                  'text-foreground/70 hover:text-foreground/90',
                  'transition-colors min-h-[32px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                {action.label}
              </button>
            ))
          : anonOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onAnonOption(option)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  'border border-white/[0.08] bg-white/[0.04]',
                  'hover:bg-white/[0.08] hover:border-white/[0.12]',
                  'text-foreground/70 hover:text-foreground/90',
                  'transition-colors min-h-[32px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                {option.label}
              </button>
            ))}
      </motion.div>

      {cinematicSecondary.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
            Still in view
          </p>
          {cinematicSecondary.slice(0, 3).map((item) => (
            <CinematicStateCard
              key={item.id}
              item={item}
              compact
              canRecordLifecycle={canRecordLifecycle}
              onPrioritizationAction={onPrioritizationAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CinematicStateCard({
  item,
  reasoning,
  compact,
  canRecordLifecycle,
  onPrioritizationAction,
}: {
  item: PrioritizedItem;
  reasoning?: string;
  compact?: boolean;
  canRecordLifecycle?: boolean;
  onPrioritizationAction?: (item: PrioritizedItem, action: 'acknowledge' | 'dismiss') => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border border-white/[0.08] bg-white/[0.03]',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
        {item.state.replace(/_/g, ' ')}
      </p>
      <p className={cn('mt-1 text-foreground/80 leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
        {getEvergreenFallback(item.state)}
      </p>
      {reasoning && <p className="mt-2 text-[11px] text-muted-foreground/60">{reasoning}</p>}
      <LifecycleActions
        item={item}
        canRecordLifecycle={canRecordLifecycle}
        onPrioritizationAction={onPrioritizationAction}
      />
    </motion.div>
  );
}

function LifecycleActions({
  item,
  canRecordLifecycle,
  onPrioritizationAction,
}: {
  item: PrioritizedItem;
  canRecordLifecycle?: boolean;
  onPrioritizationAction?: (item: PrioritizedItem, action: 'acknowledge' | 'dismiss') => void;
}) {
  if (item.acknowledged_at || item.dismissed_at) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        disabled={!canRecordLifecycle}
        onClick={() => onPrioritizationAction?.(item, 'acknowledge')}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1',
          'text-[11px] font-medium transition-colors',
          canRecordLifecycle
            ? 'bg-white/[0.08] text-foreground/75 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            : 'cursor-not-allowed bg-white/5 text-muted-foreground/35',
        )}
      >
        <Check className="h-3 w-3" />
        Got it
      </button>
      <button
        type="button"
        disabled={!canRecordLifecycle}
        onClick={() => onPrioritizationAction?.(item, 'dismiss')}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1',
          'text-[11px] font-medium transition-colors',
          canRecordLifecycle
            ? 'text-muted-foreground/65 hover:bg-white/[0.08] hover:text-foreground/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            : 'cursor-not-allowed text-muted-foreground/30',
        )}
      >
        <X className="h-3 w-3" />
        Dismiss
      </button>
    </div>
  );
}
