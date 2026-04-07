/**
 * Navigation configuration — Three Worlds model (task-shaped).
 *
 * Three conceptual worlds:
 *   Home      = Seneca-powered command center + governance discovery
 *   Workspace = Actions only: Review proposals, Author proposals
 *   You       = Identity, Scorecard, Record, Settings
 *
 * Home is a unified globe + Seneca surface for briefing, discovery, and matching.
 * Seneca delivers personalized intelligence (pending votes, score changes, delegator trends).
 * Workspace is strictly for governance actions (voting, rationale submission, drafting).
 * You is identity + performance reflection + preferences.
 *
 * This is the single source of truth for all navigation surfaces:
 * - Desktop sidebar / icon rail
 * - Mobile bottom bar (1-3 items, persona-adaptive)
 * - Mobile pill bar (section sub-pages)
 * - Header help dropdown
 *
 * See docs/strategy/context/navigation-architecture.md for the full spec.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Home,
  User,
  HelpCircle,
  FileText,
  Users,
  Building2,
  ScrollText,
  BarChart3,
  UserCog,
  Settings,
  BadgeCheck,
  BookOpen,
  MessageSquare,
  Rocket,
  Link2,
  PenLine,
  Briefcase,
  Telescope,
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
// Workspace section definitions — Actions only: Review + Author
// ---------------------------------------------------------------------------

/**
 * Operator workspace (DRep / SPO): Review-first (their #1 JTBD), then Author.
 * Homepage serves as the command center — workspace is strictly for actions.
 */
export const WORKSPACE_OPERATOR_ITEMS: NavItem[] = [
  {
    href: '/workspace/review',
    label: 'Review',
    icon: FileText,
    sublabelKey: 'workspace.pendingReview',
  },
  { href: '/workspace/author', label: 'Author', icon: PenLine, sublabelKey: 'workspace.drafts' },
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

/**
 * Home discovery sub-items — shown in pill bar on the homepage.
 * Each sets a ?filter= URL param on / to activate the discovery overlay + globe highlighting.
 */
export const HOME_DISCOVERY_ITEMS: NavItem[] = [
  {
    href: '/?filter=proposals',
    label: 'Proposals',
    icon: FileText,
    sublabelKey: 'gov.activeProposals',
  },
  {
    href: '/?filter=dreps',
    label: 'Representatives',
    icon: Users,
    sublabelKey: 'gov.activeDreps',
  },
  { href: '/?filter=spos', label: 'Pools', icon: Building2, sublabelKey: 'gov.activePools' },
  {
    href: '/governance/observatory',
    label: 'Observatory',
    icon: Telescope,
    sublabelKey: 'gov.ghiScore',
  },
];

/**
 * Build persona-specific You items.
 *
 * You = Identity + Performance + Preferences:
 *   - Identity: Governance Rings, milestones, civic profile
 *   - Scorecard: Pillar breakdown, tier, competitive rank, delegator summary (DRep/SPO)
 *   - Record: Voting history + rationale coverage (DRep/SPO)
 *   - Delegation: DRep performance, alignment drift (Citizens)
 *   - Settings: Governance tuner, notifications, profile editing
 */
export function getYouItems(
  segment: UserSegment,
  context?: { drepId?: string | null; poolId?: string | null; isDelegated?: boolean },
): NavItem[] {
  const hasDrep = segment === 'drep' || !!context?.drepId;
  const hasSpo = segment === 'spo' || !!context?.poolId;
  const isDualRole = hasDrep && hasSpo;

  const items: NavItem[] = [{ href: '/you', label: 'Identity', icon: UserCog }];

  if (isDualRole) {
    // Dual-role: show both scorecards with disambiguating labels
    items.push({
      href: '/you/scorecard?role=drep',
      label: 'DRep Scorecard',
      icon: BadgeCheck,
      sublabelKey: 'you.drepScore',
    });
    items.push({
      href: '/you/scorecard?role=spo',
      label: 'Pool Scorecard',
      icon: BarChart3,
      sublabelKey: 'you.spoScore',
    });
  } else if (hasDrep) {
    items.push({
      href: '/you/scorecard',
      label: 'Scorecard',
      icon: BadgeCheck,
      sublabelKey: 'you.drepScore',
    });
  } else if (hasSpo) {
    items.push({
      href: '/you/scorecard',
      label: 'Scorecard',
      icon: BarChart3,
      sublabelKey: 'you.spoScore',
    });
  }

  // Voting record for operators
  if (hasDrep || hasSpo) {
    items.push({
      href: '/you/record',
      label: 'Record',
      icon: ScrollText,
      sublabelKey: 'you.totalVotes',
    });
  }

  // Delegation health for citizens (not for DRep/SPO — they have Scorecard with delegator metrics)
  if (segment === 'citizen') {
    items.push({
      href: '/you/delegation',
      label: 'Delegation',
      icon: Link2,
      sublabelKey: 'you.coverage',
    });
  }

  items.push({ href: '/you/settings', label: 'Settings', icon: Settings });

  return items;
}

/** Help items — used in header dropdown (no longer in sidebar) */
export const HELP_ITEMS: NavItem[] = [
  { href: '/match', label: 'Get Started', icon: Rocket },
  { href: '/help', label: 'FAQ', icon: HelpCircle },
  { href: '/help/glossary', label: 'Glossary', icon: BookOpen },
  { href: '/help/methodology', label: 'Methodology', icon: BarChart3 },
  { href: '/help/support', label: 'Support', icon: MessageSquare },
];

// ---------------------------------------------------------------------------
// Sidebar sections — Three Worlds: Home, Workspace, You
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

/** All authenticated users get Workspace — any citizen can author proposals. */
function hasWorkspace(ctx: NavContext): boolean {
  return ctx.segment !== 'anonymous';
}

export function getSidebarSections(
  segmentOrContext: UserSegment | SidebarContext | NavContext,
): NavSection[] {
  // Support legacy single-segment call, SidebarContext, and NavContext
  const ctx: NavContext =
    typeof segmentOrContext === 'string' ? { segment: segmentOrContext } : segmentOrContext;
  const { segment, drepId, poolId, depth } = ctx;

  const sections: NavSection[] = [];

  // ── World 1: Home — briefing surface (always a single link) ───────────
  sections.push({
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '/',
  });

  // ── World 2: Workspace — actions only (Review + Author) ───────────────
  // Operators (DRep/SPO) get Review + Author. Citizens get Author + disabled Review.
  if (hasWorkspace(ctx)) {
    const isOperator = segment === 'drep' || segment === 'spo' || !!drepId || !!poolId;
    const workspaceItems = isOperator ? WORKSPACE_OPERATOR_ITEMS : WORKSPACE_CITIZEN_ITEMS;
    sections.push({
      id: 'workspace',
      label: 'Workspace',
      icon: Briefcase,
      href: isOperator ? '/workspace' : '/workspace/author',
      items: filterByDepth(workspaceItems, depth),
      requiresAuth: true,
    });
  }

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
// Bottom bar — 3 or 4 items, persona-adaptive
// ---------------------------------------------------------------------------

/** Anonymous: Home only (match is a Seneca mode on Home) */
const BOTTOM_BAR_ANONYMOUS: NavItem[] = [{ href: '/', label: 'Home', icon: Home }];

/** Citizen (undelegated): Home | Workspace */
const BOTTOM_BAR_CITIZEN: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace/author', label: 'Workspace', icon: Briefcase },
];

/** Citizen (delegated): Home | Workspace | You */
const BOTTOM_BAR_CITIZEN_DELEGATED: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace/author', label: 'Workspace', icon: Briefcase },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** DRep: Home | Workspace | You */
const BOTTOM_BAR_DREP: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase, badge: 'actions' },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** SPO: Home | Workspace | You */
const BOTTOM_BAR_SPO: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase },
  { href: '/you', label: 'You', icon: User, badge: 'unread' },
];

/** CC: Home | Workspace | You */
const BOTTOM_BAR_CC: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/workspace/author', label: 'Workspace', icon: Briefcase },
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
      // Delegated citizens (hands-off+ depth) get You; undelegated get Home + Workspace only
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

  // Homepage shows governance discovery pill bar
  if (pathname === '/') {
    return filterByDepth(HOME_DISCOVERY_ITEMS, depth);
  }
  // Workspace routes show workspace sub-items in the pill bar
  if (pathname.startsWith('/workspace')) {
    const isOperator =
      segment === 'drep' || segment === 'spo' || !!context?.drepId || !!context?.poolId;
    const workspaceItems = isOperator ? WORKSPACE_OPERATOR_ITEMS : WORKSPACE_CITIZEN_ITEMS;
    return filterByDepth(workspaceItems, depth);
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
  if (pathname === '/' || pathname === '/match') return 'home';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/help')) return 'help';
  return null;
}

// ---------------------------------------------------------------------------
// Section-level metric keys — used by NavigationRail for rich tooltips
// ---------------------------------------------------------------------------

/** Maps section IDs to the primary sidebar-metric key for that section's summary. */
export const SECTION_METRIC_KEYS: Record<string, string> = {
  home: 'gov.activeProposals',
  workspace: 'workspace.pendingVotes',
  you: 'you.drepScore',
};
