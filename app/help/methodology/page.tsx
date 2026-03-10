export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { TIERS } from '@/lib/scoring/tiers';
import { PILLAR_WEIGHTS, DECAY_HALF_LIFE_DAYS } from '@/lib/scoring/types';
import { SPO_PILLAR_WEIGHTS } from '@/lib/scoring/spoScore';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Scoring Methodology — Governada',
  description:
    'How Governada scores DReps, SPOs, and CC members. Transparent, reproducible scoring methodology for Cardano governance research.',
  openGraph: {
    title: 'Scoring Methodology — Governada',
    description: 'Transparent, reproducible scoring methodology for Cardano governance.',
    type: 'website',
  },
};

const DREP_PILLARS = [
  {
    name: 'Engagement Quality',
    weight: PILLAR_WEIGHTS.engagementQuality,
    color: 'bg-blue-500',
    description:
      'Measures the depth of governance participation through three layers: rationale provision rate (40%), AI-assessed rationale quality (40%), and deliberation signal (20%).',
    layers: ['Provision Rate (40%)', 'Rationale Quality (40%)', 'Deliberation Signal (20%)'],
  },
  {
    name: 'Effective Participation',
    weight: PILLAR_WEIGHTS.effectiveParticipation,
    color: 'bg-emerald-500',
    description: 'Evaluates voting coverage weighted by proposal importance and temporal decay.',
    layers: ['Critical (3x)', 'Important (2x)', 'Standard (1x)', 'Close-margin bonus (1.5x)'],
  },
  {
    name: 'Reliability',
    weight: PILLAR_WEIGHTS.reliability,
    color: 'bg-amber-500',
    description: 'Tracks consistency and dependability of governance engagement.',
    layers: [
      'Active Streak (30%)',
      'Recency (25%)',
      'Gap Penalty (20%)',
      'Responsiveness (15%)',
      'Tenure (10%)',
    ],
  },
  {
    name: 'Governance Identity',
    weight: PILLAR_WEIGHTS.governanceIdentity,
    color: 'bg-violet-500',
    description:
      'Rewards meaningful identity and intent information across CIP-119 metadata fields.',
    layers: ['Profile Quality (60%)', 'Community Presence (40%)'],
  },
];

const SPO_PILLARS = [
  {
    name: 'Participation',
    weight: SPO_PILLAR_WEIGHTS.participation,
    color: 'bg-blue-500',
    description: 'Importance-weighted vote coverage with temporal decay.',
    layers: [
      'Importance-weighted vote count',
      'Temporal decay (180-day half-life)',
      'Margin multiplier (1.5x)',
    ],
  },
  {
    name: 'Deliberation Quality',
    weight: SPO_PILLAR_WEIGHTS.deliberation,
    color: 'bg-emerald-500',
    description: 'Multi-signal measure of deliberation depth, including bot-detection.',
    layers: [
      'Rationale Provision (40%)',
      'Vote Timing Distribution (30%)',
      'Proposal Coverage Entropy (30%)',
    ],
  },
  {
    name: 'Reliability',
    weight: SPO_PILLAR_WEIGHTS.reliability,
    color: 'bg-amber-500',
    description:
      'Proposal-aware reliability that only penalizes inactivity during proposal-active epochs.',
    layers: [
      'Active Streak (30%)',
      'Recency (25%)',
      'Gap Penalty (15%)',
      'Engagement Consistency (15%)',
      'Tenure (15%)',
    ],
  },
  {
    name: 'Governance Identity',
    weight: SPO_PILLAR_WEIGHTS.governanceIdentity,
    color: 'bg-violet-500',
    description: 'Evaluates pool identity quality and community trust.',
    layers: ['Pool Identity Quality (60%)', 'Delegation Responsiveness (40%)'],
  },
];

const TIER_COLORS: Record<string, string> = {
  Emerging: 'text-zinc-400 border-zinc-700/30',
  Bronze: 'text-orange-400 border-orange-700/30',
  Silver: 'text-slate-300 border-slate-600/30',
  Gold: 'text-amber-400 border-amber-700/30',
  Diamond: 'text-cyan-300 border-cyan-600/30',
  Legendary: 'text-purple-400 border-purple-600/30',
};
const TIER_BG: Record<string, string> = {
  Emerging: 'bg-zinc-900/20',
  Bronze: 'bg-orange-950/20',
  Silver: 'bg-slate-900/20',
  Gold: 'bg-amber-950/20',
  Diamond: 'bg-cyan-950/20',
  Legendary: 'bg-purple-950/20',
};
const TIER_DESCRIPTIONS: Record<string, string> = {
  Emerging: 'New or inactive.',
  Bronze: 'Basic participation.',
  Silver: 'Consistent engagement.',
  Gold: 'Strong and sustained.',
  Diamond: 'Elite governance performance.',
  Legendary: 'Exceptional — very few reach this tier.',
};

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            How Governada Scores Work
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Governada measures governance quality for DReps, Stake Pool Operators, and
            Constitutional Committee members on the Cardano network. Every score is computed from
            on-chain data, percentile-normalized across all active entities, and decayed over time
            to reflect current behavior.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Scoring Philosophy</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Percentile normalization.</strong> Raw scores are
              converted to percentiles across all entities, preventing gaming through volume.
            </p>
            <p>
              <strong className="text-foreground">Temporal decay.</strong> Activity decays with a{' '}
              {DECAY_HALF_LIFE_DAYS}-day half-life. Governance is an ongoing commitment.
            </p>
            <p>
              <strong className="text-foreground">Importance weighting.</strong> Hard forks carry
              3x, parameter changes 2x, close-margin proposals 1.5x bonus.
            </p>
            <p>
              <strong className="text-foreground">Confidence gating.</strong> DReps with &lt;5 votes
              are capped at Emerging, 5-9 at Bronze, 10-14 at Silver.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-bold">DRep Score V3</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <code className="block text-xs text-muted-foreground font-mono">
              Score = (Engagement Quality x 0.35) + (Effective Participation x 0.25) + (Reliability
              x 0.25) + (Governance Identity x 0.15)
            </code>
          </div>
          <div className="space-y-4">
            {DREP_PILLARS.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-3 w-3 rounded-full', p.color)} />
                    <p className="text-sm font-bold">{p.name}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {Math.round(p.weight * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', p.color)}
                    style={{ width: `${p.weight * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                <ul className="space-y-1">
                  {p.layers.map((l) => (
                    <li
                      key={l}
                      className="text-[11px] text-muted-foreground pl-3 border-l-2 border-border"
                    >
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Tier System</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={cn(
                  'rounded-xl border p-4 space-y-1',
                  TIER_COLORS[t.name],
                  TIER_BG[t.name],
                )}
              >
                <p className={cn('text-sm font-bold', TIER_COLORS[t.name]?.split(' ')[0])}>
                  {t.name}
                </p>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {t.min}&ndash;{t.max}
                </p>
                <p className="text-[11px] text-muted-foreground">{TIER_DESCRIPTIONS[t.name]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-bold">SPO Governance Score V3</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <code className="block text-xs text-muted-foreground font-mono">
              Score = (Participation x 0.35) + (Deliberation Quality x 0.25) + (Reliability x 0.25)
              + (Governance Identity x 0.15)
            </code>
          </div>
          <div className="space-y-4">
            {SPO_PILLARS.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-3 w-3 rounded-full', p.color)} />
                    <p className="text-sm font-bold">{p.name}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {Math.round(p.weight * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', p.color)}
                    style={{ width: `${p.weight * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                <ul className="space-y-1">
                  {p.layers.map((l) => (
                    <li
                      key={l}
                      className="text-[11px] text-muted-foreground pl-3 border-l-2 border-border"
                    >
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Full methodology details at{' '}
            <a
              href="https://github.com/governada"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/governada
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
