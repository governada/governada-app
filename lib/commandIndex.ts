import {
  Compass,
  ScrollText,
  Vote,
  Sparkles,
  BarChart3,
  Landmark,
  Code2,
  Home,
  Sun,
  Moon,
  Wallet,
  LogOut,
  HelpCircle,
  Bell,
  User,
  type LucideIcon,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  group: 'pages' | 'dreps' | 'proposals' | 'actions';
  icon?: LucideIcon;
  href?: string;
  action?: () => void;
  shortcut?: string;
  score?: number;
}

export const PAGE_COMMANDS: CommandItem[] = [
  { id: 'page-home', label: 'Home', group: 'pages', icon: Home, href: '/', shortcut: 'H' },
  {
    id: 'page-discover',
    label: 'Discover DReps & SPOs',
    sublabel: 'Browse governance representatives',
    group: 'pages',
    icon: Compass,
    href: '/governance',
    shortcut: 'D',
  },
  {
    id: 'page-proposals',
    label: 'Proposals',
    sublabel: 'Browse active governance proposals',
    group: 'pages',
    icon: ScrollText,
    href: '/governance/proposals',
    shortcut: 'P',
  },
  {
    id: 'page-mygov',
    label: 'My Gov',
    sublabel: 'Your civic command center',
    group: 'pages',
    icon: Vote,
    href: '/my-gov',
    shortcut: 'G',
  },
  {
    id: 'page-inbox',
    label: 'My Gov — Inbox',
    sublabel: 'Governance notifications and actions',
    group: 'pages',
    icon: Bell,
    href: '/my-gov/inbox',
  },
  {
    id: 'page-profile',
    label: 'My Gov — Profile & Settings',
    sublabel: 'Manage your governance identity',
    group: 'pages',
    icon: User,
    href: '/my-gov/profile',
  },
  {
    id: 'page-pulse',
    label: 'Governance Pulse',
    sublabel: 'State of Cardano governance',
    group: 'pages',
    icon: BarChart3,
    href: '/governance/health',
  },
  {
    id: 'page-dashboard-drep',
    label: 'DRep Dashboard',
    sublabel: 'Governance scoring and analytics',
    group: 'pages',
    icon: Sparkles,
    href: '/my-gov',
  },
  {
    id: 'page-committee',
    label: 'Constitutional Committee',
    sublabel: 'CC member transparency scores and voting records',
    group: 'pages',
    icon: Landmark,
    href: '/governance/committee',
  },
  {
    id: 'page-developers',
    label: 'Developers',
    sublabel: 'API documentation',
    group: 'pages',
    icon: Code2,
    href: '/developers',
  },
];

export function buildActionCommands(opts: {
  toggleTheme: () => void;
  isDark: boolean;
  openWallet: () => void;
  isAuthenticated: boolean;
  logout: () => void;
}): CommandItem[] {
  const actions: CommandItem[] = [
    {
      id: 'action-theme',
      label: opts.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      group: 'actions',
      icon: opts.isDark ? Sun : Moon,
      action: opts.toggleTheme,
    },
    {
      id: 'action-shortcuts',
      label: 'Keyboard Shortcuts',
      group: 'actions',
      icon: HelpCircle,
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
