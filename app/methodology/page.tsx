export const dynamic = 'force-dynamic';

import { TIERS } from '@/lib/scoring/tiers';
import { PILLAR_WEIGHTS, DECAY_HALF_LIFE_DAYS } from '@/lib/scoring/types';
import { cn } from '@/lib/utils';

const DREP_PILLARS = [
  {
    name: 'Engagement Quality',
    weight: PILLAR_WEIGHTS.engagementQuality,
    color: 'bg-blue-500',
    description:
      'Measures the depth of governance participation — rationale provision, AI-assessed rationale quality, and deliberation patterns (vote diversity, dissent, proposal breadth).',
    layers: ['Provision Rate (40%)', 'Rationale Quality (40%)', 'Deliberation Signal (20%)'],
  },
  {
    name: 'Effective Participation',
    weight: PILLAR_WEIGHTS.effectiveParticipation,
    color: 'bg-emerald-500',
    description:
      'Evaluates voting activity weighted by proposal importance. Treasury and constitutional proposals count more than parameter changes. Temporal decay reduces weight of older votes.',
    layers: ['Importance-weighted vote count', 'Proposal-type multipliers', 'Temporal decay'],
  },
  {
    name: 'Reliability',
    weight: PILLAR_WEIGHTS.reliability,
    color: 'bg-amber-500',
    description:
      'Tracks consistency of governance participation — voting streaks, regularity, and sustained engagement over time.',
    layers: ['Voting streak length', 'Participation consistency', 'Temporal reliability'],
  },
  {
    name: 'Governance Identity',
    weight: PILLAR_WEIGHTS.governanceIdentity,
    color: 'bg-violet-500',
    description:
      'Rewards governance infrastructure: complete profile metadata, verified hashes, social links, and active delegation presence.',
    layers: ['Metadata completeness', 'URI verification', 'Social link presence'],
  },
];

const GHI_COMPONENTS = [
  { name: 'DRep Participation', weight: 20, description: 'Active DRep voting rates' },
  { name: 'Citizen Engagement', weight: 15, description: 'Delegator activity and poll voting' },
  {
    name: 'Deliberation Quality',
    weight: 20,
    description: 'Rationale provision and discourse depth',
  },
  {
    name: 'Governance Effectiveness',
    weight: 20,
    description: 'Proposal throughput and ratification',
  },
  {
    name: 'Power Distribution',
    weight: 15,
    description: 'Nakamoto coefficient and delegation spread',
  },
  {
    name: 'System Stability',
    weight: 10,
    description: 'Infrastructure health and constitutional compliance',
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

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">Scoring Methodology</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            How Civica measures governance quality for DReps, SPOs, and the Cardano network.
            Transparent, reproducible, and continuously refined.
          </p>
        </div>

        {/* V3 Score Model */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">DRep Score V3</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every DRep receives a composite score from 0-100, computed from four weighted pillars.
            Each pillar is percentile-normalized across all active DReps, ensuring the score
            reflects relative standing, not just raw metrics. Older activity decays over a{' '}
            {DECAY_HALF_LIFE_DAYS}-day half-life, keeping scores responsive to recent behavior.
          </p>

          {/* Pillar bars */}
          <div className="space-y-4">
            {DREP_PILLARS.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-card p-4 space-y-2.5">
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
                <div className="flex flex-wrap gap-1.5">
                  {p.layers.map((l) => (
                    <span
                      key={l}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tier System */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Tier System</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Scores map to six tiers that create emotional weight and competitive pressure.
            Low-confidence entities (insufficient data) are capped at Emerging regardless of score.
          </p>
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
                  {t.min}–{t.max}
                </p>
                <p className="text-[11px] text-muted-foreground">{t.max - t.min + 1} point range</p>
              </div>
            ))}
          </div>
        </section>

        {/* GHI */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Governance Health Index (GHI)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The GHI measures the health of Cardano governance as a whole — not individual entities.
            It combines six components into a single 0-100 score, tracked epoch-by-epoch.
          </p>
          <div className="space-y-2">
            {GHI_COMPONENTS.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {c.weight}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-primary">
              GHI bands: <strong>Thriving</strong> (80+), <strong>Healthy</strong> (60-79),{' '}
              <strong>Developing</strong> (40-59), <strong>At Risk</strong> (20-39),{' '}
              <strong>Critical</strong> (&lt;20)
            </p>
          </div>
        </section>

        {/* Alignment */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">6D Alignment Model</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Civica maps every DRep and SPO onto six governance dimensions derived from voting
            patterns via PCA (Principal Component Analysis). Values range from 0-100 (50 = neutral).
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Treasury Conservative',
                desc: 'Preference for fiscal restraint',
              },
              {
                name: 'Treasury Growth',
                desc: 'Preference for ecosystem investment',
              },
              {
                name: 'Decentralization',
                desc: 'Priority on distributing power',
              },
              { name: 'Security', desc: 'Priority on protocol safety' },
              { name: 'Innovation', desc: 'Openness to protocol evolution' },
              {
                name: 'Transparency',
                desc: 'Emphasis on governance accountability',
              },
            ].map((d) => (
              <div
                key={d.name}
                className="rounded-lg border border-border bg-card px-4 py-3 space-y-0.5"
              >
                <p className="text-sm font-medium">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Principles */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Scoring Principles</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Percentile normalization.</strong> Raw pillar
              scores are converted to percentiles across all entities. This prevents gaming through
              volume and ensures scores reflect relative standing.
            </p>
            <p>
              <strong className="text-foreground">Temporal decay.</strong> Older governance activity
              decays exponentially ({DECAY_HALF_LIFE_DAYS}-day half-life). A DRep who was active a
              year ago but silent now will see their score decline.
            </p>
            <p>
              <strong className="text-foreground">Importance weighting.</strong> Not all proposals
              are equal. Treasury withdrawals and constitutional changes carry higher weights than
              parameter updates.
            </p>
            <p>
              <strong className="text-foreground">Confidence gating.</strong> Entities with
              insufficient data are capped at Emerging tier, preventing new DReps from immediately
              claiming high tiers.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Scoring models are open, reproducible, and continuously refined. Questions?{' '}
            <a
              href="https://github.com/drepscore"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join the discussion on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
