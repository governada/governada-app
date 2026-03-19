'use client';

/**
 * Financial Simulation — Step 1 of the submission ceremony.
 *
 * Shows the financial impact of submitting a governance action:
 * deposit, fee, balance, deposit return conditions, and voting mechanics.
 */

import { AlertTriangle, Check, ArrowRight, ArrowLeft, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { GovernanceActionPreflight, ProposalType } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FinancialSimulationProps {
  preflight: GovernanceActionPreflight | null;
  proposalType: ProposalType;
  isLoading: boolean;
  onContinue: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Voting mechanics data (constitutional/protocol-level, hardcoded per type)
// ---------------------------------------------------------------------------

interface VotingMechanics {
  bodies: string[];
  threshold: string;
}

const VOTING_MECHANICS: Record<ProposalType, VotingMechanics> = {
  InfoAction: {
    bodies: ['DRep'],
    threshold: 'Simple majority (>50%)',
  },
  TreasuryWithdrawals: {
    bodies: ['DRep', 'Constitutional Committee'],
    threshold: '67% DRep voting power + CC majority',
  },
  ParameterChange: {
    bodies: ['DRep', 'Constitutional Committee'],
    threshold: '67% DRep voting power + CC majority',
  },
  HardForkInitiation: {
    bodies: ['DRep', 'SPO', 'Constitutional Committee'],
    threshold: '75% DRep + SPO + CC majority',
  },
  NoConfidence: {
    bodies: ['DRep', 'SPO'],
    threshold: '67% DRep + SPO voting power',
  },
  NewCommittee: {
    bodies: ['DRep', 'SPO'],
    threshold: '67% DRep + SPO voting power',
  },
  NewConstitution: {
    bodies: ['DRep', 'Constitutional Committee'],
    threshold: '75% DRep voting power + CC majority',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAda(lovelaceStr: string): string {
  const ada = Number(lovelaceStr) / 1_000_000;
  return `${ada.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ADA`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinancialSimulation({
  preflight,
  proposalType,
  isLoading,
  onContinue,
  onBack,
}: FinancialSimulationProps) {
  const mechanics = VOTING_MECHANICS[proposalType];

  if (isLoading || !preflight) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--compass-teal)]" />
        <p className="text-sm text-muted-foreground">Running preflight checks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-1">
          Financial Impact
        </h2>
        <p className="text-sm text-muted-foreground">
          Review the financial commitment required for this governance action.
        </p>
      </div>

      {/* ── Deposit & Balance ── */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Deposit Required</span>
          <span className="text-sm font-mono font-semibold text-[var(--wayfinder-amber)]">
            {formatAda(preflight.depositLovelace)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Estimated Fee</span>
          <span className="text-sm font-mono text-foreground">{preflight.estimatedFee}</span>
        </div>
        <div className="border-t border-border pt-3 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Your Wallet Balance</span>
          <span className="text-sm font-mono text-foreground">{preflight.currentBalance}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Balance After</span>
          <span
            className={`text-sm font-mono ${
              preflight.canAfford ? 'text-foreground' : 'text-destructive font-semibold'
            }`}
          >
            {preflight.canAfford ? preflight.balanceAfter : 'Insufficient funds'}
          </span>
        </div>
      </div>

      {/* ── Insufficient balance warning ── */}
      {!preflight.canAfford && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive text-sm">
            Your wallet does not have sufficient funds for the deposit plus transaction fees.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Deposit Return Conditions ── */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground mb-2">Deposit Return Conditions</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <span className="text-foreground">Returned if proposal is ratified</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <span className="text-foreground">
              Returned if proposal expires after the voting period
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-[var(--wayfinder-amber)] mt-0.5 shrink-0" />
            <span className="text-foreground">
              May not be returned if dropped as unconstitutional
            </span>
          </div>
        </div>
      </div>

      {/* ── Voting Mechanics ── */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground mb-2">Voting Mechanics</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">Bodies that vote: </span>
              <span className="text-foreground">{mechanics.bodies.join(' + ')}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">Threshold: </span>
              <span className="text-foreground">{mechanics.threshold}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">Voting period: </span>
              <span className="text-foreground">~6 epochs (~30 days)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={!preflight.canAfford} className="flex-1">
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
