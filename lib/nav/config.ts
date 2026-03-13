/**
 * Navigation configuration — data-driven nav items per persona.
 *
 * This is the single source of truth for all navigation surfaces:
 * - Desktop sidebar
 * - Mobile bottom bar (4 items, persona-adaptive)
 * - Mobile pill bar (section sub-pages)
 * - Header help dropdown
 *
 * See docs/strategy/context/navigation-architecture.md for the full spec.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Briefcase,
  Globe,
  User,
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
import { type GovernanceDepth, getTunerLevel } from '@/lib/governanceTuner';

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
  /** Minimum governance depth to show this item (undefined = all) */
  minDepth?: GovernanceDepth;
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
  { href: '/workspace', label: 'Cockpit', icon: Vote },
  { href: '/workspace/votes', label: 'Voting Record', icon: ScrollText },
  { href: '/workspace/delegators', label: 'Delegators', icon: Users },
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

/** Base You items — all authenticated personas */
const YOU_BASE: NavItem[] = [
  { href: '/you', label: 'Identity', icon: UserCog },
  { href: '/you/inbox', label: 'Inbox', icon: Bell, badge: 'unread' },
  { href: '/you/settings', label: 'Settings', icon: Settings },
];

/** Build persona-specific You items (adds scorecard links for DReps/SPOs) */
export function getYouItems(
  segment: UserSegment,
  context?: { drepId?: string | null; poolId?: string | null },
): NavItem[] {
  const items = [...YOU_BASE];
  const hasDrep = segment === 'drep' || !!context?.drepId;
  const hasSpo = segment === 'spo' || !!context?.poolId;

  const scorecardItems: NavItem[] = [];
  if (hasDrep)
    scorecardItems.push({
      href: '/you/drep',
      label: 'DRep Scorecard',
      icon: BadgeCheck,
      segments: ['drep'],
    });
  if (hasSpo)
    scorecardItems.push({
      href: '/you/spo',
      label: 'Pool Scorecard',
      icon: BarChart3,
      segments: ['spo'],
    });

  if (scorecardItems.length > 0) {
    items.splice(1, 0, ...scorecardItems); // Insert after Identity
  }

  return items;
}

/** Help items — used in header dropdown (no longer in sidebar) */
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

/** Extended context that includes governance depth for filtering */
export interface NavContext extends SidebarContext {
  depth?: GovernanceDepth;
}

// ---------------------------------------------------------------------------
// Depth filtering helpers
// ---------------------------------------------------------------------------

/** Returns true if item passes the depth threshold (or has no threshold). */
function meetsDepth(item: NavItem, depth: GovernanceDepth | undefined): boolean {
  if (!item.minDepth || !depth) return true;
  return getTunerLevel(depth).order >= getTunerLevel(item.minDepth).order;
}

/** Filter a list of nav items by governance depth. */
function filterByDepth(items: NavItem[], depth: GovernanceDepth | undefined): NavItem[] {
  if (!depth) return items;
  return items.filter((item) => meetsDepth(item, depth));
}

/** Filter nav item groups by governance depth. */
function filterGroupsByDepth(
  groups: NavItemGroup[],
  depth: GovernanceDepth | undefined,
): NavItemGroup[] {
  if (!depth) return groups;
  return groups
    .map((g) => ({ ...g, items: filterByDepth(g.items, depth) }))
    .filter((g) => g.items.length > 0);
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

export function getSidebarSections(
  segmentOrContext: UserSegment | SidebarContext | NavContext,
): NavSection[] {
  // Support legacy single-segment call, SidebarContext, and NavContext
  const ctx: NavContext =
    typeof segmentOrContext === 'string' ? { segment: segmentOrContext } : segmentOrContext;
  const { segment, drepId, poolId, depth } = ctx;

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
    const filteredGroups = filterGroupsByDepth(buildDualRoleGroups(), depth);
    if (filteredGroups.length > 0) {
      sections.push({
        id: 'workspace',
        label: 'Workspace',
        icon: Briefcase,
        href: '/workspace',
        groups: filteredGroups,
        segments: ['drep', 'spo'],
      });
    }
  } else if (segment === 'drep' || segment === 'spo') {
    const workspaceItems = segment === 'drep' ? WORKSPACE_DREP_ITEMS : WORKSPACE_SPO_ITEMS;
    const filteredItems = filterByDepth(workspaceItems, depth);
    sections.push({
      id: 'workspace',
      label: 'Workspace',
      icon: Briefcase,
      href: '/workspace',
      items: filteredItems,
      segments: ['drep', 'spo'],
    });
  }

  // Governance — everyone
  sections.push({
    id: 'governance',
    label: 'Governance',
    icon: Globe,
    href: '/governance',
    items: filterByDepth(GOVERNANCE_ITEMS, depth),
  });

  // You — authenticated (persona-aware items)
  if (segment !== 'anonymous') {
    sections.push({
      id: 'you',
      label: 'You',
      icon: User,
      href: '/you',
      items: filterByDepth(getYouItems(segment, { drepId, poolId }), depth),
      requiresAuth: true,
    });
  }

  // Help removed from sidebar — now in header dropdown

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

const BOTTOM_BAR_CITIZEN: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
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
  { href: '/match', label: 'Match', icon: Compass },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** Hands-Off bottom bar for citizen: swap Match for Help */
const BOTTOM_BAR_CITIZEN_HANDS_OFF: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/** Hands-Off bottom bar for DRep: Home/Workspace/You/Help */
const BOTTOM_BAR_DREP_HANDS_OFF: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase, badge: 'actions' },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/** Hands-Off bottom bar for SPO: Home/Workspace/You/Help */
const BOTTOM_BAR_SPO_HANDS_OFF: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

export function getBottomBarItems(
  segmentOrOpts: UserSegment | { segment: UserSegment; depth?: GovernanceDepth },
): NavItem[] {
  const segment = typeof segmentOrOpts === 'string' ? segmentOrOpts : segmentOrOpts.segment;
  const depth = typeof segmentOrOpts === 'string' ? undefined : segmentOrOpts.depth;
  const isHandsOff = depth === 'hands_off';

  switch (segment) {
    case 'anonymous':
      return BOTTOM_BAR_ANONYMOUS;
    case 'citizen':
      return isHandsOff ? BOTTOM_BAR_CITIZEN_HANDS_OFF : BOTTOM_BAR_CITIZEN;
    case 'drep':
      return isHandsOff ? BOTTOM_BAR_DREP_HANDS_OFF : BOTTOM_BAR_DREP;
    case 'spo':
      return isHandsOff ? BOTTOM_BAR_SPO_HANDS_OFF : BOTTOM_BAR_SPO;
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
  context?: { drepId?: string | null; poolId?: string | null; depth?: GovernanceDepth },
): NavItem[] | null {
  const depth = context?.depth;

  if (pathname.startsWith('/governance')) {
    return filterByDepth(GOVERNANCE_ITEMS, depth);
  }
  if (pathname.startsWith('/workspace')) {
    const isDualRole = !!(context?.drepId && context?.poolId);
    if (isDualRole) {
      // For dual-role users, combine both item sets (deduped) for pill bar
      const drepHrefs = new Set(WORKSPACE_DREP_ITEMS.map((i) => i.href));
      const combined = [
        ...WORKSPACE_DREP_ITEMS,
        ...WORKSPACE_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href)),
      ];
      return filterByDepth(combined, depth);
    }
    if (segment === 'drep') return filterByDepth(WORKSPACE_DREP_ITEMS, depth);
    if (segment === 'spo') return filterByDepth(WORKSPACE_SPO_ITEMS, depth);
    return filterByDepth(WORKSPACE_DREP_ITEMS, depth);
  }
  if (pathname.startsWith('/you')) {
    return filterByDepth(getYouItems(segment, context), depth);
  }
  if (pathname.startsWith('/help')) {
    return filterByDepth(HELP_ITEMS, depth);
  }
  // No pill bar for single-page sections (Home, Match)
  return null;
}

// ---------------------------------------------------------------------------
// Section detection from pathname
// ---------------------------------------------------------------------------

export function getCurrentSection(pathname: string): string | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/governance')) return 'governance';
  if (pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/match')) return 'match';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}
