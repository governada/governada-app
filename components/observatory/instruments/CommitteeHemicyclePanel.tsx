'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ExternalLink, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { usePeekTrigger } from '@/components/governada/peeks/PeekDrawerProvider';
import {
  useCommitteeMembers,
  type CommitteeMemberQuickView,
  type CCArchetype,
} from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommitteeHemicyclePanelProps {
  expanded?: boolean;
  position: number; // 0–1 playback position
  isLive: boolean;
  /** AI-generated Seneca narrative for the committee drilldown */
  narrative?: string | null;
}

interface SeatPosition {
  x: number;
  y: number;
  angle: number;
}

// ---------------------------------------------------------------------------
// Grade colour mapping
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<string, { fill: string; stroke: string; tw: string }> = {
  A: { fill: 'rgba(16,185,129,0.20)', stroke: 'rgb(16,185,129)', tw: 'text-emerald-500' },
  B: { fill: 'rgba(14,165,233,0.20)', stroke: 'rgb(14,165,233)', tw: 'text-sky-500' },
  C: { fill: 'rgba(245,158,11,0.20)', stroke: 'rgb(245,158,11)', tw: 'text-amber-500' },
  D: { fill: 'rgba(249,115,22,0.20)', stroke: 'rgb(249,115,22)', tw: 'text-orange-500' },
  F: { fill: 'rgba(244,63,94,0.20)', stroke: 'rgb(244,63,94)', tw: 'text-rose-500' },
};

const DEFAULT_GRADE_COLOR = {
  fill: 'rgba(148,163,184,0.20)',
  stroke: 'rgb(148,163,184)',
  tw: 'text-slate-400',
};

function gradeColor(grade: string | null) {
  if (!grade) return DEFAULT_GRADE_COLOR;
  const key = grade.charAt(0).toUpperCase();
  return GRADE_COLORS[key] ?? DEFAULT_GRADE_COLOR;
}

// ---------------------------------------------------------------------------
// Archetype colour (subtle glow)
// ---------------------------------------------------------------------------

const ARCHETYPE_GLOW: Record<string, string> = {
  Guardian: 'rgba(16,185,129,0.35)',
  Reformer: 'rgba(139,92,246,0.35)',
  Pragmatist: 'rgba(14,165,233,0.35)',
  Dissenter: 'rgba(244,63,94,0.35)',
};

function archetypeGlow(label: string | undefined): string {
  if (!label) return 'rgba(148,163,184,0.15)';
  for (const [key, glow] of Object.entries(ARCHETYPE_GLOW)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return glow;
  }
  return 'rgba(148,163,184,0.15)';
}

// ---------------------------------------------------------------------------
// Arc math
// ---------------------------------------------------------------------------

function computeSeatPositions(
  count: number,
  cx: number,
  cy: number,
  radius: number,
): SeatPosition[] {
  if (count <= 0) return [];
  if (count === 1) {
    // Single seat at the top of the arc
    return [{ x: cx, y: cy - radius, angle: Math.PI / 2 }];
  }
  const positions: SeatPosition[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.PI - (i * Math.PI) / (count - 1); // π → 0, left to right
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
      angle,
    });
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Seat initial
// ---------------------------------------------------------------------------

function memberInitial(name: string | null, hotId?: string): string {
  if (name) {
    const trimmed = name.trim();
    if (trimmed.length > 0) return trimmed.charAt(0).toUpperCase();
  }
  // Fallback: first char of hot ID hash for visual distinction
  if (hotId && hotId.length > 5) {
    return hotId.slice(5, 6).toUpperCase();
  }
  return '?';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommitteeHemicyclePanel({
  expanded = false,
  position,
  isLive,
  narrative,
}: CommitteeHemicyclePanelProps) {
  const { data, isLoading, isError } = useCommitteeMembers();
  const openPeek = usePeekTrigger();
  const [tooltip, setTooltip] = useState<{
    member: CommitteeMemberQuickView;
    archetype: CCArchetype | undefined;
    x: number;
    y: number;
  } | null>(null);

  // Derive archetype lookup
  const archetypes = data?.archetypes;
  const archetypeMap = useMemo<Map<string, CCArchetype>>(() => {
    if (!archetypes) return new Map();
    return new Map(archetypes.map((a) => [a.ccHotId, a]));
  }, [archetypes]);

  // Build member-index lookup for agreement lines
  const rawMembers = data?.members;
  const memberIndexMap = useMemo<Map<string, number>>(() => {
    if (!rawMembers) return new Map();
    return new Map(rawMembers.map((m, i) => [m.ccHotId, i]));
  }, [rawMembers]);

  // SVG dimensions — ensure enough room for bottom seats (radius + glow + margin)
  const seatRadius = expanded ? 20 : 14;
  const arcRadius = expanded ? 120 : 80;
  const svgWidth = expanded ? 320 : 220;
  const bottomMargin = seatRadius + 8; // seat radius + glow ring + padding
  const svgHeight = expanded ? 200 : 140;
  const cx = svgWidth / 2;
  const cy = svgHeight - bottomMargin; // arc center positioned to fit all seats

  const members = data?.members ?? [];
  const health = data?.health;
  const agreements = data?.agreementMatrix ?? [];

  const seats = useMemo(
    () => computeSeatPositions(members.length, cx, cy, arcRadius),
    [members.length, cx, cy, arcRadius],
  );

  // How many seats are visible at the current playback position
  const visibleCount = isLive ? members.length : Math.max(1, Math.round(position * members.length));

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <Skeleton className="h-[120px] w-[220px] rounded-xl" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  // ---- Error state ----
  if (isError || !data) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        Committee data unavailable
      </div>
    );
  }

  // ---- Filter agreements for visible members ----
  const visibleIds = new Set(members.slice(0, visibleCount).map((m) => m.ccHotId));

  const agreementLines = agreements.filter(
    (a) =>
      visibleIds.has(a.memberA) &&
      visibleIds.has(a.memberB) &&
      (a.voteAgreementPct > 75 || a.voteAgreementPct < 40),
  );

  return (
    <div className={cn('relative flex flex-col items-center', expanded ? 'gap-4' : 'gap-2')}>
      {/* Hemicycle SVG */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={cn('w-full max-w-xs', expanded && 'max-w-sm')}
        role="img"
        aria-label="Committee hemicycle showing member seats arranged in a semicircle"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Agreement / tension lines (rendered beneath seats) */}
        {agreementLines.map((a, idx) => {
          const idxA = memberIndexMap.get(a.memberA);
          const idxB = memberIndexMap.get(a.memberB);
          if (idxA === undefined || idxB === undefined) return null;
          if (idxA >= visibleCount || idxB >= visibleCount) return null;

          const posA = seats[idxA];
          const posB = seats[idxB];
          if (!posA || !posB) return null;

          const isAgreement = a.voteAgreementPct > 75;
          const strokeWidth = isAgreement
            ? 1 + ((a.voteAgreementPct - 75) / 25) * 2 // 1–3px for 75–100%
            : 1;

          return (
            <motion.line
              key={`line-${a.memberA}-${a.memberB}-${idx}`}
              x1={posA.x}
              y1={posA.y}
              x2={posB.x}
              y2={posB.y}
              stroke={
                isAgreement ? 'rgba(var(--primary-rgb, 99,102,241), 0.30)' : 'rgba(244,63,94,0.40)'
              }
              strokeWidth={strokeWidth}
              strokeDasharray={isAgreement ? undefined : '4 3'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: visibleCount * 0.08 + 0.2, duration: 0.4 }}
            />
          );
        })}

        {/* Seats */}
        {members.slice(0, visibleCount).map((member, i) => (
          <HemicycleSeat
            key={member.ccHotId}
            member={member}
            position={seats[i]}
            radius={seatRadius}
            index={i}
            archetype={archetypeMap.get(member.ccHotId)}
            expanded={expanded}
            onPeek={
              expanded && openPeek ? () => openPeek({ type: 'cc', id: member.ccHotId }) : undefined
            }
            onHover={(member, archetype, x, y) => setTooltip({ member, archetype, x, y })}
            onHoverEnd={() => setTooltip(null)}
          />
        ))}
      </svg>

      {/* Seat tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-border/40 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs space-y-1"
          style={{
            // Position relative to the SVG container; offset slightly above cursor
            left: `${tooltip.x}%`,
            top: `${tooltip.y}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <p className="font-semibold">
            {tooltip.member.name ??
              `${tooltip.member.ccHotId.slice(0, 8)}…${tooltip.member.ccHotId.slice(-4)}`}
          </p>
          {tooltip.archetype && <p className="text-muted-foreground">{tooltip.archetype.label}</p>}
          {tooltip.member.fidelityGrade && (
            <p>
              Fidelity:{' '}
              <span className={cn('font-bold', gradeColor(tooltip.member.fidelityGrade).tw)}>
                {tooltip.member.fidelityGrade}
              </span>
              {tooltip.member.voteCount > 0 && (
                <span className="text-muted-foreground ml-1">
                  — voted constitutional {tooltip.member.yesCount}/{tooltip.member.voteCount} times
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Status line */}
      <p className="text-xs text-muted-foreground text-center leading-tight px-2">
        <StatusBadge status={health?.status} />
        {' — '}
        {health?.activeMembers ?? members.length} active
        {health?.avgFidelity != null && `, avg fidelity ${Math.round(health.avgFidelity)}%`}
      </p>

      {/* Seneca narrative */}
      {expanded && narrative && (
        <div className="w-full mb-2 flex items-start gap-2 rounded-lg bg-muted/20 px-4 py-3">
          <ScrollText className="h-3.5 w-3.5 shrink-0 text-primary/40 mt-0.5" />
          <p className="text-sm italic leading-relaxed text-muted-foreground">{narrative}</p>
        </div>
      )}

      {/* Expanded: fidelity breakdown, bloc summary, briefing excerpt, profile CTA */}
      {expanded && members.length > 0 && (
        <div className="w-full space-y-2 pt-2 border-t border-border/20">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Fidelity Breakdown
          </p>
          {members.map((m) => (
            <div key={m.ccHotId} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate mr-2 max-w-[60%]">
                {m.name ?? `${m.ccHotId.slice(0, 8)}…`}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {m.voteCount > 0 ? (
                  <>
                    <span className={cn('font-semibold', gradeColor(m.fidelityGrade).tw)}>
                      {m.fidelityGrade ?? '—'}
                    </span>
                    <span className="ml-1 text-[10px]">
                      {m.yesCount}/{m.voteCount} constitutional
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground/50">No votes</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {expanded && data?.blocs && data.blocs.length > 0 && (
        <div className="w-full space-y-2 pt-2 border-t border-border/20">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Voting Blocs
          </p>
          {data.blocs.map((bloc) => (
            <div key={bloc.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{bloc.label}</span>
              <span className="font-medium tabular-nums">
                {bloc.members.length} members · {Math.round(bloc.internalAgreementPct)}% agreement
              </span>
            </div>
          ))}
        </div>
      )}
      {expanded && data?.briefing?.headline && (
        <div className="w-full pt-2 border-t border-border/20">
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            {data.briefing.headline}
          </p>
        </div>
      )}
      {/* Open full committee profile */}
      {expanded && (
        <Link
          href="/governance/committee"
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg',
            'text-xs font-medium transition-colors',
            'bg-primary/10 text-primary hover:bg-primary/20',
          )}
        >
          Open full Chamber profile
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface HemicycleSeatProps {
  member: CommitteeMemberQuickView;
  position: SeatPosition | undefined;
  radius: number;
  index: number;
  archetype?: CCArchetype;
  expanded: boolean;
  onPeek?: () => void;
  onHover?: (
    member: CommitteeMemberQuickView,
    archetype: CCArchetype | undefined,
    x: number,
    y: number,
  ) => void;
  onHoverEnd?: () => void;
}

function HemicycleSeat({
  member,
  position,
  radius,
  index,
  archetype,
  expanded,
  onPeek,
  onHover,
  onHoverEnd,
}: HemicycleSeatProps) {
  if (!position) return null;

  const grade = gradeColor(member.fidelityGrade);
  const glow = archetypeGlow(archetype?.label);
  const initial = memberInitial(member.name, member.ccHotId);
  const fontSize = expanded ? 14 : 10;

  const seatContent = (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: index * 0.08,
        type: 'spring',
        stiffness: 400,
        damping: 22,
      }}
      style={{ transformOrigin: `${position.x}px ${position.y}px` }}
    >
      {/* Archetype glow */}
      <circle
        cx={position.x}
        cy={position.y}
        r={radius + 4}
        fill="none"
        stroke={glow}
        strokeWidth={2}
        opacity={0.6}
      />

      {/* Seat circle */}
      <circle
        cx={position.x}
        cy={position.y}
        r={radius}
        fill={grade.fill}
        stroke={grade.stroke}
        strokeWidth={1.5}
      />

      {/* Member initial */}
      <text
        x={position.x}
        y={position.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={grade.stroke}
        fontSize={fontSize}
        fontWeight={600}
        className="select-none pointer-events-none"
      >
        {initial}
      </text>
    </motion.g>
  );

  // SVG viewBox dimensions (must match parent)
  const svgW = expanded ? 320 : 220;
  const svgH = expanded ? 200 : 140;
  const tooltipXPct = (position.x / svgW) * 100;
  const tooltipYPct = (position.y / svgH) * 100;

  const hoverHandlers = onHover
    ? {
        onMouseEnter: () => onHover(member, archetype, tooltipXPct, tooltipYPct),
        onMouseLeave: onHoverEnd,
      }
    : {};

  if (onPeek) {
    return (
      <g
        role="button"
        tabIndex={0}
        className="cursor-pointer outline-none"
        onClick={onPeek}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPeek();
          }
        }}
        aria-label={`View ${member.name ?? 'committee member'} details`}
        {...hoverHandlers}
      >
        {seatContent}
        {/* Hover ring for interactive seats */}
        <circle
          cx={position.x}
          cy={position.y}
          r={radius + 2}
          fill="transparent"
          stroke="transparent"
          strokeWidth={2}
          className="transition-colors hover:stroke-primary/40"
        />
      </g>
    );
  }

  return (
    <g {...hoverHandlers} className={onHover ? 'cursor-default' : undefined}>
      {seatContent}
    </g>
  );
}

function StatusBadge({ status }: { status?: 'healthy' | 'attention' | 'critical' }) {
  const label = status ?? 'unknown';
  const colorClass =
    status === 'healthy'
      ? 'text-emerald-400'
      : status === 'attention'
        ? 'text-amber-400'
        : status === 'critical'
          ? 'text-rose-400'
          : 'text-slate-400';

  return <span className={cn('font-medium capitalize', colorClass)}>{label}</span>;
}
