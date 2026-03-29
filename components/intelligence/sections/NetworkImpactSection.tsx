'use client';

import { Network, AlertTriangle, Info } from 'lucide-react';

// Parameters that directly affect SPO operations
const SPO_IMPACT_PARAMS: Record<
  string,
  { label: string; impact: string; severity: 'high' | 'medium' | 'low' }
> = {
  minPoolCost: {
    label: 'Minimum Pool Cost',
    impact: 'Directly affects pool fee structure and competitiveness',
    severity: 'high',
  },
  nOpt: {
    label: 'Desired Number of Pools (k)',
    impact: 'Changes saturation point and optimal pool size',
    severity: 'high',
  },
  a0: {
    label: 'Pledge Influence Factor',
    impact: 'Affects reward calculation based on pledge amount',
    severity: 'high',
  },
  poolDeposit: {
    label: 'Pool Registration Deposit',
    impact: 'Changes cost to register or re-register a pool',
    severity: 'medium',
  },
  eMax: {
    label: 'Max Epoch for Pool Retirement',
    impact: 'Limits how far in advance pools can announce retirement',
    severity: 'low',
  },
  rho: {
    label: 'Monetary Expansion Rate',
    impact: 'Affects total rewards available for distribution to pools',
    severity: 'medium',
  },
  tau: {
    label: 'Treasury Rate',
    impact: 'Changes the share of rewards directed to treasury vs. pools',
    severity: 'medium',
  },
  maxBlockBodySize: {
    label: 'Max Block Body Size',
    impact: 'Affects block propagation time and relay infrastructure requirements',
    severity: 'medium',
  },
};

const SEVERITY_COLORS = {
  high: 'text-red-400 bg-red-400/10',
  medium: 'text-[var(--wayfinder-amber)] bg-[var(--wayfinder-amber)]/10',
  low: 'text-muted-foreground bg-muted/50',
} as const;

interface NetworkImpactSectionProps {
  proposalType: string;
  typeSpecific?: Record<string, unknown>;
}

/**
 * SPO-specific network impact section for ParameterChange and HardForkInitiation proposals.
 * Shows which parameters affect pool operations and their severity.
 */
export function NetworkImpactSection({ proposalType, typeSpecific }: NetworkImpactSectionProps) {
  if (proposalType === 'HardForkInitiation') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-[var(--wayfinder-amber)]/10 p-3">
          <AlertTriangle className="h-4 w-4 text-[var(--wayfinder-amber)] mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-[var(--wayfinder-amber)]">
              Hard Fork — Node Upgrade Required
            </p>
            <p className="text-muted-foreground mt-1">
              This proposal triggers a hard fork. All stake pools must upgrade their node software
              before the target epoch to avoid being left on the old chain.
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Check IOG release channels for compatible node versions.
        </div>
      </div>
    );
  }

  // ParameterChange — identify affected SPO parameters
  const rawParam = typeSpecific?.parameterName;
  const paramName = typeof rawParam === 'string' ? rawParam : null;
  const proposedValue = (typeSpecific?.proposedValue as string) ?? null;
  const impactInfo = paramName ? SPO_IMPACT_PARAMS[paramName] : null;

  if (!impactInfo && !paramName) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Network className="h-4 w-4" />
        No specific network impact data available for this parameter change.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {impactInfo ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[impactInfo.severity]}`}
            >
              {impactInfo.severity} impact
            </span>
            <span className="text-sm font-medium">{impactInfo.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{impactInfo.impact}</p>
          {proposedValue && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5 font-mono">
              Proposed value: {proposedValue}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{paramName}</span> — this parameter does not directly affect
          pool operations, but may have indirect network effects.
        </div>
      )}
    </div>
  );
}
