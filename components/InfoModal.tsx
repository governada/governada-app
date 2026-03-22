'use client';

/**
 * Info Modal Component
 * Provides detailed educational explanations
 */

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface InfoModalProps {
  title: string;
  children: ReactNode;
  triggerText?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'link';
  iconOnly?: boolean;
}

export function InfoModal({
  title,
  children,
  triggerText = 'Learn More',
  triggerVariant = 'ghost',
  iconOnly = false,
}: InfoModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size={iconOnly ? 'icon' : 'sm'}
          className={iconOnly ? 'h-6 w-6' : 'gap-2'}
          aria-label={iconOnly ? title : undefined}
        >
          <Info className="h-4 w-4" />
          {!iconOnly && triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-4 text-sm text-foreground">{children}</div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

// Predefined educational content
export function WhatIsDRepModal() {
  return (
    <InfoModal title="What is a DRep?" triggerVariant="link">
      <p>
        A <strong>Delegated Representative (DRep)</strong> is a governance participant in the
        Cardano blockchain who votes on behalf of ADA holders who delegate their voting power to
        them.
      </p>
      <p>
        Think of DReps as elected representatives in traditional government, but for blockchain
        governance. They vote on proposals that affect the Cardano ecosystem, including:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Treasury funding allocations</li>
        <li>Protocol parameter changes</li>
        <li>Constitutional amendments</li>
        <li>Hard fork decisions</li>
      </ul>
      <p>
        By delegating to a DRep, you give them the power to vote with your stake weight, while you
        retain full control of your ADA.
      </p>
    </InfoModal>
  );
}

export function ParticipationRateModal() {
  return (
    <InfoModal title="Understanding Effective Participation" triggerVariant="ghost" iconOnly>
      <p>
        <strong>Effective Participation</strong> measures how actively and thoughtfully a DRep
        engages with governance proposals.
      </p>
      <p>It&apos;s calculated as: (Participation Rate) × (Deliberation Modifier)</p>
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p className="font-medium">Deliberation Modifier</p>
        <p className="text-sm text-muted-foreground mb-2">
          This modifier penalizes rubber-stamping (voting the same way on every proposal):
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>&gt;95% same vote direction: 30% penalty</li>
          <li>&gt;90% same vote direction: 15% penalty</li>
          <li>&gt;85% same vote direction: 5% penalty</li>
          <li>≤85% same vote direction: No penalty</li>
        </ul>
      </div>
      <p>
        A higher effective participation rate indicates a DRep who shows up consistently AND
        demonstrates thoughtful consideration rather than voting uniformly on every proposal.
      </p>
    </InfoModal>
  );
}

export function DRepScoreModal() {
  return (
    <InfoModal title="Understanding DRep Score" triggerVariant="ghost" iconOnly>
      <p>
        The <strong>DRep Score</strong> is an objective 0-100 accountability metric that measures
        how well a DRep fulfills their governance responsibilities.
      </p>
      <p>
        Formula:{' '}
        <code className="bg-muted px-2 py-0.5 rounded">
          Engagement Quality (40%) + Effective Participation (25%) + Reliability (25%) + Governance
          Identity (10%)
        </code>
      </p>
      <div className="bg-muted p-4 rounded-lg space-y-3">
        <div>
          <p className="font-medium mb-1">Engagement Quality (40%)</p>
          <p className="text-sm text-muted-foreground">
            How well this DRep explains their votes. Three layers: rationale provision rate,
            AI-assessed rationale quality (outcome-blind), and deliberation signals including
            rationale diversity and coverage breadth.
          </p>
        </div>
        <div>
          <p className="font-medium mb-1">Effective Participation (25%)</p>
          <p className="text-sm text-muted-foreground">
            How often this DRep votes on available proposals, weighted by proposal importance.
            Critical proposals (hard forks, constitutional changes) count 3x. Close-margin proposals
            receive a 1.5x bonus.
          </p>
        </div>
        <div>
          <p className="font-medium mb-1">Reliability (25%)</p>
          <p className="text-sm text-muted-foreground">
            How steadily this DRep participates over time. Active streak, recency, gap penalty, and
            tenure. A DRep who votes consistently across epochs scores higher than one who was
            active then disappeared.
          </p>
        </div>
        <div>
          <p className="font-medium mb-1">Governance Identity (10%)</p>
          <p className="text-sm text-muted-foreground">
            Profile quality (CIP-119 metadata completeness with staleness decay) and delegation
            health (retention, diversity, growth). Well-documented DReps with healthy delegation
            relationships score higher.
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        This score is purely objective and doesn&apos;t consider your personal preferences. For
        personalized alignment, see the Match column.
      </p>
    </InfoModal>
  );
}

export function DecentralizationScoreModal() {
  return <DRepScoreModal />;
}

export function RationaleImportanceModal() {
  return (
    <InfoModal title="Why Rationale Matters" triggerVariant="ghost" iconOnly>
      <p>
        <strong>Rationale</strong> refers to the written explanation a DRep provides for their
        votes.
      </p>
      <p>High-quality DReps provide rationale because:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Transparency</strong> - You can understand their decision-making process
        </li>
        <li>
          <strong>Accountability</strong> - They publicly justify their positions
        </li>
        <li>
          <strong>Education</strong> - Helps you learn about complex governance issues
        </li>
        <li>
          <strong>Trust Building</strong> - Shows thoughtful consideration of proposals
        </li>
      </ul>
      <p>
        When selecting a DRep, look for those with high rationale provision rates (80%+) and review
        their past rationales to ensure their reasoning aligns with your values.
      </p>
      <p className="text-sm text-muted-foreground">
        Note: Rationale is weighted by proposal importance — critical governance votes (hard forks,
        constitutional changes) count 3x more than routine votes. Rationale must be at least 50
        characters to count. DReps who list social/communication channels in their CIP-119 profile
        receive credit via the Profile Completeness score.
      </p>
    </InfoModal>
  );
}

export function DelegationRisksModal() {
  return (
    <InfoModal title="Delegation: Risks and Myths" triggerText="Important Info">
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">
            Myth: Delegation Locks Your ADA
          </h4>
          <p>
            <strong>FALSE.</strong> Your ADA remains in your wallet and is always accessible. You
            can spend, move, or redelegate at any time. Delegation only affects voting power, not
            ownership.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
            Risk: Poor DRep Performance
          </h4>
          <p>
            A DRep who rarely votes or votes against your values may not represent you well.
            Solution: Monitor their activity and redelegate if needed. There&apos;s no penalty for
            changing DReps.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">
            Best Practice: Stay Informed
          </h4>
          <p>
            Regularly check your DRep&apos;s voting record and rationales. The governance landscape
            evolves, and what aligned with your values yesterday may not tomorrow.
          </p>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <p className="font-medium mb-2">Remember:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>You can always redelegate</li>
            <li>Your ADA is never at risk</li>
            <li>No fees for delegation changes</li>
            <li>You can become your own DRep if you prefer</li>
          </ul>
        </div>
      </div>
    </InfoModal>
  );
}
