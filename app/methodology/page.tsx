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
    description:
      'How Governada scores DReps, SPOs, and CC members. Transparent, reproducible scoring methodology for Cardano governance research.',
    type: 'website',
  },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DREP_PILLARS = [
  {
    name: 'Engagement Quality',
    weight: PILLAR_WEIGHTS.engagementQuality,
    color: 'bg-blue-500',
    description:
      'Measures the depth of governance participation through three layers: rationale provision rate (40%), AI-assessed rationale quality (40%), and deliberation signal (20%) which captures vote diversity, dissent rate, and proposal type breadth.',
    layers: [
      'Provision Rate (40%) — importance-weighted % of votes with rationale',
      'Rationale Quality (40%) — AI-scored reasoning quality, weighted by importance and recency',
      'Deliberation Signal (20%) — vote diversity (40%), dissent rate (35%), type breadth (25%)',
    ],
  },
  {
    name: 'Effective Participation',
    weight: PILLAR_WEIGHTS.effectiveParticipation,
    color: 'bg-emerald-500',
    description:
      'Evaluates voting coverage weighted by proposal importance and temporal decay. Close-margin proposals (decided by <20% margin) receive a 1.5x bonus, rewarding participation on contentious decisions.',
    layers: [
      'Critical (3x) — hard forks, no confidence, committee changes, constitution updates',
      'Important (2x) — parameter changes, significant treasury withdrawals',
      'Standard (1x) — routine treasury withdrawals, info actions',
      'Close-margin bonus — 1.5x for proposals decided by <20% margin',
    ],
  },
  {
    name: 'Reliability',
    weight: PILLAR_WEIGHTS.reliability,
    color: 'bg-amber-500',
    description:
      'Tracks consistency and dependability of governance engagement across five sub-components, only counting epochs where proposals existed.',
    layers: [
      'Active Streak (30%) — consecutive proposal-active epochs with votes',
      'Recency (25%) — exponential decay since last vote',
      'Gap Penalty (20%) — penalizes longest inactivity stretch',
      'Responsiveness (15%) — median days from proposal submission to vote',
      'Tenure (10%) — time since first vote, logarithmic curve',
    ],
  },
  {
    name: 'Governance Identity',
    weight: PILLAR_WEIGHTS.governanceIdentity,
    color: 'bg-violet-500',
    description:
      "Rewards DReps who provide meaningful identity and intent information. Quality-tiered field scoring (not binary has/hasn't) across CIP-119 metadata fields, plus community trust signals.",
    layers: [
      'Profile Quality (60%) — name, objectives, motivations, qualifications, bio, social links, hash verification',
      'Community Presence (40%) — delegator count percentile (count-based, not ADA-based)',
    ],
  },
];

const SPO_PILLARS = [
  {
    name: 'Participation',
    weight: SPO_PILLAR_WEIGHTS.participation,
    color: 'bg-blue-500',
    description:
      'Importance-weighted vote coverage with temporal decay. Close-margin bonus is applied at the proposal level (not per-SPO) to ensure fair weighting across all pools.',
    layers: [
      'Importance-weighted vote count',
      'Temporal decay (180-day half-life)',
      'Proposal-level margin multiplier (1.5x for contentious votes)',
    ],
  },
  {
    name: 'Deliberation Quality',
    weight: SPO_PILLAR_WEIGHTS.deliberation,
    color: 'bg-emerald-500',
    description:
      'Replaces the V2 consistency metric with a multi-signal measure of deliberation depth, including bot-detection via vote timing analysis.',
    layers: [
      'Rationale Provision (40%) — importance-weighted % with rationale',
      'Vote Timing Distribution (30%) — stddev of time-to-vote (natural variation scores highest)',
      'Proposal Coverage Entropy (30%) — Shannon entropy across proposal types',
    ],
  },
  {
    name: 'Reliability',
    weight: SPO_PILLAR_WEIGHTS.reliability,
    color: 'bg-amber-500',
    description:
      'Proposal-aware reliability that only penalizes inactivity during epochs with active proposals. Includes engagement consistency (steady > bursty).',
    layers: [
      'Active Streak (30%) — consecutive proposal-active epochs with votes',
      'Recency (25%) — exponential decay since last vote',
      'Gap Penalty (15%) — longest gap in proposal-active epochs',
      'Engagement Consistency (15%) — coefficient of variation of votes per epoch',
      'Tenure (15%) — time since first vote, asymptotic curve',
    ],
  },
  {
    name: 'Governance Identity',
    weight: SPO_PILLAR_WEIGHTS.governanceIdentity,
    color: 'bg-violet-500',
    description:
      'Evaluates pool identity quality and community trust. Governance statements are scored via a keyword quality checklist rather than pure character count.',
    layers: [
      'Pool Identity Quality (60%) — ticker, name, governance statement (keyword checklist), description, homepage, social links, hash verification',
      'Delegation Responsiveness (40%) — delegator retention after governance activity (falls back to count percentile)',
    ],
  },
];

const CC_PILLARS = [
  {
    name: 'Participation',
    weight: 35,
    description:
      'Vote rate on governance actions. Non-participation is the most basic accountability failure.',
  },
  {
    name: 'Rationale Quality',
    weight: 30,
    description:
      'Composite of rationale provision rate (30%), constitutional article coverage (35%), and reasoning depth (35%). Rewards thorough constitutional reasoning.',
  },
  {
    name: 'Responsiveness',
    weight: 15,
    description:
      'Average time from proposal submission to CC vote. Faster deliberation scores higher via exponential decay.',
  },
  {
    name: 'Independence',
    weight: 10,
    description:
      'CC-bloc independence (60%) measures dissent from CC majority (5-25% dissent = ideal). DRep alignment independence (40%) peaks at moderate alignment.',
  },
  {
    name: 'Community Engagement',
    weight: 10,
    description:
      'Citizen question responses and endorsement count. Rewards CC members who engage beyond their constitutional duties.',
  },
];

const GHI_COMPONENTS = [
  {
    name: 'DRep Participation',
    weight: 20,
    category: 'Engagement',
    description: 'Median effective participation score across all active DReps.',
  },
  {
    name: 'Citizen Engagement',
    weight: 15,
    category: 'Engagement',
    description: 'Delegation rate (62.5%) and delegation dynamism/churn (37.5%).',
  },
  {
    name: 'Deliberation Quality',
    weight: 20,
    category: 'Quality',
    description: 'Rationale quality (50%), debate diversity (30%), and voting independence (20%).',
  },
  {
    name: 'Governance Effectiveness',
    weight: 20,
    category: 'Quality',
    description: 'Proposal resolution rate (40%), decision velocity (30%), and throughput (30%).',
  },
  {
    name: 'Power Distribution',
    weight: 15,
    category: 'Resilience',
    description:
      'Edinburgh Decentralization Index composite (Nakamoto, Gini, Shannon entropy, HHI, Theil, concentration, tau) plus new DRep onboarding rate.',
  },
  {
    name: 'System Stability',
    weight: 10,
    category: 'Resilience',
    description: 'DRep retention (50%), score volatility (30%), and infrastructure health (20%).',
  },
];

const ALIGNMENT_DIMENSIONS = [
  {
    name: 'Treasury Conservative',
    color: '#dc2626',
    description:
      'Preference for fiscal restraint. "No" votes on treasury proposals signal conservatism.',
  },
  {
    name: 'Treasury Growth',
    color: '#10b981',
    description:
      'Preference for ecosystem investment. "Yes" votes on treasury proposals with quality rationale score highest.',
  },
  {
    name: 'Decentralization',
    color: '#a855f7',
    description:
      'Priority on distributing power. Factors in DRep size tier and voting breadth across proposal types.',
  },
  {
    name: 'Security',
    color: '#f59e0b',
    description:
      'Priority on protocol safety. Measures caution rate on security-relevant proposals and rationale depth.',
  },
  {
    name: 'Innovation',
    color: '#06b6d4',
    description:
      'Openness to protocol evolution. Support for innovation proposals (40%), InfoAction engagement (30%), and voting breadth (30%).',
  },
  {
    name: 'Transparency',
    color: '#3b82f6',
    description:
      'Emphasis on governance accountability. AI rationale quality (60%), provision rate (20%), and metadata completeness (20%).',
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
  Emerging: 'New or inactive. Insufficient data to rank higher.',
  Bronze: 'Basic participation. Starting to engage with governance.',
  Silver: 'Consistent engagement. Reliable governance contributor.',
  Gold: 'Strong and sustained. Quality participation across pillars.',
  Diamond: 'Elite governance performance across all dimensions.',
  Legendary: 'Exceptional — by definition, very few entities reach this tier.',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-20" />;
}

function TableOfContents() {
  const sections = [
    { id: 'philosophy', label: 'Philosophy' },
    { id: 'drep-scoring', label: 'DRep Scoring' },
    { id: 'tiers', label: 'Tier System' },
    { id: 'spo-scoring', label: 'SPO Governance Scoring' },
    { id: 'cc-transparency', label: 'CC Transparency Index' },
    { id: 'alignment', label: 'Alignment Dimensions' },
    { id: 'ghi', label: 'Governance Health Index' },
    { id: 'data-sources', label: 'Data Sources' },
    { id: 'citation', label: 'Citation Guide' },
  ];

  return (
    <nav className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        On this page
      </p>
      <ul className="space-y-1.5">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            How Governada Scores Work
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Governada measures governance quality for DReps, Stake Pool Operators, and
            Constitutional Committee members on the Cardano network. Every score is computed from
            on-chain data, percentile-normalized across all active entities, and decayed over time
            to reflect current behavior. Scores measure process and engagement, not political
            positions.
          </p>
          <TableOfContents />
        </div>

        {/* Philosophy */}
        <section className="space-y-4">
          <SectionAnchor id="philosophy" />
          <h2 className="text-xl font-bold">Scoring Philosophy</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Percentile normalization.</strong> Raw pillar
              scores are converted to percentiles across all entities. This prevents gaming through
              volume and ensures scores reflect relative standing, not just raw metrics.
              Confidence-weighted normalization dampens low-data entities toward the median,
              preventing new DReps from inflating rankings.
            </p>
            <p>
              <strong className="text-foreground">Temporal decay.</strong> Older governance activity
              decays exponentially with a {DECAY_HALF_LIFE_DAYS}-day half-life. A DRep who was
              active six months ago but silent now will see their score decline — governance is an
              ongoing commitment.
            </p>
            <p>
              <strong className="text-foreground">Importance weighting.</strong> Not all proposals
              are equal. Hard forks and constitutional changes carry 3x weight. Treasury withdrawals
              over 1M ADA and parameter changes carry 2x. Close-margin proposals (decided by less
              than 20% margin) receive a 1.5x bonus.
            </p>
            <p>
              <strong className="text-foreground">Confidence gating.</strong> Entities with
              insufficient data have their tiers capped. DReps with fewer than 5 votes are capped at
              Emerging, 5-9 votes at Bronze, and 10-14 votes at Silver. Only those with 15+ votes
              can reach Gold and above.
            </p>
            <p>
              <strong className="text-foreground">Momentum tracking.</strong> Linear regression over
              recent score history reveals whether a DRep or SPO is improving or declining. DRep
              momentum uses a 14-day window; SPO momentum uses a 30-day window.
            </p>
          </div>
        </section>

        {/* DRep Scoring */}
        <section className="space-y-6">
          <SectionAnchor id="drep-scoring" />
          <h2 className="text-xl font-bold">DRep Score V3</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every DRep receives a composite score from 0 to 100, computed from four weighted
            pillars. Each pillar is percentile-normalized across all active DReps, ensuring the
            score reflects relative standing. The composite formula:
          </p>
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

        {/* Tier System */}
        <section className="space-y-4">
          <SectionAnchor id="tiers" />
          <h2 className="text-xl font-bold">Tier System</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Composite scores map to six tiers shared by both DReps and SPOs. Tiers create emotional
            weight, competitive pressure, and shareability. Low-confidence entities are capped at
            lower tiers regardless of score.
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
                  {t.min}&ndash;{t.max}
                </p>
                <p className="text-[11px] text-muted-foreground">{TIER_DESCRIPTIONS[t.name]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SPO Governance Scoring */}
        <section className="space-y-6">
          <SectionAnchor id="spo-scoring" />
          <h2 className="text-xl font-bold">SPO Governance Score V3</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Stake Pool Operators are scored on their governance participation using the same tier
            system as DReps. The four pillars are tailored to SPO governance behavior, with
            confidence-weighted percentile normalization and a 30-day momentum window.
          </p>
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

        {/* CC Transparency Index */}
        <section className="space-y-6">
          <SectionAnchor id="cc-transparency" />
          <h2 className="text-xl font-bold">CC Transparency Index</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Constitutional Committee members receive a Transparency Index from 0 to 100, measuring
            process and accountability rather than political outcomes. A CC member who votes against
            community sentiment but provides thorough constitutional reasoning scores well. The
            index maps to letter grades: A (85+), B (70-84), C (55-69), D (40-54), F (&lt;40).
          </p>

          <div className="space-y-2">
            {CC_PILLARS.map((p) => (
              <div
                key={p.name}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    {p.description}
                  </p>
                </div>
                <div className="shrink-0 text-right pt-0.5">
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {p.weight}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alignment Dimensions */}
        <section className="space-y-4">
          <SectionAnchor id="alignment" />
          <h2 className="text-xl font-bold">6D Alignment Model</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Governada maps every DRep onto six governance dimensions derived from their voting
            patterns. AI-classified proposal relevance scores determine which votes contribute to
            each dimension. Each dimension score ranges from 0 to 100, with 50 as neutral. Temporal
            decay and amount-weighting ensure recent, material votes carry more weight. The dominant
            dimension determines a DRep&rsquo;s &ldquo;personality archetype&rdquo; (e.g., The
            Guardian, The Pioneer), with hysteresis to prevent flickering between labels.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALIGNMENT_DIMENSIONS.map((d) => (
              <div
                key={d.name}
                className="rounded-lg border border-border bg-card px-4 py-3 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <p className="text-sm font-medium">{d.name}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{d.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* GHI */}
        <section className="space-y-4">
          <SectionAnchor id="ghi" />
          <h2 className="text-xl font-bold">Governance Health Index (GHI)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The GHI measures the health of Cardano governance as a whole, not individual entities.
            It combines six components across three categories into a single 0-100 score, tracked
            epoch-by-epoch. Raw metrics are calibrated through piecewise linear curves before
            weighting.
          </p>

          {(['Engagement', 'Quality', 'Resilience'] as const).map((category) => {
            const categoryWeights: Record<string, string> = {
              Engagement: '35%',
              Quality: '40%',
              Resilience: '25%',
            };
            return (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category} ({categoryWeights[category]})
                </p>
                {GHI_COMPONENTS.filter((c) => c.category === category).map((c) => (
                  <div
                    key={c.name}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.description}</p>
                    </div>
                    <div className="shrink-0 text-right pt-0.5">
                      <span className="text-sm font-bold tabular-nums text-muted-foreground">
                        {c.weight}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-primary">
              GHI bands: <strong>Strong</strong> (76+), <strong>Good</strong> (51-75),{' '}
              <strong>Fair</strong> (26-50), <strong>Critical</strong> (&lt;26)
            </p>
          </div>
        </section>

        {/* Data Sources */}
        <section className="space-y-4">
          <SectionAnchor id="data-sources" />
          <h2 className="text-xl font-bold">Data Sources</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              All scoring data is sourced from the Cardano blockchain via the{' '}
              <a
                href="https://api.koios.rest"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Koios API
              </a>
              , a community-maintained, open-source query layer for Cardano. Governada does not run
              its own indexer — we consume the same public data available to every researcher.
            </p>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Sync pipeline</p>
              <ul className="space-y-1 text-[11px]">
                <li className="pl-3 border-l-2 border-border">
                  <strong>DRep votes and metadata</strong> — synced every epoch (~5 days) via
                  automated Inngest functions
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong>SPO votes and pool metadata</strong> — synced every epoch
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong>Proposals and governance actions</strong> — synced every epoch with
                  ratification/expiry tracking
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong>CC votes and rationale</strong> — synced every epoch with CIP-136
                  rationale parsing
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong>Score recomputation</strong> — triggered after each sync cycle with
                  percentile normalization across the full entity set
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong>Rationale quality scoring</strong> — AI assessment of on-chain rationale
                  quality (0-100) for both DReps and CC members
                </li>
              </ul>
            </div>
            <p>
              Intermediate data is cached in Supabase (PostgreSQL) for query performance. The sync
              pipeline includes self-healing: failed syncs are retried with exponential backoff, and
              health is monitored via the System Stability GHI component.
            </p>
          </div>
        </section>

        {/* Citation Guide */}
        <section className="space-y-4">
          <SectionAnchor id="citation" />
          <h2 className="text-xl font-bold">Citation Guide</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Researchers, journalists, and governance participants are welcome to reference Governada
            scores in their work. We suggest the following formats:
          </p>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Individual DRep score</p>
              <code className="block text-[11px] text-muted-foreground font-mono bg-muted p-2 rounded">
                &ldquo;[DRep Name] holds a Governada DRep Score of [X]/100 ([Tier] tier) as of epoch
                [N]. Source: governada.io/drep/[drep_id]&rdquo;
              </code>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">GHI reference</p>
              <code className="block text-[11px] text-muted-foreground font-mono bg-muted p-2 rounded">
                &ldquo;Cardano governance health stands at [X]/100 ([Band]) per the Governada
                Governance Health Index, epoch [N]. Source: governada.io/governance/health&rdquo;
              </code>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Academic citation</p>
              <code className="block text-[11px] text-muted-foreground font-mono bg-muted p-2 rounded whitespace-pre-wrap">
                Governada. (2026). Scoring Methodology: DRep Score V3, SPO Governance Score V3, CC
                Transparency Index, Governance Health Index. Retrieved from
                https://governada.io/methodology
              </code>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            All scores are point-in-time snapshots. Always include the epoch number or date for
            reproducibility. Score history is available via the Governada API for longitudinal
            analysis.
          </p>
        </section>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">
            Scoring models are open, reproducible, and continuously refined. The source code for all
            scoring algorithms is available in the{' '}
            <code className="text-[10px] bg-muted px-1 rounded">lib/scoring/</code> directory of our
            codebase.
          </p>
          <p className="text-xs text-muted-foreground">
            Questions or feedback?{' '}
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
