/**
 * Navigation configuration — data-driven nav items per persona.
 *
 * This is the single source of truth for all navigation surfaces:
 * - Desktop sidebar
 * - Mobile bottom bar (4 items, persona-adaptive)
 * - Mobile pill bar (section sub-pages)
 *
 * See docs/strategy/context/navigation-architecture.md for the full spec.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Briefcase,
  Globe,
  User,
  Handshake,
  Compass,
  HelpCircle,
  FileText,
  Users,
  Building2,
  Wallet,
  Activity,
  Vote,
  ScrollText,
  BarChart3,
  Building,
  Trophy,
  UserCog,
  Bell,
  Settings,
  BadgeCheck,
  BookOpen,
  MessageSquare,
  Shield,
} from 'lucide-react';
import type { UserSegment } from '@/components/providers/SegmentProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show notification badge when true */
  badge?: 'unread' | 'actions';
  /** Only show for these segments (undefined = all) */
  segments?: UserSegment[];
  /** Only show for authenticated users */
  requiresAuth?: boolean;
}

/** A labelled group of items within a section (for dual-role workspace) */
export interface NavItemGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Sub-pages within this section (shown in sidebar + pill bar) */
  items?: NavItem[];
  /** Role-grouped items (used for dual-role workspace sections) */
  groups?: NavItemGroup[];
  /** Only show for these segments (undefined = all) */
  segments?: UserSegment[];
  /** Only show for authenticated users */
  requiresAuth?: boolean;
}

export interface BottomBarConfig {
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Section definitions (sidebar + pill bar source)
// ---------------------------------------------------------------------------

export const WORKSPACE_DREP_ITEMS: NavItem[] = [
  { href: '/workspace', label: 'Action Queue', icon: Vote },
  { href: '/workspace/votes', label: 'Voting Record', icon: ScrollText },
  { href: '/workspace/rationales', label: 'Rationales', icon: FileText },
  { href: '/workspace/delegators', label: 'Delegators', icon: Users },
  { href: '/workspace/performance', label: 'Performance', icon: BarChart3 },
];

export const WORKSPACE_SPO_ITEMS: NavItem[] = [
  { href: '/workspace', label: 'Gov Score', icon: BarChart3 },
  { href: '/workspace/pool-profile', label: 'Pool Profile', icon: Building },
  { href: '/workspace/delegators', label: 'Delegators', icon: Users },
  { href: '/workspace/position', label: 'Position', icon: Trophy },
];

export const GOVERNANCE_ITEMS: NavItem[] = [
  { href: '/governance/proposals', label: 'Proposals', icon: FileText },
  { href: '/governance/representatives', label: 'Representatives', icon: Users },
  { href: '/governance/pools', label: 'Pools', icon: Building2 },
  { href: '/governance/committee', label: 'Committee', icon: Shield },
  { href: '/governance/treasury', label: 'Treasury', icon: Wallet },
  { href: '/governance/health', label: 'Health', icon: Activity },
];

export const YOU_ITEMS: NavItem[] = [
  { href: '/you', label: 'Governance ID', icon: BadgeCheck },
  { href: '/you/identity', label: 'Identity', icon: UserCog },
  { href: '/you/inbox', label: 'Inbox', icon: Bell, badge: 'unread' },
  { href: '/you/settings', label: 'Settings', icon: Settings },
];

export const HELP_ITEMS: NavItem[] = [
  { href: '/help', label: 'FAQ', icon: HelpCircle },
  { href: '/help/glossary', label: 'Glossary', icon: BookOpen },
  { href: '/help/methodology', label: 'Methodology', icon: BarChart3 },
  { href: '/help/support', label: 'Support', icon: MessageSquare },
];

// ---------------------------------------------------------------------------
// Sidebar sections — ordered top to bottom
// ---------------------------------------------------------------------------

/** Context for sidebar generation — supports dual-role detection */
export interface SidebarContext {
  segment: UserSegment;
  /** Non-null when user is a registered DRep */
  drepId?: string | null;
  /** Non-null when user operates a stake pool */
  poolId?: string | null;
}

/**
 * Build deduplicated dual-role workspace groups.
 * Items that appear in both lists (matched by href) are shown only in the
 * DRep group to avoid visual clutter.
 */
function buildDualRoleGroups(): NavItemGroup[] {
  const drepHrefs = new Set(WORKSPACE_DREP_ITEMS.map((i) => i.href));
  const dedupedSpoItems = WORKSPACE_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href));

  return [
    { id: 'workspace-drep', label: 'DRep', items: WORKSPACE_DREP_ITEMS },
    { id: 'workspace-pool', label: 'Pool', items: dedupedSpoItems },
  ];
}

export function getSidebarSections(segmentOrContext: UserSegment | SidebarContext): NavSection[] {
  // Support both the legacy single-segment call and the new context call
  const ctx: SidebarContext =
    typeof segmentOrContext === 'string' ? { segment: segmentOrContext } : segmentOrContext;
  const { segment, drepId, poolId } = ctx;

  const isDualRole = !!(drepId && poolId);

  const sections: NavSection[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      href: '/',
    },
  ];

  // Workspace — DRep/SPO only (with dual-role grouping)
  if (isDualRole) {
    sections.push({
      id: 'workspace',
      label: 'Workspace',
      icon: Briefcase,
      href: '/workspace',
      groups: buildDualRoleGroups(),
      segments: ['drep', 'spo'],
    });
  } else if (segment === 'drep' || segment === 'spo') {
    const workspaceItems = segment === 'drep' ? WORKSPACE_DREP_ITEMS : WORKSPACE_SPO_ITEMS;
    sections.push({
      id: 'workspace',
      label: 'Workspace',
      icon: Briefcase,
      href: '/workspace',
      items: workspaceItems,
      segments: ['drep', 'spo'],
    });
  }

  // Governance — everyone
  sections.push({
    id: 'governance',
    label: 'Governance',
    icon: Globe,
    href: '/governance',
    items: GOVERNANCE_ITEMS,
  });

  // Delegation — authenticated with delegation
  if (segment !== 'anonymous') {
    sections.push({
      id: 'delegation',
      label: 'Delegation',
      icon: Handshake,
      href: '/delegation',
      requiresAuth: true,
    });
  }

  // You — authenticated
  if (segment !== 'anonymous') {
    sections.push({
      id: 'you',
      label: 'You',
      icon: User,
      href: '/you',
      items: YOU_ITEMS,
      requiresAuth: true,
    });
  }

  // Help — everyone
  sections.push({
    id: 'help',
    label: 'Help',
    icon: HelpCircle,
    href: '/help',
    items: HELP_ITEMS,
  });

  return sections;
}

// ---------------------------------------------------------------------------
// Bottom bar — 4 items, persona-adaptive
// ---------------------------------------------------------------------------

const BOTTOM_BAR_ANONYMOUS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

const BOTTOM_BAR_CITIZEN_UNDELEGATED: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

const BOTTOM_BAR_CITIZEN_DELEGATED: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/delegation', label: 'Delegation', icon: Handshake },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

const BOTTOM_BAR_DREP: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase, badge: 'actions' },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

const BOTTOM_BAR_SPO: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

const BOTTOM_BAR_CC: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/delegation', label: 'Delegation', icon: Handshake },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

export function getBottomBarItems(segment: UserSegment, hasDelegation: boolean): NavItem[] {
  switch (segment) {
    case 'anonymous':
      return BOTTOM_BAR_ANONYMOUS;
    case 'citizen':
      return hasDelegation ? BOTTOM_BAR_CITIZEN_DELEGATED : BOTTOM_BAR_CITIZEN_UNDELEGATED;
    case 'drep':
      return BOTTOM_BAR_DREP;
    case 'spo':
      return BOTTOM_BAR_SPO;
    case 'cc':
      return BOTTOM_BAR_CC;
    default:
      return BOTTOM_BAR_ANONYMOUS;
  }
}

// ---------------------------------------------------------------------------
// Pill bar — derive from current route's section
// ---------------------------------------------------------------------------

export function getPillBarItems(
  pathname: string,
  segment: UserSegment,
  context?: { drepId?: string | null; poolId?: string | null },
): NavItem[] | null {
  if (pathname.startsWith('/governance')) {
    return GOVERNANCE_ITEMS;
  }
  if (pathname.startsWith('/workspace')) {
    const isDualRole = !!(context?.drepId && context?.poolId);
    if (isDualRole) {
      // For dual-role users, combine both item sets (deduped) for pill bar
      const drepHrefs = new Set(WORKSPACE_DREP_ITEMS.map((i) => i.href));
      return [
        ...WORKSPACE_DREP_ITEMS,
        ...WORKSPACE_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href)),
      ];
    }
    if (segment === 'drep') return WORKSPACE_DREP_ITEMS;
    if (segment === 'spo') return WORKSPACE_SPO_ITEMS;
    return WORKSPACE_DREP_ITEMS;
  }
  if (pathname.startsWith('/you')) {
    return YOU_ITEMS;
  }
  if (pathname.startsWith('/help')) {
    return HELP_ITEMS;
  }
  // No pill bar for single-page sections (Home, Delegation, Match)
  return null;
}

// ---------------------------------------------------------------------------
// Section detection from pathname
// ---------------------------------------------------------------------------

export function getCurrentSection(pathname: string): string | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/governance')) return 'governance';
  if (pathname.startsWith('/delegation')) return 'delegation';
  if (pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/match')) return 'match';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}
