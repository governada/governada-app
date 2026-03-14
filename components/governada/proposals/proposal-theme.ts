/**
 * Design tokens for proposal type-specific visual identity.
 * Single source of truth for all proposal theming across the app.
 */

import { Landmark, Shield, Zap, Eye, Scale, FileText, Gavel } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Type Theme
// ---------------------------------------------------------------------------

export interface ProposalTypeTheme {
  label: string;
  icon: LucideIcon;
  /** CSS gradient for hero background */
  heroBg: string;
  /** Primary accent color (CSS rgb value) */
  accent: string;
  /** Muted accent for subtle backgrounds */
  accentMuted: string;
  /** Badge classes for detail page */
  badgeClass: string;
  /** Badge classes for browse list (dark-mode optimized) */
  browseBadgeClass: string;
  /** Left-border accent for browse rows */
  rowAccent: string;
}

export const PROPOSAL_TYPE_THEMES: Record<string, ProposalTypeTheme> = {
  TreasuryWithdrawals: {
    label: 'Spending Proposal',
    icon: Landmark,
    heroBg: 'linear-gradient(180deg, rgb(69 26 3 / 0.45) 0%, transparent 65%)',
    accent: 'rgb(245 158 11)',
    accentMuted: 'rgb(245 158 11 / 0.08)',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    browseBadgeClass: 'bg-amber-950/30 text-amber-400 border-amber-800/30',
    rowAccent: 'rgb(245 158 11 / 0.5)',
  },
  ParameterChange: {
    label: 'Rule Change',
    icon: Shield,
    heroBg: 'linear-gradient(180deg, rgb(12 10 62 / 0.5) 0%, transparent 65%)',
    accent: 'rgb(59 130 246)',
    accentMuted: 'rgb(59 130 246 / 0.08)',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    browseBadgeClass: 'bg-blue-950/30 text-blue-400 border-blue-800/30',
    rowAccent: 'rgb(59 130 246 / 0.5)',
  },
  HardForkInitiation: {
    label: 'Major Upgrade',
    icon: Zap,
    heroBg: 'linear-gradient(180deg, rgb(67 20 7 / 0.55) 0%, transparent 65%)',
    accent: 'rgb(239 68 68)',
    accentMuted: 'rgb(239 68 68 / 0.08)',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    browseBadgeClass: 'bg-orange-950/30 text-orange-400 border-orange-800/30',
    rowAccent: 'rgb(239 68 68 / 0.5)',
  },
  InfoAction: {
    label: 'Community Statement',
    icon: Eye,
    heroBg: 'linear-gradient(180deg, rgb(30 41 59 / 0.25) 0%, transparent 65%)',
    accent: 'rgb(148 163 184)',
    accentMuted: 'rgb(148 163 184 / 0.06)',
    badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    browseBadgeClass: 'bg-muted text-muted-foreground',
    rowAccent: 'rgb(148 163 184 / 0.3)',
  },
  NoConfidence: {
    label: 'Leadership Challenge',
    icon: Scale,
    heroBg: 'linear-gradient(180deg, rgb(76 5 25 / 0.45) 0%, transparent 65%)',
    accent: 'rgb(244 63 94)',
    accentMuted: 'rgb(244 63 94 / 0.08)',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
    browseBadgeClass: 'bg-rose-950/30 text-rose-400 border-rose-800/30',
    rowAccent: 'rgb(244 63 94 / 0.5)',
  },
  NewCommittee: {
    label: 'Committee Update',
    icon: Gavel,
    heroBg: 'linear-gradient(180deg, rgb(46 16 101 / 0.4) 0%, transparent 65%)',
    accent: 'rgb(139 92 246)',
    accentMuted: 'rgb(139 92 246 / 0.08)',
    badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
    browseBadgeClass: 'bg-violet-950/30 text-violet-400 border-violet-800/30',
    rowAccent: 'rgb(139 92 246 / 0.5)',
  },
  NewConstitutionalCommittee: {
    label: 'Committee Update',
    icon: Gavel,
    heroBg: 'linear-gradient(180deg, rgb(46 16 101 / 0.4) 0%, transparent 65%)',
    accent: 'rgb(139 92 246)',
    accentMuted: 'rgb(139 92 246 / 0.08)',
    badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
    browseBadgeClass: 'bg-violet-950/30 text-violet-400 border-violet-800/30',
    rowAccent: 'rgb(139 92 246 / 0.5)',
  },
  UpdateCommittee: {
    label: 'Committee Update',
    icon: Scale,
    heroBg: 'linear-gradient(180deg, rgb(46 16 101 / 0.4) 0%, transparent 65%)',
    accent: 'rgb(139 92 246)',
    accentMuted: 'rgb(139 92 246 / 0.08)',
    badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
    browseBadgeClass: 'bg-violet-950/30 text-violet-400 border-violet-800/30',
    rowAccent: 'rgb(139 92 246 / 0.5)',
  },
  NewConstitution: {
    label: 'Rules Update',
    icon: FileText,
    heroBg: 'linear-gradient(180deg, rgb(30 27 75 / 0.5) 0%, transparent 65%)',
    accent: 'rgb(99 102 241)',
    accentMuted: 'rgb(99 102 241 / 0.08)',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    browseBadgeClass: 'bg-purple-950/30 text-purple-400 border-purple-800/30',
    rowAccent: 'rgb(99 102 241 / 0.5)',
  },
  UpdateConstitution: {
    label: 'Rules Update',
    icon: FileText,
    heroBg: 'linear-gradient(180deg, rgb(30 27 75 / 0.5) 0%, transparent 65%)',
    accent: 'rgb(99 102 241)',
    accentMuted: 'rgb(99 102 241 / 0.08)',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    browseBadgeClass: 'bg-purple-950/30 text-purple-400 border-purple-800/30',
    rowAccent: 'rgb(99 102 241 / 0.5)',
  },
};

const DEFAULT_THEME: ProposalTypeTheme = {
  label: 'Governance Action',
  icon: Scale,
  heroBg: 'linear-gradient(180deg, rgb(30 41 59 / 0.2) 0%, transparent 65%)',
  accent: 'rgb(148 163 184)',
  accentMuted: 'rgb(148 163 184 / 0.06)',
  badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  browseBadgeClass: 'bg-muted text-muted-foreground',
  rowAccent: 'rgb(148 163 184 / 0.3)',
};

export function getProposalTheme(proposalType: string): ProposalTypeTheme {
  return PROPOSAL_TYPE_THEMES[proposalType] ?? DEFAULT_THEME;
}

// ---------------------------------------------------------------------------
// Verdict — quick visual indicator of proposal trajectory
// ---------------------------------------------------------------------------

export type VerdictType = 'passing' | 'failing' | 'contested' | 'passed' | 'rejected' | 'expired';

export interface VerdictInfo {
  type: VerdictType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface TriBodyInput {
  drep: { yes: number; no: number; abstain: number };
  spo: { yes: number; no: number; abstain: number };
  cc: { yes: number; no: number; abstain: number };
}

export function getVerdict(status: string, triBody?: TriBodyInput | null): VerdictInfo {
  if (status === 'enacted' || status === 'ratified') {
    return {
      type: 'passed',
      label: status === 'enacted' ? 'Enacted' : 'Ratified',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    };
  }
  if (status === 'dropped') {
    return {
      type: 'rejected',
      label: 'Dropped',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    };
  }
  if (status === 'expired') {
    return {
      type: 'expired',
      label: 'Expired',
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
    };
  }

  if (!triBody) {
    return {
      type: 'contested',
      label: 'Awaiting Votes',
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
    };
  }

  const bodies = [triBody.drep, triBody.spo, triBody.cc];
  const activeBodies = bodies.filter((b) => b.yes + b.no + b.abstain > 0);
  if (activeBodies.length === 0) {
    return {
      type: 'contested',
      label: 'Awaiting Votes',
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
    };
  }

  const yesPcts = activeBodies.map((b) => {
    const total = b.yes + b.no + b.abstain;
    return total > 0 ? b.yes / total : 0;
  });

  const allHigh = yesPcts.every((p) => p >= 0.6);
  const allLow = yesPcts.every((p) => p < 0.4);
  const mixed = yesPcts.some((p) => p >= 0.6) && yesPcts.some((p) => p < 0.4);

  if (allHigh) {
    return {
      type: 'passing',
      label: 'On Track to Pass',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    };
  }
  if (allLow) {
    return {
      type: 'failing',
      label: 'Likely to Fail',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    };
  }
  if (mixed) {
    return {
      type: 'contested',
      label: 'Contested',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    };
  }

  const avgYes = yesPcts.reduce((a, b) => a + b, 0) / yesPcts.length;
  if (avgYes >= 0.5) {
    return {
      type: 'passing',
      label: 'Leaning Pass',
      color: 'text-emerald-400/80',
      bgColor: 'bg-emerald-500/5',
      borderColor: 'border-emerald-500/20',
    };
  }
  return {
    type: 'failing',
    label: 'Leaning Fail',
    color: 'text-red-400/80',
    bgColor: 'bg-red-500/5',
    borderColor: 'border-red-500/20',
  };
}
