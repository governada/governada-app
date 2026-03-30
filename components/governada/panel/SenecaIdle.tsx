/**
 * SenecaIdle — Idle state content for the Seneca panel.
 *
 * Shows narrated briefing per route, quick action chips (authenticated)
 * or guided options (anonymous).
 */

import { motion, useReducedMotion } from 'framer-motion';
import { CompassSigil } from '@/components/governada/CompassSigil';
import type { PanelRoute } from '@/hooks/useSenecaThread';
import { cn } from '@/lib/utils';

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
}

export function getQuickActions(route: PanelRoute): QuickAction[] {
  switch (route) {
    case 'hub':
      return [
        {
          label: 'Summarize today',
          action: 'conversation',
          query: "What's happening in governance today?",
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
      },
      {
        label: "What's controversial?",
        action: 'conversation',
        query: 'Show me the most controversial proposals with the biggest voting splits',
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
    },
    {
      label: "Who's most active?",
      action: 'conversation',
      query: 'Show me the most active DReps in governance right now',
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
  accentColor,
}: {
  panelRoute: PanelRoute;
  isAuthenticated?: boolean;
  quickActions: QuickAction[];
  anonOptions: GuidedOption[];
  onQuickAction: (action: QuickAction) => void;
  onAnonOption: (option: GuidedOption) => void;
  accentColor?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="px-3 py-3 space-y-3">
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
        <p className="text-sm text-foreground/80 leading-relaxed">{IDLE_BRIEFINGS[panelRoute]}</p>
      </motion.div>

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
    </div>
  );
}
