'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface MobileConstellationViewProps {
  userNode: ConstellationNode3D | null;
  proposalNodes: ConstellationNode3D[];
  delegationBond: { drepNodeId: string; driftScore: number } | null;
  participation: number;
  deliberation: number;
  impact: number;
}

const RING_COLORS = {
  participation: '#2dd4bf',
  deliberation: '#a78bfa',
  impact: '#f59e0b',
};

/**
 * MobileConstellationView — 2D radial "gravitational field" fallback for mobile.
 *
 * User's governance rings at center. Governance entities orbit at distances
 * proportional to their relevance/urgency. Closest = most urgent.
 *
 * This is the mobile-optimized version of the Inhabited Constellation.
 */
export function MobileConstellationView({
  userNode,
  proposalNodes,
  delegationBond,
  participation,
  deliberation,
  impact,
}: MobileConstellationViewProps) {
  const centerX = 187.5; // half of 375px mobile viewport
  const centerY = 200;
  const maxRadius = 160;

  // Sort proposals by urgency (closest = most urgent)
  const sortedProposals = useMemo(
    () =>
      [...proposalNodes]
        .sort((a, b) => b.score - a.score) // higher score = more urgent
        .slice(0, 8), // max 8 on mobile
    [proposalNodes],
  );

  return (
    <div className="relative w-full min-h-[100dvh] bg-background overflow-hidden">
      <svg
        viewBox="0 0 375 400"
        className="w-full max-w-[375px] mx-auto"
        style={{ height: '400px' }}
      >
        {/* Ambient orbit rings */}
        {[0.3, 0.5, 0.7, 0.9].map((r, i) => (
          <circle
            key={i}
            cx={centerX}
            cy={centerY}
            r={maxRadius * r}
            fill="none"
            stroke="rgba(45, 212, 191, 0.06)"
            strokeWidth={0.5}
          />
        ))}

        {/* Delegation bond line */}
        {delegationBond && (
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX + maxRadius * 0.35}
            y2={centerY - maxRadius * 0.2}
            stroke={
              delegationBond.driftScore < 15
                ? '#2dd4bf'
                : delegationBond.driftScore < 40
                  ? '#f59e0b'
                  : '#ef4444'
            }
            strokeWidth={1.5}
            strokeOpacity={0.6}
            strokeDasharray="4 3"
          />
        )}

        {/* Delegated DRep dot */}
        {delegationBond && (
          <circle
            cx={centerX + maxRadius * 0.35}
            cy={centerY - maxRadius * 0.2}
            r={6}
            fill="#2dd4bf"
            opacity={0.8}
          />
        )}

        {/* Proposal dots */}
        {sortedProposals.map((proposal, i) => {
          const angle = (i / sortedProposals.length) * Math.PI * 2 - Math.PI / 2;
          const urgency = proposal.score / 100;
          const distance = maxRadius * (0.4 + (1 - urgency) * 0.5); // urgent = closer
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance;

          return (
            <g key={proposal.id}>
              {/* Diamond shape for proposals */}
              <polygon
                points={`${x},${y - 5} ${x + 4},${y} ${x},${y + 5} ${x - 4},${y}`}
                fill="#e8dfd0"
                opacity={0.4 + urgency * 0.6}
              />
            </g>
          );
        })}

        {/* User governance rings at center */}
        {[
          { score: participation, color: RING_COLORS.participation, r: 28 },
          { score: deliberation, color: RING_COLORS.deliberation, r: 35 },
          { score: impact, color: RING_COLORS.impact, r: 42 },
        ].map((ring, i) => {
          const circumference = 2 * Math.PI * ring.r;
          const dashLength = (ring.score / 100) * circumference;

          return (
            <circle
              key={i}
              cx={centerX}
              cy={centerY}
              r={ring.r}
              fill="none"
              stroke={ring.color}
              strokeWidth={3}
              strokeDasharray={`${dashLength} ${circumference}`}
              strokeDashoffset={circumference * 0.25} // start from top
              strokeLinecap="round"
              opacity={0.7}
              transform={`rotate(-90 ${centerX} ${centerY})`}
            />
          );
        })}

        {/* Center pulse dot */}
        <circle cx={centerX} cy={centerY} r={8} fill="#f0e6d0" opacity={0.9} />
        <circle cx={centerX} cy={centerY} r={4} fill="#f0e6d0" />
      </svg>

      {/* Governance pulse label */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute left-1/2 -translate-x-1/2 text-center"
        style={{ top: centerY + 60 }}
      >
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Your Governance Field
        </p>
      </motion.div>
    </div>
  );
}
