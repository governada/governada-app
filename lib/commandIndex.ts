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
    label: 'Discover DReps',
    group: 'pages',
    icon: Compass,
    href: '/discover',
    shortcut: 'D',
  },
  {
    id: 'page-proposals',
    label: 'Proposals',
    group: 'pages',
    icon: ScrollText,
    href: '/proposals',
    shortcut: 'P',
  },
  {
    id: 'page-governance',
    label: 'My Delegation',
    group: 'pages',
    icon: Vote,
    href: '/governance',
    shortcut: 'G',
  },
  {
    id: 'page-dashboard',
    label: 'DRep Dashboard',
    group: 'pages',
    icon: Sparkles,
    href: '/dashboard',
  },
  { id: 'page-pulse', label: 'Governance Pulse', group: 'pages', icon: BarChart3, href: '/pulse' },
  { id: 'page-treasury', label: 'Treasury', group: 'pages', icon: Landmark, href: '/treasury' },
  { id: 'page-developers', label: 'Developers', group: 'pages', icon: Code2, href: '/developers' },
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
      href: `/proposals/${encodeURIComponent(p.txHash)}/${p.index}`,
    }));
}
