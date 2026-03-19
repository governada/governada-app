import {
  Activity,
  BellOff,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  Compass,
  Globe,
  HelpCircle,
  Home,
  Landmark,
  Link2,
  LogOut,
  MessageSquare,
  PenLine,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  SlidersHorizontal,
  User,
  Users,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { UserSegment } from '@/components/providers/SegmentProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  group:
    | 'recent'
    | 'pages'
    | 'governance'
    | 'dreps'
    | 'proposals'
    | 'actions'
    | 'help'
    | 'settings';
  icon?: LucideIcon;
  href?: string;
  action?: () => void;
  shortcut?: string; // Chord notation: "G P", "G R", etc.
  score?: number;
  segment?: UserSegment | UserSegment[]; // Only show for these segments
}

// ---------------------------------------------------------------------------
// Page commands — updated routes + chord shortcuts
// ---------------------------------------------------------------------------

export const PAGE_COMMANDS: CommandItem[] = [
  {
    id: 'page-home',
    label: 'Home',
    sublabel: 'Your governance dashboard',
    group: 'pages',
    icon: Home,
    href: '/',
    shortcut: 'G H',
  },
  {
    id: 'page-proposals',
    label: 'Proposals',
    sublabel: 'Browse active governance proposals',
    group: 'pages',
    icon: ScrollText,
    href: '/governance/proposals',
    shortcut: 'G P',
  },
  {
    id: 'page-representatives',
    label: 'Representatives',
    sublabel: 'DReps and stake pool operators',
    group: 'pages',
    icon: Users,
    href: '/governance/representatives',
    shortcut: 'G R',
  },
  {
    id: 'page-treasury',
    label: 'Treasury',
    sublabel: 'Cardano treasury overview',
    group: 'pages',
    icon: Wallet,
    href: '/governance/treasury',
    shortcut: 'G T',
  },
  {
    id: 'page-committee',
    label: 'Constitutional Committee',
    sublabel: 'CC member scores and voting records',
    group: 'pages',
    icon: Landmark,
    href: '/governance/committee',
    shortcut: 'G C',
  },
  {
    id: 'page-health',
    label: 'Governance Health',
    sublabel: 'GHI score and ecosystem vitals',
    group: 'pages',
    icon: Activity,
    href: '/governance/health',
    shortcut: 'G E',
  },
  {
    id: 'page-pools',
    label: 'Stake Pools',
    sublabel: 'Pool governance scores and delegation',
    group: 'pages',
    icon: Building2,
    href: '/governance/pools',
  },
  {
    id: 'page-you',
    label: 'You',
    sublabel: 'Your civic identity and settings',
    group: 'pages',
    icon: User,
    href: '/you',
    shortcut: 'G Y',
    segment: ['citizen', 'drep', 'spo', 'cc'],
  },
  {
    id: 'page-match',
    label: 'Match',
    sublabel: 'Find your ideal representative',
    group: 'pages',
    icon: Compass,
    href: '/match',
    shortcut: 'G M',
  },
  {
    id: 'page-workspace',
    label: 'Workspace',
    sublabel: 'Voting, reviews, and governance tools',
    group: 'pages',
    icon: Vote,
    href: '/workspace',
    shortcut: 'G W',
    segment: ['drep', 'spo', 'citizen', 'cc'],
  },
  {
    id: 'page-settings',
    label: 'Settings',
    sublabel: 'Profile, notifications, and preferences',
    group: 'pages',
    icon: Settings,
    href: '/you/settings',
    shortcut: 'G S',
    segment: ['citizen', 'drep', 'spo', 'cc'],
  },
  {
    id: 'page-delegation',
    label: 'Delegation',
    sublabel: 'Manage your delegation status',
    group: 'pages',
    icon: Link2,
    href: '/you/delegation',
    segment: ['citizen', 'drep', 'spo'],
  },
  {
    id: 'page-author',
    label: 'Author Proposals',
    sublabel: 'Draft and submit governance proposals',
    group: 'pages',
    icon: PenLine,
    href: '/workspace/author',
    segment: ['citizen', 'drep', 'spo', 'cc'],
  },
];

// ---------------------------------------------------------------------------
// Help commands (previously in header Help dropdown)
// ---------------------------------------------------------------------------

export const HELP_COMMANDS: CommandItem[] = [
  {
    id: 'help-get-started',
    label: 'Get Started',
    sublabel: 'Introduction to Governada',
    group: 'help',
    icon: Rocket,
    href: '/get-started',
  },
  {
    id: 'help-faq',
    label: 'FAQ',
    sublabel: 'Frequently asked questions',
    group: 'help',
    icon: HelpCircle,
    href: '/help',
  },
  {
    id: 'help-glossary',
    label: 'Glossary',
    sublabel: 'Governance terminology explained',
    group: 'help',
    icon: BookOpen,
    href: '/help/glossary',
  },
  {
    id: 'help-methodology',
    label: 'Methodology',
    sublabel: 'How scores and rankings work',
    group: 'help',
    icon: Activity,
    href: '/help/methodology',
  },
  {
    id: 'help-support',
    label: 'Support',
    sublabel: 'Get help or report an issue',
    group: 'help',
    icon: MessageSquare,
    href: '/help/support',
  },
];

// ---------------------------------------------------------------------------
// Settings commands — depth picker (action-based, callbacks provided at runtime)
// ---------------------------------------------------------------------------

export function buildSettingsCommands(opts: {
  setDepth: (depth: string) => void;
  currentDepth: string;
}): CommandItem[] {
  return [
    {
      id: 'settings-depth-handsoff',
      label: 'Set Depth: Hands-Off',
      sublabel: 'Alerts only when something needs attention',
      group: 'settings',
      icon: BellOff,
      action: () => opts.setDepth('hands_off'),
      segment: ['citizen', 'drep', 'spo', 'cc'],
    },
    {
      id: 'settings-depth-informed',
      label: 'Set Depth: Informed',
      sublabel: 'Major governance updates and briefings',
      group: 'settings',
      icon: Bell,
      action: () => opts.setDepth('informed'),
      segment: ['citizen', 'drep', 'spo', 'cc'],
    },
    {
      id: 'settings-depth-engaged',
      label: 'Set Depth: Engaged',
      sublabel: 'Full visibility, all events and tools',
      group: 'settings',
      icon: BellRing,
      action: () => opts.setDepth('engaged'),
      segment: ['citizen', 'drep', 'spo', 'cc'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Language commands (action-based, callbacks provided at runtime)
// ---------------------------------------------------------------------------

export function buildLanguageCommands(opts: {
  setLocale: (locale: string) => void;
  currentLocale: string;
  localeNames: Record<string, string>;
  supportedLocales: readonly string[];
}): CommandItem[] {
  return opts.supportedLocales.map((loc) => ({
    id: `lang-${loc}`,
    label: `Language: ${opts.localeNames[loc] ?? loc}`,
    sublabel: loc === opts.currentLocale ? 'Currently active' : undefined,
    group: 'settings' as const,
    icon: Globe,
    action: () => opts.setLocale(loc),
  }));
}

// ---------------------------------------------------------------------------
// Governance quick-actions — persona-specific
// ---------------------------------------------------------------------------

export const GOVERNANCE_ACTIONS: CommandItem[] = [
  {
    id: 'gov-cast-vote',
    label: 'Cast Vote',
    sublabel: 'Vote on active proposals',
    group: 'governance',
    icon: Vote,
    href: '/workspace',
    segment: ['drep', 'spo'],
  },
  {
    id: 'gov-write-rationale',
    label: 'Write Rationale',
    sublabel: 'Explain your voting position',
    group: 'governance',
    icon: PenLine,
    href: '/workspace/review',
    segment: ['drep'],
  },
  {
    id: 'gov-check-delegation',
    label: 'Check Delegation',
    sublabel: 'View your current delegation status',
    group: 'governance',
    icon: Link2,
    href: '/you/delegation',
    segment: ['citizen'],
  },
  {
    id: 'gov-find-drep',
    label: 'Find a DRep',
    sublabel: 'Match with a representative',
    group: 'governance',
    icon: Compass,
    href: '/match',
    segment: ['citizen', 'anonymous'],
  },
  {
    id: 'gov-review-committee',
    label: 'Review Committee',
    sublabel: 'CC member transparency and votes',
    group: 'governance',
    icon: Shield,
    href: '/governance/committee',
    segment: ['cc'],
  },
];

// ---------------------------------------------------------------------------
// Action commands (wallet, shortcuts, etc.)
// ---------------------------------------------------------------------------

export function buildActionCommands(opts: {
  openWallet: () => void;
  isAuthenticated: boolean;
  logout: () => void;
}): CommandItem[] {
  const actions: CommandItem[] = [
    {
      id: 'action-shortcuts',
      label: 'Keyboard Shortcuts',
      group: 'actions',
      icon: SlidersHorizontal,
      shortcut: '?',
    },
  ];

  if (opts.isAuthenticated) {
    actions.push({
      id: 'action-logout',
      label: 'Sign Out',
      group: 'actions',
      icon: LogOut,
      action: opts.logout,
    });
  } else {
    actions.push({
      id: 'action-connect',
      label: 'Connect Wallet',
      group: 'actions',
      icon: Wallet,
      action: opts.openWallet,
    });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Persona-aware filtering
// ---------------------------------------------------------------------------

export function filterBySegment(commands: CommandItem[], segment: UserSegment): CommandItem[] {
  return commands.filter((cmd) => {
    if (!cmd.segment) return true;
    if (Array.isArray(cmd.segment)) return cmd.segment.includes(segment);
    return cmd.segment === segment;
  });
}

// ---------------------------------------------------------------------------
// Entity search (DReps + Proposals)
// ---------------------------------------------------------------------------

export interface SearchableDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  drepScore: number;
}

export interface SearchableProposal {
  txHash: string;
  index: number;
  title: string;
  status: string;
  type: string;
}

export function searchDReps(dreps: SearchableDRep[], query: string): CommandItem[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return dreps
    .filter((d) => {
      const name = (d.name || '').toLowerCase();
      const ticker = (d.ticker || '').toLowerCase();
      const id = d.drepId.toLowerCase();
      return name.includes(q) || ticker.includes(q) || id.includes(q);
    })
    .slice(0, 8)
    .map((d) => ({
      id: `drep-${d.drepId}`,
      label: d.name || d.drepId.slice(0, 16) + '...',
      sublabel: d.ticker || undefined,
      group: 'dreps' as const,
      href: `/drep/${encodeURIComponent(d.drepId)}`,
      score: d.drepScore,
    }));
}

export function searchProposals(proposals: SearchableProposal[], query: string): CommandItem[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return proposals
    .filter((p) => p.title.toLowerCase().includes(q) || p.txHash.toLowerCase().includes(q))
    .slice(0, 6)
    .map((p) => ({
      id: `proposal-${p.txHash}-${p.index}`,
      label: p.title || `${p.txHash.slice(0, 12)}...`,
      sublabel: p.status,
      group: 'proposals' as const,
      href: `/proposal/${encodeURIComponent(p.txHash)}/${p.index}`,
    }));
}

// ---------------------------------------------------------------------------
// Route label mapping (for recent destinations tracking)
// ---------------------------------------------------------------------------

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/governance': 'Governance',
  '/governance/proposals': 'Proposals',
  '/governance/representatives': 'Representatives',
  '/governance/pools': 'Stake Pools',
  '/governance/committee': 'Constitutional Committee',
  '/governance/treasury': 'Treasury',
  '/governance/health': 'Governance Health',
  '/you': 'You',
  '/you/settings': 'Settings',
  '/you/delegation': 'Delegation',
  '/you/drep': 'DRep Scorecard',
  '/you/spo': 'Pool Scorecard',
  '/match': 'Match',
  '/workspace': 'Workspace',
  '/workspace/review': 'Review',
  '/workspace/votes': 'Voting Record',
  '/workspace/delegators': 'Delegators',
  '/workspace/author': 'Author',
  '/help': 'FAQ',
  '/help/glossary': 'Glossary',
  '/help/methodology': 'Methodology',
  '/help/support': 'Support',
  '/get-started': 'Get Started',
  '/developers': 'Developers',
};

/**
 * Get a human-readable label for a pathname.
 * Returns null for dynamic routes (DRep/proposal detail pages)
 * so they don't pollute the recent destinations list.
 */
export function getPageLabel(pathname: string): string | null {
  return ROUTE_LABELS[pathname] ?? null;
}
