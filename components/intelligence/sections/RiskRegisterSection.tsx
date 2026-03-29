'use client';

/**
 * RiskRegisterSection — aggregated risk view for intelligence brief.
 *
 * Combines constitutional flags + community concern themes into a unified
 * risk register showing constitutional, political, and financial risks.
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, Shield, Banknote, Users } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

interface RiskItem {
  category: 'constitutional' | 'political' | 'financial';
  severity: 'low' | 'medium' | 'high';
  description: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RiskRegisterSectionProps {
  constitutionalFlags?: ConstitutionalFlag[];
  /** Withdrawal amount in lovelace (for treasury proposals) */
  withdrawalAmount?: number | null;
  /** Number of community concern annotations */
  concernCount?: number;
  proposalType?: string;
}

// ---------------------------------------------------------------------------
// Risk derivation
// ---------------------------------------------------------------------------

function deriveRisks(props: RiskRegisterSectionProps): RiskItem[] {
  const risks: RiskItem[] = [];

  // Constitutional risks from flags
  if (props.constitutionalFlags) {
    for (const flag of props.constitutionalFlags) {
      risks.push({
        category: 'constitutional',
        severity:
          flag.severity === 'critical' ? 'high' : flag.severity === 'warning' ? 'medium' : 'low',
        description: `${flag.article}${flag.section ? `, ${flag.section}` : ''} — ${flag.concern}`,
        source: 'Constitutional check',
      });
    }
  }

  // Financial risk for treasury proposals
  if (props.withdrawalAmount && props.withdrawalAmount > 0) {
    const ada = props.withdrawalAmount / 1_000_000;
    const severity = ada > 10_000_000 ? 'high' : ada > 1_000_000 ? 'medium' : 'low';
    risks.push({
      category: 'financial',
      severity,
      description: `Treasury withdrawal of ₳${ada.toLocaleString()} requires community consensus`,
      source: 'Proposal metadata',
    });
  }

  // Political risk from community concerns
  if (props.concernCount && props.concernCount > 0) {
    const severity = props.concernCount >= 5 ? 'high' : props.concernCount >= 2 ? 'medium' : 'low';
    risks.push({
      category: 'political',
      severity,
      description: `${props.concernCount} community concern${props.concernCount !== 1 ? 's' : ''} flagged by reviewers`,
      source: 'Community feedback',
    });
  }

  return risks.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CATEGORY_ICONS = {
  constitutional: Shield,
  political: Users,
  financial: Banknote,
} as const;

const SEVERITY_STYLES = {
  high: 'bg-red-500/10 text-red-300 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
} as const;

export function RiskRegisterSection(props: RiskRegisterSectionProps) {
  const risks = deriveRisks(props);

  if (risks.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/60">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>No significant risks identified</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 uppercase tracking-wide">
        <span>Risk</span>
        <span>{risks.length} identified</span>
      </div>
      {risks.map((risk, i) => {
        const Icon = CATEGORY_ICONS[risk.category];
        return (
          <div
            key={i}
            className={cn(
              'rounded px-2.5 py-2 border text-[11px] leading-relaxed',
              SEVERITY_STYLES[risk.severity],
            )}
          >
            <div className="flex items-start gap-2">
              <Icon className="h-3 w-3 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p>{risk.description}</p>
                <span className="text-[9px] opacity-60">{risk.source}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
