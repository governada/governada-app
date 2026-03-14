'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Share2, Check, Shield, Wallet, Link2, Vote, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackOnboarding, ONBOARDING_EVENTS } from '@/lib/funnel';
import { Badge } from '@/components/ui/badge';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import type { AlignmentScores } from '@/lib/drepIdentity';

/* ── Types ──────────────────────────────────────────────────────── */

export interface GovernancePassportData {
  stage: 1 | 2 | 3 | 4 | 'complete';
  alignment?: AlignmentScores;
  matchedDrepId?: string;
  matchedDrepName?: string;
  matchScore?: number;
  walletReady?: boolean;
  walletPath?: 'wallet' | 'cex' | 'no-ada' | 'exploring';
  connectedAt?: string;
  delegatedAt?: string;
  createdAt: string;
}

interface GovernancePassportProps {
  /** Passport data — reads from localStorage if not provided */
  passport?: GovernancePassportData | null;
  /** Show in view-only mode (for shared passport links) */
  viewOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/* ── Constants ──────────────────────────────────────────────────── */

const STORAGE_KEY = 'governada_passport';

const STAGE_LABELS: Record<string, string> = {
  '1': 'Discover',
  '2': 'Prepare',
  '3': 'Connect',
  '4': 'Delegate',
  complete: 'Active Citizen',
};

const STAGE_NUMBERS = [1, 2, 3, 4] as const;

/* ── Helpers ────────────────────────────────────────────────────── */

export function loadPassport(): GovernancePassportData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GovernancePassportData;
  } catch {
    return null;
  }
}

export function savePassport(passport: GovernancePassportData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passport));
}

export function encodePassportForShare(passport: GovernancePassportData): string {
  // Only include shareable fields (no timestamps that reveal PII)
  const shareable = {
    stage: passport.stage,
    alignment: passport.alignment,
    matchedDrepName: passport.matchedDrepName,
    matchScore: passport.matchScore,
  };
  return btoa(JSON.stringify(shareable));
}

export function decodeSharedPassport(encoded: string): Partial<GovernancePassportData> | null {
  try {
    const json = atob(encoded);
    return JSON.parse(json) as Partial<GovernancePassportData>;
  } catch {
    return null;
  }
}

function getStageNumber(stage: GovernancePassportData['stage']): number {
  return stage === 'complete' ? 5 : stage;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/* ── Stage Progress Indicator ──────────────────────────────────── */

function StageProgress({ currentStage }: { currentStage: GovernancePassportData['stage'] }) {
  const stageNum = getStageNumber(currentStage);

  return (
    <div className="flex items-center gap-1">
      {STAGE_NUMBERS.map((num) => {
        const isComplete = stageNum > num;
        const isCurrent = stageNum === num;
        return (
          <div key={num} className="flex items-center">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-500',
                isComplete && 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
                isCurrent &&
                  'bg-primary/20 text-primary ring-1 ring-primary/40 shadow-[0_0_8px_rgba(99,102,241,0.3)]',
                !isComplete && !isCurrent && 'bg-muted/30 text-muted-foreground/40',
              )}
            >
              {isComplete ? <Check className="h-3 w-3" /> : num}
            </div>
            {num < 4 && (
              <div
                className={cn(
                  'mx-0.5 h-px w-3 transition-colors duration-500',
                  stageNum > num ? 'bg-emerald-500/40' : 'bg-muted/30',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Passport Stage Slots ──────────────────────────────────────── */

function EmptySlot({ icon: Icon, label }: { icon: typeof Shield; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-muted/40 px-3 py-2 text-muted-foreground/40">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

function AlignmentSection({
  alignment,
  matchedDrepName,
  matchScore,
}: {
  alignment: AlignmentScores;
  matchedDrepName?: string;
  matchScore?: number;
}) {
  return (
    <div className="space-y-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Governance Values</span>
        {matchScore != null && (
          <Badge variant="secondary" className="text-[10px]">
            {matchScore}% match
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <GovernanceRadar alignments={alignment} size="medium" animate={false} />
        {matchedDrepName && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{matchedDrepName}</p>
            <p className="text-[10px] text-muted-foreground">Your top match</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletReadySection() {
  return (
    <div className="flex items-center gap-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
        <Wallet className="h-3 w-3 text-emerald-400" />
      </div>
      <span className="text-xs font-medium text-emerald-400">Wallet ready</span>
    </div>
  );
}

function ConnectedSection({ connectedAt }: { connectedAt?: string }) {
  return (
    <div className="flex items-center gap-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15">
        <Link2 className="h-3 w-3 text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-blue-400">Wallet connected</span>
        {connectedAt && (
          <p className="text-[10px] text-muted-foreground">{formatDate(connectedAt)}</p>
        )}
      </div>
    </div>
  );
}

function DelegatedSection({ delegatedAt }: { delegatedAt?: string }) {
  return (
    <div className="flex items-center gap-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15">
        <Vote className="h-3 w-3 text-indigo-400" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-indigo-400">Delegated</span>
        {delegatedAt && (
          <p className="text-[10px] text-muted-foreground">{formatDate(delegatedAt)}</p>
        )}
      </div>
    </div>
  );
}

/* ── Share Button ──────────────────────────────────────────────── */

function ShareButton({ passport }: { passport: GovernancePassportData }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    trackOnboarding(ONBOARDING_EVENTS.PASSPORT_SHARED, {
      stage: passport.stage,
    });
    const encoded = encodePassportForShare(passport);
    const url = `${window.location.origin}/get-started?passport=${encoded}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Governance Passport',
          text: 'Check out my Cardano governance values!',
          url,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [passport]);

  return (
    <button
      onClick={handleShare}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        copied
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
      aria-label={copied ? 'Link copied' : 'Share passport'}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-3 w-3" />
          Share
        </>
      )}
    </button>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

export function GovernancePassport({
  passport: passportProp,
  viewOnly,
  className,
}: GovernancePassportProps) {
  const [localPassport, setLocalPassport] = useState<GovernancePassportData | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Load from localStorage on mount if no prop provided
  useEffect(() => {
    if (!passportProp) {
      setLocalPassport(loadPassport());
    }
  }, [passportProp]);

  const passport = passportProp ?? localPassport;

  const stageNum = useMemo(() => (passport ? getStageNumber(passport.stage) : 0), [passport]);

  const isComplete = passport?.stage === 'complete';

  // Desktop: full card. Mobile: collapsible compact bar.
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border transition-all duration-300',
        isComplete
          ? 'border-emerald-500/30 bg-gradient-to-br from-card to-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.06)]'
          : 'border-border/60 bg-card',
        className,
      )}
    >
      {/* Subtle passport pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 20px,
            currentColor 20px,
            currentColor 21px
          )`,
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">
            {isComplete ? 'Active Governance Citizen' : 'Governance Passport'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {passport && !viewOnly && <ShareButton passport={passport} />}
          {/* Mobile toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted/30 md:hidden"
            aria-label={expanded ? 'Collapse passport' : 'Expand passport'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Body — collapsible on mobile */}
      <div
        className={cn(
          'relative space-y-3 px-4 py-3 transition-all duration-300 md:block',
          expanded ? 'block' : 'hidden',
        )}
      >
        {/* Progress bar */}
        {passport && (
          <div className="flex items-center justify-between">
            <StageProgress currentStage={passport.stage} />
            <span className="text-[10px] font-medium text-muted-foreground">
              {isComplete
                ? 'Complete'
                : `Stage ${stageNum} — ${STAGE_LABELS[String(passport.stage)]}`}
            </span>
          </div>
        )}

        {/* Empty state (no passport) */}
        {!passport && (
          <div className="space-y-3 py-2">
            <p className="text-center text-sm text-muted-foreground">
              Start your governance journey
            </p>
            <div className="space-y-1.5">
              <EmptySlot icon={Shield} label="Governance values" />
              <EmptySlot icon={Wallet} label="Wallet setup" />
              <EmptySlot icon={Link2} label="Wallet connection" />
              <EmptySlot icon={Vote} label="Delegation" />
            </div>
          </div>
        )}

        {/* Stage 1+: Alignment */}
        {passport && stageNum >= 2 && passport.alignment ? (
          <AlignmentSection
            alignment={passport.alignment}
            matchedDrepName={passport.matchedDrepName}
            matchScore={passport.matchScore}
          />
        ) : (
          passport && stageNum < 2 && <EmptySlot icon={Shield} label="Governance values" />
        )}

        {/* Stage 2+: Wallet ready */}
        {passport && stageNum >= 3 && passport.walletReady ? (
          <WalletReadySection />
        ) : (
          passport &&
          stageNum < 3 &&
          stageNum >= 2 && <EmptySlot icon={Wallet} label="Wallet setup" />
        )}

        {/* Stage 3+: Connected */}
        {passport && stageNum >= 4 && passport.connectedAt ? (
          <ConnectedSection connectedAt={passport.connectedAt} />
        ) : (
          passport &&
          stageNum < 4 &&
          stageNum >= 3 && <EmptySlot icon={Link2} label="Wallet connection" />
        )}

        {/* Stage 4/complete: Delegated */}
        {passport && isComplete && passport.delegatedAt ? (
          <DelegatedSection delegatedAt={passport.delegatedAt} />
        ) : (
          passport && !isComplete && stageNum >= 4 && <EmptySlot icon={Vote} label="Delegation" />
        )}

        {/* View-only CTA */}
        {viewOnly && (
          <div className="pt-2">
            <a
              href="/get-started"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Discover YOUR governance values
            </a>
          </div>
        )}
      </div>

      {/* Collapsed mobile summary */}
      {!expanded && passport && (
        <div className="relative flex items-center gap-3 px-4 py-2 md:hidden">
          <StageProgress currentStage={passport.stage} />
          {passport.matchedDrepName && (
            <span className="truncate text-xs text-muted-foreground">
              {passport.matchedDrepName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
