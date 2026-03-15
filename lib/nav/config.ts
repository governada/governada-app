/**
 * Navigation configuration — Three Worlds model.
 *
 * Three conceptual worlds:
 *   Home      = "What needs my attention?" (absorbs workspace for DRep/SPO)
 *   Governance = "What's happening?" (universal exploration)
 *   You       = "Who am I in governance?" (identity, reflection, settings)
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
  Rocket,
  Link2,
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
  /** Key for Living Sidebar sub-label (e.g., 'home.pendingVotes') */
  sublabelKey?: string;
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
  /** Role-grouped items (used for dual-role Home sections) */
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

/** Home sub-items for DRep persona (workspace tools shown under Home) */
export const HOME_DREP_ITEMS: NavItem[] = [
  { href: '/workspace', label: 'Cockpit', icon: Vote, sublabelKey: 'home.pendingVotes' },
  {
    href: '/workspace/votes',
    label: 'Voting Record',
    icon: ScrollText,
    sublabelKey: 'home.totalVotes',
  },
  {
    href: '/workspace/delegators',
    label: 'Delegators',
    icon: Users,
    sublabelKey: 'home.delegatedAda',
  },
];

/** Home sub-items for SPO persona (workspace tools shown under Home) */
export const HOME_SPO_ITEMS: NavItem[] = [
  { href: '/workspace', label: 'Gov Score', icon: BarChart3, sublabelKey: 'home.govScore' },
  { href: '/workspace/pool-profile', label: 'Pool Profile', icon: Building },
  {
    href: '/workspace/delegators',
    label: 'Delegators',
    icon: Users,
    sublabelKey: 'home.delegatedAda',
  },
  { href: '/workspace/position', label: 'Position', icon: Trophy },
];

// Legacy aliases for any code that still references the old names
export const WORKSPACE_DREP_ITEMS = HOME_DREP_ITEMS;
export const WORKSPACE_SPO_ITEMS = HOME_SPO_ITEMS;

export const GOVERNANCE_ITEMS: NavItem[] = [
  {
    href: '/governance/proposals',
    label: 'Proposals',
    icon: FileText,
    sublabelKey: 'gov.activeProposals',
  },
  {
    href: '/governance/representatives',
    label: 'Representatives',
    icon: Users,
    sublabelKey: 'gov.activeDreps',
  },
  { href: '/governance/pools', label: 'Pools', icon: Building2 },
  { href: '/governance/committee', label: 'Committee', icon: Shield },
  {
    href: '/governance/treasury',
    label: 'Treasury',
    icon: Wallet,
    sublabelKey: 'gov.treasuryBalance',
  },
  { href: '/governance/health', label: 'Health', icon: Activity, sublabelKey: 'gov.ghiScore' },
];

/** Base You items — all authenticated personas */
const YOU_BASE: NavItem[] = [
  { href: '/you', label: 'Identity', icon: UserCog },
  { href: '/you/inbox', label: 'Inbox', icon: Bell, badge: 'unread', sublabelKey: 'you.unread' },
  { href: '/you/settings', label: 'Settings', icon: Settings },
];

/** Build persona-specific You items (adds scorecard links for DReps/SPOs, delegation for citizens) */
export function getYouItems(
  segment: UserSegment,
  context?: { drepId?: string | null; poolId?: string | null; isDelegated?: boolean },
): NavItem[] {
  const items = [...YOU_BASE];
  const hasDrep = segment === 'drep' || !!context?.drepId;
  const hasSpo = segment === 'spo' || !!context?.poolId;

  // Insert after Identity: scorecards and delegation
  const insertItems: NavItem[] = [];

  if (hasDrep)
    insertItems.push({
      href: '/you/drep',
      label: 'DRep Scorecard',
      icon: BadgeCheck,
      segments: ['drep'],
      sublabelKey: 'you.drepScore',
    });
  if (hasSpo)
    insertItems.push({
      href: '/you/spo',
      label: 'Pool Scorecard',
      icon: BarChart3,
      segments: ['spo'],
      sublabelKey: 'you.spoScore',
    });

  // Add delegation page for citizens (and DRep/SPO who are also citizens)
  if (segment === 'citizen' || hasDrep || hasSpo) {
    insertItems.push({
      href: '/you/delegation',
      label: 'Delegation',
      icon: Link2,
      sublabelKey: 'you.coverage',
    });
  }

  if (insertItems.length > 0) {
    items.splice(1, 0, ...insertItems); // Insert after Identity
  }

  return items;
}

/** Help items — used in header dropdown (no longer in sidebar) */
export const HELP_ITEMS: NavItem[] = [
  { href: '/get-started', label: 'Get Started', icon: Rocket },
  { href: '/help', label: 'FAQ', icon: HelpCircle },
  { href: '/help/glossary', label: 'Glossary', icon: BookOpen },
  { href: '/help/methodology', label: 'Methodology', icon: BarChart3 },
  { href: '/help/support', label: 'Support', icon: MessageSquare },
];

// ---------------------------------------------------------------------------
// Sidebar sections — Three Worlds: Home, Governance, You
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
 * Build deduplicated dual-role Home groups.
 * Items that appear in both lists (matched by href) are shown only in the
 * DRep group to avoid visual clutter.
 */
function buildDualRoleGroups(): NavItemGroup[] {
  const drepHrefs = new Set(HOME_DREP_ITEMS.map((i) => i.href));
  const dedupedSpoItems = HOME_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href));

  return [
    { id: 'home-drep', label: 'DRep', items: HOME_DREP_ITEMS },
    { id: 'home-pool', label: 'Pool', items: dedupedSpoItems },
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

  const sections: NavSection[] = [];

  // ── World 1: Home ─────────────────────────────────────────────────────
  // For DRep/SPO, Home has workspace sub-items (the workspace IS their home).
  // For citizens/anonymous, Home is a single link.
  if (isDualRole) {
    const filteredGroups = filterGroupsByDepth(buildDualRoleGroups(), depth);
    sections.push({
      id: 'home',
      label: 'Home',
      icon: Home,
      href: '/',
      groups: filteredGroups.length > 0 ? filteredGroups : undefined,
    });
  } else if (segment === 'drep' || segment === 'spo') {
    const homeItems = segment === 'drep' ? HOME_DREP_ITEMS : HOME_SPO_ITEMS;
    const filteredItems = filterByDepth(homeItems, depth);
    sections.push({
      id: 'home',
      label: 'Home',
      icon: Home,
      href: '/',
      items: filteredItems,
    });
  } else {
    // Citizens, anonymous, CC — Home is a single link
    sections.push({
      id: 'home',
      label: 'Home',
      icon: Home,
      href: '/',
    });
  }

  // ── World 2: Governance ───────────────────────────────────────────────
  sections.push({
    id: 'governance',
    label: 'Governance',
    icon: Globe,
    href: '/governance',
    items: filterByDepth(GOVERNANCE_ITEMS, depth),
  });

  // ── World 3: You ──────────────────────────────────────────────────────
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

  return sections;
}

// ---------------------------------------------------------------------------
// Bottom bar — 4 items, Three Worlds model
// ---------------------------------------------------------------------------

/** Anonymous: Home | Governance | Match | Help */
const BOTTOM_BAR_ANONYMOUS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/** Citizen (undelegated): Home | Governance | Match | You */
const BOTTOM_BAR_CITIZEN: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** Citizen (delegated/hands-off): Home | Governance | You | Help */
const BOTTOM_BAR_CITIZEN_DELEGATED: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/** DRep: Home | Governance | You | Help (workspace absorbed into Home) */
const BOTTOM_BAR_DREP: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, badge: 'actions' },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/** SPO: Home | Governance | You | Help (workspace absorbed into Home) */
const BOTTOM_BAR_SPO: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/** CC: Home | Governance | You | Help */
const BOTTOM_BAR_CC: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
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
      // Undelegated citizens get Match; delegated/hands-off get Help
      return isHandsOff ? BOTTOM_BAR_CITIZEN_DELEGATED : BOTTOM_BAR_CITIZEN;
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
  context?: { drepId?: string | null; poolId?: string | null; depth?: GovernanceDepth },
): NavItem[] | null {
  const depth = context?.depth;

  if (pathname.startsWith('/governance')) {
    return filterByDepth(GOVERNANCE_ITEMS, depth);
  }
  // Workspace routes are now part of the Home world
  if (pathname.startsWith('/workspace')) {
    const isDualRole = !!(context?.drepId && context?.poolId);
    if (isDualRole) {
      const drepHrefs = new Set(HOME_DREP_ITEMS.map((i) => i.href));
      const combined = [
        ...HOME_DREP_ITEMS,
        ...HOME_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href)),
      ];
      return filterByDepth(combined, depth);
    }
    if (segment === 'drep') return filterByDepth(HOME_DREP_ITEMS, depth);
    if (segment === 'spo') return filterByDepth(HOME_SPO_ITEMS, depth);
    return filterByDepth(HOME_DREP_ITEMS, depth);
  }
  if (pathname.startsWith('/you')) {
    return filterByDepth(getYouItems(segment, context), depth);
  }
  if (pathname.startsWith('/help')) {
    return filterByDepth(HELP_ITEMS, depth);
  }
  // No pill bar for single-page sections (Home landing, Match)
  return null;
}

// ---------------------------------------------------------------------------
// Section detection from pathname
// ---------------------------------------------------------------------------

export function getCurrentSection(pathname: string): string | null {
  if (pathname === '/') return 'home';
  // Workspace routes belong to the Home world
  if (pathname.startsWith('/workspace')) return 'home';
  if (pathname.startsWith('/governance')) return 'governance';
  if (pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/match')) return 'match';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}
