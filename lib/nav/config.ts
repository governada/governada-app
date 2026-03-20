/**
 * Navigation configuration — Four Worlds model.
 *
 * Four conceptual worlds:
 *   Home      = "What needs my attention?" (briefing, alerts, status)
 *   Workspace = "Do my governance work" (author, review, manage)
 *   Governance = "What's happening?" (universal exploration)
 *   You       = "Who am I in governance?" (identity, reflection, settings)
 *
 * Home is a single briefing surface for all personas.
 * Workspace is a separate section for governance operators (DRep, SPO,
 * delegated citizens). Author and Review are peer sub-sections within it.
 *
 * This is the single source of truth for all navigation surfaces:
 * - Desktop sidebar / icon rail
 * - Mobile bottom bar (3-4 items, persona-adaptive)
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
  Settings,
  BadgeCheck,
  BookOpen,
  MessageSquare,
  Shield,
  Rocket,
  Link2,
  PenLine,
  Briefcase,
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
  /** Render as disabled (visible but not clickable) */
  disabled?: boolean;
  /** Tooltip shown on hover when disabled */
  disabledTooltip?: string;
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
  /** Role-grouped items (used for dual-role workspace) */
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
// Workspace section definitions — Author & Review as peer sub-sections
// ---------------------------------------------------------------------------

/**
 * DRep workspace: Review-first (their #1 JTBD), then Author, then operational tools.
 * The /workspace landing doubles as a DRep action queue / dashboard.
 */
export const WORKSPACE_DREP_ITEMS: NavItem[] = [
  {
    href: '/workspace',
    label: 'Dashboard',
    icon: Vote,
    sublabelKey: 'workspace.pendingVotes',
  },
  {
    href: '/workspace/review',
    label: 'Review',
    icon: FileText,
    sublabelKey: 'workspace.pendingReview',
  },
  { href: '/workspace/author', label: 'Author', icon: PenLine, sublabelKey: 'workspace.drafts' },
  {
    href: '/workspace/votes',
    label: 'Voting Record',
    icon: ScrollText,
    sublabelKey: 'workspace.totalVotes',
  },
  {
    href: '/workspace/delegators',
    label: 'Delegators',
    icon: Users,
    sublabelKey: 'workspace.delegatedAda',
  },
];

/**
 * SPO workspace: Gov Score dashboard, then Review, Author, and pool management.
 */
export const WORKSPACE_SPO_ITEMS: NavItem[] = [
  {
    href: '/workspace',
    label: 'Gov Score',
    icon: BarChart3,
    sublabelKey: 'workspace.govScore',
  },
  {
    href: '/workspace/review',
    label: 'Review',
    icon: FileText,
    sublabelKey: 'workspace.pendingReview',
  },
  { href: '/workspace/author', label: 'Author', icon: PenLine, sublabelKey: 'workspace.drafts' },
  { href: '/workspace/pool-profile', label: 'Pool Profile', icon: Building },
  {
    href: '/workspace/delegators',
    label: 'Delegators',
    icon: Users,
    sublabelKey: 'workspace.delegatedAda',
  },
  { href: '/workspace/position', label: 'Position', icon: Trophy },
];

/**
 * Citizen workspace: Author-first (their primary workspace activity),
 * then Review for community draft feedback.
 */
export const WORKSPACE_CITIZEN_ITEMS: NavItem[] = [
  { href: '/workspace/author', label: 'Author', icon: PenLine },
  {
    href: '/workspace/review',
    label: 'Review',
    icon: FileText,
    disabled: true,
    disabledTooltip: 'Connect as a DRep or SPO to review and vote on proposals',
  },
];

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
  { href: '/governance/pools', label: 'Pools', icon: Building2, sublabelKey: 'gov.activePools' },
  { href: '/governance/committee', label: 'Committee', icon: Shield, sublabelKey: 'gov.ccMembers' },
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
// Sidebar sections — Four Worlds: Home, Workspace, Governance, You
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
  /** True when citizen has an active delegation (DRep or pool) */
  isDelegated?: boolean;
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
 * Build deduplicated dual-role Workspace groups.
 * Items that appear in both lists (matched by href) are shown only in the
 * DRep group to avoid visual clutter.
 */
function buildDualRoleWorkspaceGroups(): NavItemGroup[] {
  const drepHrefs = new Set(WORKSPACE_DREP_ITEMS.map((i) => i.href));
  const dedupedSpoItems = WORKSPACE_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href));

  return [
    { id: 'ws-drep', label: 'DRep', items: WORKSPACE_DREP_ITEMS },
    { id: 'ws-pool', label: 'Pool', items: dedupedSpoItems },
  ];
}

/** Returns true when a persona should see the Workspace section.
 *  All authenticated users get Workspace — any citizen can author proposals. */
function hasWorkspace(ctx: NavContext): boolean {
  const { segment, drepId, poolId } = ctx;
  if (segment === 'anonymous') return false;
  if (segment === 'drep' || segment === 'spo') return true;
  if (drepId || poolId) return true; // dual-role detection
  // All authenticated users (citizen, cc) get Workspace for Author + Review
  return true;
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

  // ── World 1: Home — briefing surface (always a single link) ───────────
  sections.push({
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '/',
  });

  // ── World 2: Workspace — governance work surface ──────────────────────
  // Appears for all authenticated users. Author & Review are peer
  // sub-sections; persona determines default landing and item order.
  if (hasWorkspace(ctx)) {
    if (isDualRole) {
      const filteredGroups = filterGroupsByDepth(buildDualRoleWorkspaceGroups(), depth);
      sections.push({
        id: 'workspace',
        label: 'Workspace',
        icon: Briefcase,
        href: '/workspace',
        groups: filteredGroups.length > 0 ? filteredGroups : undefined,
        requiresAuth: true,
      });
    } else if (segment === 'drep' || (drepId && !poolId)) {
      sections.push({
        id: 'workspace',
        label: 'Workspace',
        icon: Briefcase,
        href: '/workspace',
        items: filterByDepth(WORKSPACE_DREP_ITEMS, depth),
        requiresAuth: true,
      });
    } else if (segment === 'spo' || (!drepId && poolId)) {
      sections.push({
        id: 'workspace',
        label: 'Workspace',
        icon: Briefcase,
        href: '/workspace',
        items: filterByDepth(WORKSPACE_SPO_ITEMS, depth),
        requiresAuth: true,
      });
    } else {
      // Citizen / CC — Author-first workspace
      sections.push({
        id: 'workspace',
        label: 'Workspace',
        icon: Briefcase,
        href: '/workspace/author',
        items: filterByDepth(WORKSPACE_CITIZEN_ITEMS, depth),
        requiresAuth: true,
      });
    }
  }

  // ── World 3: Governance ───────────────────────────────────────────────
  sections.push({
    id: 'governance',
    label: 'Governance',
    icon: Globe,
    href: '/governance',
    items: filterByDepth(GOVERNANCE_ITEMS, depth),
  });

  // ── World 4: You ──────────────────────────────────────────────────────
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
// Bottom bar — 3 or 4 items, persona-adaptive
// ---------------------------------------------------------------------------

/** Anonymous: Home | Governance | Match */
const BOTTOM_BAR_ANONYMOUS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
];

/** Citizen (undelegated): Home | Workspace | Governance | Match */
const BOTTOM_BAR_CITIZEN: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace/author', label: 'Workspace', icon: Briefcase },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/match', label: 'Match', icon: Compass },
];

/** Citizen (delegated): Home | Workspace | Governance | You */
const BOTTOM_BAR_CITIZEN_DELEGATED: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace/author', label: 'Workspace', icon: Briefcase },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** DRep: Home | Workspace | Governance | You */
const BOTTOM_BAR_DREP: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase, badge: 'actions' },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** SPO: Home | Workspace | Governance | You */
const BOTTOM_BAR_SPO: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** CC: Home | Workspace | Governance | You */
const BOTTOM_BAR_CC: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace/author', label: 'Workspace', icon: Briefcase },
  { href: '/governance', label: 'Governance', icon: Globe },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
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
      // Delegated citizens (hands-off+ depth) get Workspace; undelegated get Match
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
  // Workspace routes show workspace sub-items in the pill bar
  if (pathname.startsWith('/workspace')) {
    const isDualRole = !!(context?.drepId && context?.poolId);
    if (isDualRole) {
      const drepHrefs = new Set(WORKSPACE_DREP_ITEMS.map((i) => i.href));
      const combined = [
        ...WORKSPACE_DREP_ITEMS,
        ...WORKSPACE_SPO_ITEMS.filter((i) => !drepHrefs.has(i.href)),
      ];
      return filterByDepth(combined, depth);
    }
    if (segment === 'drep') return filterByDepth(WORKSPACE_DREP_ITEMS, depth);
    if (segment === 'spo') return filterByDepth(WORKSPACE_SPO_ITEMS, depth);
    if (segment === 'citizen' || segment === 'cc')
      return filterByDepth(WORKSPACE_CITIZEN_ITEMS, depth);
    return filterByDepth(WORKSPACE_DREP_ITEMS, depth);
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
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/governance')) return 'governance';
  if (pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/match')) return 'match';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}

// ---------------------------------------------------------------------------
// Section-level metric keys — used by NavigationRail for rich tooltips
// ---------------------------------------------------------------------------

/** Maps section IDs to the primary sidebar-metric key for that section's summary. */
export const SECTION_METRIC_KEYS: Record<string, string> = {
  workspace: 'workspace.pendingVotes',
  governance: 'gov.activeProposals',
  you: 'you.drepScore',
};
