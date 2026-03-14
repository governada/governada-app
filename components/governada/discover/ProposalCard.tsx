'use client';

import Link from 'next/link';
import { ChevronRight, Clock, Landmark, AlertTriangle, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProposalTheme, getVerdict } from '@/components/governada/proposals/proposal-theme';
import { ProposalDeliveryBadge } from '@/components/governada/proposals/ProposalDeliveryBadge';
import { NclImpactIndicator } from '@/components/shared/NclImpactIndicator';
import { useTreasuryNcl } from '@/hooks/queries';
import type { DeliveryStatus } from '@/lib/proposalOutcomes';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TriBody {
  drep: { yes: number; no: number; abstain: number };
  spo: { yes: number; no: number; abstain: number };
  cc: { yes: number; no: number; abstain: number };
}

export interface BrowseProposal {
  txHash: string;
  index: number;
  title?: string;
  type?: string;
  status?: string;
  expirationEpoch?: number;
  withdrawalAmount?: number;
  treasuryPct?: number;
  deliveryStatus?: string;
  deliveryScore?: number;
  triBody?: TriBody;
  relevantPrefs?: string[];
  [key: string]: unknown;
}

interface ProposalCardProps {
  proposal: BrowseProposal;
  currentEpoch: number | null;
  drepVote?: string;
  delegatedDrepId?: string | null;
  hasDrepVotes: boolean;
  animationDelay: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VOTE_PILL: Record<string, { label: string; cls: string }> = {
  Yes: { label: 'Yes', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  No: { label: 'No', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  Abstain: { label: 'Abstain', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

const PREF_LABELS: Record<string, string> = {
  'treasury-conservative': 'Treasury',
  'smart-treasury-growth': 'Growth',
  'strong-decentralization': 'Decentral',
  'protocol-security-first': 'Security',
  'innovation-defi-growth': 'Innovation',
  'responsible-governance': 'Transparency',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

function fmtPct(pct: number): string {
  if (pct < 0.01) return '<0.01%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

// ─── Vote visualization ─────────────────────────────────────────────────────

function VoteBar({
  label,
  data,
}: {
  label: string;
  data: { yes: number; no: number; abstain: number };
}) {
  const total = data.yes + data.no + data.abstain;
  if (total === 0) return null;
  const yesPct = (data.yes / total) * 100;
  const noPct = (data.no / total) * 100;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0 font-medium">
        {label}
      </span>
      <div className="flex-1 h-[5px] rounded-full bg-muted/40 overflow-hidden flex">
        {yesPct > 0 && (
          <div
            className="bg-emerald-500/90 transition-all duration-700 ease-out rounded-l-full"
            style={{ width: `${yesPct}%` }}
          />
        )}
        {noPct > 0 && (
          <div
            className="bg-red-500/80 transition-all duration-700 ease-out"
            style={{ width: `${noPct}%` }}
          />
        )}
      </div>
      <span
        className={cn(
          'text-[10px] tabular-nums w-8 text-right shrink-0 font-semibold',
          yesPct >= 60
            ? 'text-emerald-400'
            : yesPct >= 40
              ? 'text-muted-foreground'
              : 'text-red-400',
        )}
      >
        {Math.round(yesPct)}%
      </span>
    </div>
  );
}

function TriBodyVoteBars({ triBody }: { triBody: TriBody }) {
  const hasAny =
    triBody.drep.yes + triBody.drep.no + triBody.drep.abstain > 0 ||
    triBody.spo.yes + triBody.spo.no + triBody.spo.abstain > 0 ||
    triBody.cc.yes + triBody.cc.no + triBody.cc.abstain > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-1 flex-1 min-w-0 max-w-[260px]">
      <VoteBar label="DRep" data={triBody.drep} />
      <VoteBar label="SPO" data={triBody.spo} />
      <VoteBar label="CC" data={triBody.cc} />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ProposalCard({
  proposal: p,
  currentEpoch,
  drepVote,
  delegatedDrepId,
  hasDrepVotes,
  animationDelay,
}: ProposalCardProps) {
  const { data: nclData } = useTreasuryNcl();
  const status = p.status ?? 'Open';
  const statusLower = status.toLowerCase();
  const isOpen = statusLower === 'open';
  const isResolved = ['enacted', 'ratified', 'expired', 'dropped'].includes(statusLower);
  const theme = p.type ? getProposalTheme(p.type) : null;
  const TypeIcon = theme?.icon;
  const verdict = getVerdict(statusLower, p.triBody);
  const epochsLeft =
    isOpen && currentEpoch && p.expirationEpoch ? p.expirationEpoch - currentEpoch : null;
  const isUrgent = epochsLeft != null && epochsLeft <= 2;
  const hasTreasury = p.type === 'TreasuryWithdrawals' && p.withdrawalAmount;
  const pill = drepVote ? VOTE_PILL[drepVote] : null;
  const needsVote = !pill && isOpen && !!delegatedDrepId && hasDrepVotes;
  const ncl = nclData?.ncl;
  const showNcl = hasTreasury && ncl?.period?.nclAda;

  const href = `/proposal/${p.txHash}/${p.index}`;
  const title = p.title || `${p.txHash?.slice(0, 16)}…`;

  // ── Resolved proposals: compact card ──────────────────────────────────────

  if (isResolved) {
    return (
      <Link
        href={href}
        className="group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-muted/40 hover:border-border/70 hover:shadow-sm transition-all duration-200 animate-in fade-in fill-mode-backwards"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {TypeIcon && <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
        <span className="flex-1 text-sm text-muted-foreground/80 group-hover:text-foreground/90 truncate min-w-0 transition-colors duration-200">
          {title}
        </span>
        {hasTreasury && (
          <span className="text-[11px] tabular-nums text-muted-foreground/60 shrink-0">
            ₳{fmtAda(p.withdrawalAmount!)}
          </span>
        )}
        {showNcl && (
          <NclImpactIndicator
            currentUtilizationPct={ncl!.utilizationPct}
            proposalAmountAda={p.withdrawalAmount!}
            nclAda={ncl!.period.nclAda}
            remainingAda={ncl!.remainingAda}
            isEnacted={statusLower === 'enacted'}
            variant="compact"
          />
        )}
        {p.deliveryStatus && p.deliveryStatus !== 'unknown' && (
          <ProposalDeliveryBadge
            status={p.deliveryStatus as DeliveryStatus}
            score={p.deliveryScore}
            compact
          />
        )}
        <span
          className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0',
            verdict.color,
            verdict.bgColor,
            verdict.borderColor,
          )}
        >
          {verdict.label}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all duration-200" />
      </Link>
    );
  }

  // ── Open proposals: full card ─────────────────────────────────────────────

  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-xl border bg-card/70 backdrop-blur-md transition-all duration-200 animate-in fade-in fill-mode-backwards overflow-hidden',
        'hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30',
        isUrgent
          ? 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.06)]'
          : needsVote
            ? 'border-violet-500/30 shadow-[0_0_16px_rgba(139,92,246,0.05)]'
            : 'border-border',
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Accent gradient bar */}
      <div
        className="h-[2px]"
        style={{
          background: theme
            ? `linear-gradient(90deg, ${theme.accent} 0%, transparent 70%)`
            : 'transparent',
        }}
      />

      <div className="px-4 pt-3 pb-3.5 space-y-3">
        {/* Header: type label + urgency */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {TypeIcon && (
              <TypeIcon className="h-3.5 w-3.5 shrink-0" style={{ color: theme?.accent }} />
            )}
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              {theme?.label ?? 'Governance Action'}
            </span>
          </div>
          {isUrgent ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 shrink-0">
              <AlertTriangle className="h-3 w-3 animate-pulse" />
              {epochsLeft === 1 ? 'Last epoch!' : `${epochsLeft} epochs left`}
            </span>
          ) : epochsLeft != null && epochsLeft > 0 ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {epochsLeft} epochs left
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold text-foreground leading-snug group-hover:text-primary/90 transition-colors pr-6">
          {title}
        </h3>

        {/* Body: vote visualization + key metrics */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {/* Vote bars */}
          {p.triBody && <TriBodyVoteBars triBody={p.triBody} />}

          {/* Right column: treasury amount + verdict */}
          <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
            {hasTreasury && (
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Landmark className="h-3 w-3 text-amber-400/80" />
                  <span className="text-base font-bold tabular-nums text-amber-300">
                    ₳{fmtAda(p.withdrawalAmount!)}
                  </span>
                </div>
                {p.treasuryPct != null && (
                  <span className="text-[10px] text-muted-foreground">
                    {fmtPct(p.treasuryPct * 100)} of treasury
                  </span>
                )}
              </div>
            )}
            <span
              className={cn(
                'text-[11px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap',
                verdict.color,
                verdict.bgColor,
                verdict.borderColor,
              )}
            >
              {verdict.label}
            </span>
          </div>
        </div>

        {/* Footer: DRep vote + tags */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/30 flex-wrap">
          {pill && (
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                pill.cls,
              )}
            >
              Your DRep: {pill.label}
            </span>
          )}
          {needsVote && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border text-violet-400 bg-violet-500/10 border-violet-500/20 shrink-0">
              <CircleDot className="h-3 w-3" />
              Needs vote
            </span>
          )}
          {p.deliveryStatus && p.deliveryStatus !== 'unknown' && (
            <ProposalDeliveryBadge
              status={p.deliveryStatus as DeliveryStatus}
              score={p.deliveryScore}
              compact
            />
          )}
          {showNcl && (
            <NclImpactIndicator
              currentUtilizationPct={ncl!.utilizationPct}
              proposalAmountAda={p.withdrawalAmount!}
              nclAda={ncl!.period.nclAda}
              remainingAda={ncl!.remainingAda}
              startEpoch={ncl!.period.startEpoch}
              endEpoch={ncl!.period.endEpoch}
              isEnacted={statusLower === 'enacted'}
              variant="compact"
            />
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            {(p.relevantPrefs?.length ?? 0) > 0 &&
              p.relevantPrefs!.slice(0, 2).map((pref: string) => {
                const label = PREF_LABELS[pref];
                if (!label) return null;
                return (
                  <span
                    key={pref}
                    className="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/40"
                  >
                    {label}
                  </span>
                );
              })}
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all duration-200" />
          </div>
        </div>
      </div>
    </Link>
  );
}
