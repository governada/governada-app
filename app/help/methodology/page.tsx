export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { TIERS } from '@/lib/scoring/tiers';
import { PILLAR_WEIGHTS, DECAY_HALF_LIFE_DAYS } from '@/lib/scoring/types';
import { SPO_PILLAR_WEIGHTS } from '@/lib/scoring/spoScore';
import { CC_FIDELITY_WEIGHTS, GHI_COMPONENT_WEIGHTS } from '@/lib/scoring/calibration';
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
  twitter: {
    card: 'summary_large_image',
    title: 'Scoring Methodology — Governada',
    description: 'Transparent, reproducible scoring methodology for Cardano governance research.',
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
      'Measures the depth of governance participation through three layers: rationale provision rate (40%), AI-assessed rationale quality with dissent-substance modifier (40%), and deliberation signal (20%) combining rationale diversity and coverage breadth.',
    layers: [
      'Provision Rate (40%) — importance-weighted % of votes with rationale',
      'Rationale Quality (40%) — AI-scored across 5 dimensions (specificity, reasoning depth, constitutional grounding, coherence, proposal relevance). Outcome-blind: same quality earns the same score regardless of vote direction. DReps who vote against the majority AND provide quality rationale (score ≥60) receive a 1.2x bonus on that vote.',
      'Deliberation Signal (20%) — rationale diversity (60%): penalizes copy-paste rationales across votes; coverage breadth (40%): governance surface coverage weighted by proposal availability',
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
      'Tracks consistency and dependability of governance engagement across four sub-components, only counting epochs where proposals existed. Voting within the governance window is sufficient — speed of response is not measured.',
    layers: [
      'Active Streak (35%) — consecutive proposal-active epochs with votes',
      'Recency (30%) — exponential decay since last vote',
      'Gap Penalty (25%) — penalizes longest inactivity stretch',
      'Tenure (10%) — time since first vote, logarithmic curve',
    ],
  },
  {
    name: 'Governance Identity',
    weight: PILLAR_WEIGHTS.governanceIdentity,
    color: 'bg-violet-500',
    description:
      "Rewards DReps who provide meaningful identity and intent information. Quality-tiered field scoring (not binary has/hasn't) across CIP-119 metadata fields, with staleness decay for outdated profiles, plus delegation health signals.",
    layers: [
      'Profile Quality (60%) — name, objectives, motivations, qualifications, bio, social links, hash verification. Profiles not updated within 6 months start losing points (staleness decay, floor 50%)',
      'Delegation Health (40%) — retention rate (33%): are delegators staying?; diversity (33%): is delegation power spread across many delegators?; organic growth (34%): is the DRep attracting new delegators? Falls back to delegator count tiers when insufficient snapshot history.',
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
      'Voting behavior signals that reward thoughtful, independent governance participation. Penalizes rubber-stamping and abstain-farming.',
    layers: [
      'Vote Diversity (35%) — penalizes >85% same-direction voting with abstain penalty',
      'Dissent Rate (30%) — 15-40% minority voting is the sweet spot for independent thinking',
      'Type Breadth (20%) — fraction of distinct proposal types voted on',
      'Coverage Entropy (15%) — Shannon entropy across proposal types',
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
      'Evaluates pool identity quality cross-validated against actual governance behavior. Metadata-only profiles score lower than profiles backed by voting activity. Pool size (delegator count) is excluded from governance scoring.',
    layers: [
      'Pool Identity Quality (60%) — metadata fields cross-validated against voting activity (statement points gated behind vote counts)',
      'Delegation Responsiveness (40%) — delegator retention after governance activity (neutral 50 default when insufficient data)',
    ],
  },
];

const CC_PILLARS = [
  {
    name: 'Participation',
    weight: Math.round(CC_FIDELITY_WEIGHTS.participation * 100),
    description:
      'Vote rate on eligible governance actions during their term. Non-participation is the most basic accountability failure for constitutional guardians.',
  },
  {
    name: 'Rationale Provision',
    weight: Math.round(CC_FIDELITY_WEIGHTS.rationaleProvision * 100),
    description:
      'Do they explain their votes? Measures whether CC members submit CIP-136 rationale documents — a binary signal independent from reasoning quality.',
  },
  {
    name: 'Reasoning Quality',
    weight: Math.round(CC_FIDELITY_WEIGHTS.reasoningQuality * 100),
    description:
      'AI-assessed deliberation substance. Scores rationality (evidence + logic), reciprocity (engagement with counterarguments), and clarity. Includes boilerplate detection to prevent gaming. The primary differentiator — hardest to fake.',
  },
  {
    name: 'Constitutional Engagement',
    weight: Math.round(CC_FIDELITY_WEIGHTS.constitutionalEngagement * 100),
    description:
      'Breadth and depth of constitutional article references across all votes. Credits any constitutional citation — does not penalize for citing different articles than expected.',
  },
];

const GHI_COMPONENTS = [
  {
    name: 'DRep Participation',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['DRep Participation'] * 100),
    category: 'Engagement',
    description: 'Median effective participation score across all active DReps.',
  },
  {
    name: 'SPO Participation',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['SPO Participation'] * 100),
    category: 'Engagement',
    description: 'SPO governance vote coverage weighted by importance and temporal decay.',
  },
  {
    name: 'Citizen Engagement',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['Citizen Engagement'] * 100),
    category: 'Engagement',
    description: 'Delegation rate (62.5%) and delegation dynamism/churn (37.5%).',
  },
  {
    name: 'Deliberation Quality',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['Deliberation Quality'] * 100),
    category: 'Quality',
    description: 'Rationale quality (50%), debate diversity (30%), and voting independence (20%).',
  },
  {
    name: 'Governance Effectiveness',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['Governance Effectiveness'] * 100),
    category: 'Quality',
    description: 'Proposal resolution rate (40%), decision velocity (30%), and throughput (30%).',
  },
  {
    name: 'CC Constitutional Fidelity',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['CC Constitutional Fidelity'] * 100),
    category: 'Quality',
    description: 'Aggregate CC participation, constitutional grounding, and reasoning quality.',
  },
  {
    name: 'Power Distribution',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['Power Distribution'] * 100),
    category: 'Resilience',
    description:
      'Edinburgh Decentralization Index composite (Nakamoto, Gini, Shannon entropy, HHI, Theil, concentration, tau) plus DRep onboarding rate.',
  },
  {
    name: 'System Stability',
    weight: Math.round(GHI_COMPONENT_WEIGHTS['System Stability'] * 100),
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
    { id: 'anti-gaming', label: 'Anti-Gaming Safeguards' },
    { id: 'tiers', label: 'Tier System' },
    { id: 'spo-scoring', label: 'SPO Governance Scoring' },
    { id: 'cc-transparency', label: 'CC Constitutional Fidelity' },
    { id: 'cc-not-scored', label: 'What CC Fidelity Does Not Score' },
    { id: 'ai-reasoning', label: 'AI Reasoning Quality' },
    { id: 'alignment', label: 'Alignment Dimensions' },
    { id: 'ghi', label: 'Governance Health Index' },
    { id: 'data-sources', label: 'Data Sources' },
    { id: 'version-history', label: 'Version History' },
    { id: 'methodology-feedback', label: 'Challenge Our Methodology' },
    { id: 'citation', label: 'Citation Guide' },
  ];

  return (
    <nav className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4">
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
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            How Governada Scores Work
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Governada measures governance quality for DReps, Stake Pool Operators, and
            Constitutional Committee members on the Cardano network. Every score is computed from
            on-chain data, calibrated through absolute scoring curves, and decayed over time to
            reflect current behavior. Scores measure process and engagement, not political
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
              <strong className="text-foreground">Absolute calibration.</strong> Raw pillar scores
              are mapped through piecewise linear calibration curves to produce a 0-95 score. Your
              actions determine your score — independent of how other participants perform. This
              means every DRep and SPO has clear, actionable steps to improve, and if everyone
              improves, all scores go up. No zero-sum competition.
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
            <p>
              <strong className="text-foreground">Outcome-blind assessment.</strong> Rationale
              quality is assessed independently of vote direction. A well-reasoned &ldquo;No&rdquo;
              scores the same as a well-reasoned &ldquo;Yes&rdquo;. The score never rewards or
              penalizes political positions &mdash; only the quality of governance process.
            </p>
            <p>
              <strong className="text-foreground">Honest about limitations.</strong> AI-based
              rationale quality assessment is approximate. It evaluates reasoning structure, not
              political correctness. Edge cases exist &mdash; a technically excellent rationale
              referencing obscure domain knowledge may score lower than it deserves. We continuously
              calibrate and welcome community feedback on scoring accuracy.
            </p>
          </div>
        </section>

        {/* DRep Scoring */}
        <section className="space-y-6">
          <SectionAnchor id="drep-scoring" />
          <h2 className="text-xl font-bold">DRep Score</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every DRep receives a composite score from 0 to 100, computed from four weighted
            pillars. Each pillar is calibrated through absolute scoring curves, meaning your actions
            directly determine your score. The composite formula:
          </p>
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4">
            <code className="block text-xs text-muted-foreground font-mono">
              Score = (Engagement Quality x 0.40) + (Effective Participation x 0.25) + (Reliability
              x 0.25) + (Governance Identity x 0.10)
            </code>
          </div>

          <div className="space-y-4">
            {DREP_PILLARS.map((p) => (
              <div
                key={p.name}
                className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3"
              >
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

        {/* Anti-Gaming Safeguards */}
        <section className="space-y-4">
          <SectionAnchor id="anti-gaming" />
          <h2 className="text-xl font-bold">Anti-Gaming Safeguards</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Any public scoring system creates incentives. We design against known gaming vectors so
            the score rewards genuine governance quality, not metric optimization.
          </p>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">
                What the score does NOT incentivize
              </p>
              <ul className="space-y-1.5 text-[11px]">
                <li className="pl-3 border-l-2 border-border">
                  <strong className="text-foreground">Voting speed.</strong> Voting at any point
                  within the governance window is equally valued. There is no bonus for voting
                  first.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong className="text-foreground">Strategic contrarianism.</strong> Dissent is
                  not a standalone signal. The 1.2x quality modifier only applies when a minority
                  vote is accompanied by a quality rationale (score 60+), and is capped at 40% of
                  votes. Voting &ldquo;No&rdquo; without reasoning earns nothing extra.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong className="text-foreground">Copy-paste rationales.</strong> Rationale
                  diversity tracking uses CIP-100 metadata hashes to detect when the same rationale
                  document is submitted across multiple votes. Unique, proposal-specific reasoning
                  scores higher.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong className="text-foreground">Rubber-stamping.</strong> Voting on every
                  proposal with identical reasoning and no substantive engagement earns a low
                  Engagement Quality score even if participation is high.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  <strong className="text-foreground">Profile set-and-forget.</strong> Governance
                  Identity applies staleness decay to profiles not updated in 6+ months. A
                  well-filled profile from registration day that&apos;s never maintained will
                  gradually lose points.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">
                Proactive governance is naturally rewarded
              </p>
              <p className="text-[11px]">
                DReps who proactively review proposals before voting tend to write more informed,
                specific rationales. Our rationale quality assessment naturally rewards this
                behavior &mdash; not because we measure the review, but because better preparation
                produces better reasoning. The score measures the output (rationale quality), not
                the input (whether you used any particular tool).
              </p>
            </div>
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
          <h2 className="text-xl font-bold">SPO Governance Score</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Stake Pool Operators are scored on their governance participation using the same tier
            system as DReps. The four pillars are tailored to SPO governance behavior, with absolute
            calibration curves and a 30-day momentum window.
          </p>
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4">
            <code className="block text-xs text-muted-foreground font-mono">
              Score = (Participation x 0.35) + (Deliberation Quality x 0.25) + (Reliability x 0.25)
              + (Governance Identity x 0.15)
            </code>
          </div>

          <div className="space-y-4">
            {SPO_PILLARS.map((p) => (
              <div
                key={p.name}
                className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3"
              >
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
          <h2 className="text-xl font-bold">CC Constitutional Fidelity Score</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Constitutional Committee members receive a Constitutional Fidelity Score from 0 to 100,
            measuring how faithfully they uphold their constitutional mandate. A CC member who votes
            against community sentiment but provides thorough constitutional reasoning scores well.
            The philosophy: do they vote in line with the constitution? In ambiguous cases, do they
            justify their votes enough to back it up?
          </p>

          <div className="space-y-2">
            {CC_PILLARS.map((p) => (
              <div
                key={p.name}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/70 backdrop-blur-md px-4 py-3"
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

        {/* What CC Fidelity Does Not Score */}
        <section className="space-y-4">
          <SectionAnchor id="cc-not-scored" />
          <h3 className="text-lg font-bold">What This Score Does Not Measure</h3>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li className="pl-3 border-l-2 border-border">
              <strong className="text-foreground">Vote direction</strong> — A &ldquo;No&rdquo; vote
              with excellent constitutional reasoning scores identically to a &ldquo;Yes&rdquo;
              vote. We never evaluate whether a vote was &ldquo;right.&rdquo;
            </li>
            <li className="pl-3 border-l-2 border-border">
              <strong className="text-foreground">Political alignment</strong> — We measure process
              quality, not ideology or policy positions.
            </li>
            <li className="pl-3 border-l-2 border-border">
              <strong className="text-foreground">Speed of response</strong> — Voting within the
              governance window is sufficient. Faster is not scored higher.
            </li>
            <li className="pl-3 border-l-2 border-border">
              <strong className="text-foreground">Agreement with other CC members</strong> —
              Independence is not penalized. Unanimous agreement and sole dissent are treated
              equally.
            </li>
            <li className="pl-3 border-l-2 border-border">
              <strong className="text-foreground">Proposal outcomes</strong> — Scores reflect
              reasoning quality at the time of the vote, not whether the proposal ultimately
              succeeded or failed.
            </li>
          </ul>
        </section>

        {/* AI Reasoning Quality */}
        <section className="space-y-4">
          <SectionAnchor id="ai-reasoning" />
          <h3 className="text-lg font-bold">How AI Reasoning Quality Works</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every CC rationale is scored by Claude (Anthropic) at deterministic temperature 0.2.
            Each rationale is scored independently, then averaged across all votes for the member.
            The AI produces three sub-scores:
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/70 backdrop-blur-md px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Rationality</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Evidence-based reasoning and logical soundness. Does the rationale cite specific
                  constitutional articles, precedent, or on-chain data? Are conclusions logically
                  supported?
                </p>
              </div>
              <div className="shrink-0 text-right pt-0.5">
                <span className="text-sm font-bold tabular-nums text-muted-foreground">50%</span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/70 backdrop-blur-md px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Reciprocity</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Engagement with counterarguments and alternative interpretations. Does the
                  rationale acknowledge opposing views, address edge cases, or explain trade-offs?
                </p>
              </div>
              <div className="shrink-0 text-right pt-0.5">
                <span className="text-sm font-bold tabular-nums text-muted-foreground">30%</span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/70 backdrop-blur-md px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Clarity</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Prose quality and accessibility. Is the rationale readable by non-experts? Is it
                  well-structured and free of jargon without sacrificing precision?
                </p>
              </div>
              <div className="shrink-0 text-right pt-0.5">
                <span className="text-sm font-bold tabular-nums text-muted-foreground">20%</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Boilerplate detection.</strong> Each rationale is
              compared against the member&rsquo;s own prior submissions. Copy-paste rationales that
              repeat earlier text without substantive adaptation receive a quality penalty.
            </p>
            <p>
              <strong className="text-foreground">AI confidence.</strong> The model self-reports
              confidence in each score. Low-confidence scores are flagged so users can weigh them
              appropriately.
            </p>
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
                className="rounded-lg border border-border/50 bg-card/70 backdrop-blur-md px-4 py-3 space-y-1"
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
            It combines eight components across three categories into a single 0-100 score, tracked
            epoch-by-epoch. Raw metrics are calibrated through piecewise linear curves before
            weighting. Because individual scores use absolute calibration, when DReps, SPOs, and CC
            members collectively improve their governance behavior, the GHI rises — making Governada
            a tool that measurably improves Cardano governance quality.
          </p>

          {(['Engagement', 'Quality', 'Resilience'] as const).map((category) => {
            const categoryWeights: Record<string, string> = {
              Engagement: '35%',
              Quality: '40%',
              Resilience: '25%',
            }; // DRep 15% + SPO 10% + Citizen 10% = 35%, Deliberation 15% + Effectiveness 15% + CC 10% = 40%, Power 15% + Stability 10% = 25%
            return (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category} ({categoryWeights[category]})
                </p>
                {GHI_COMPONENTS.filter((c) => c.category === category).map((c) => (
                  <div
                    key={c.name}
                    className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/70 backdrop-blur-md px-4 py-3"
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
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
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
                  absolute calibration across all entity scores
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

        {/* Version History */}
        <section className="space-y-4">
          <SectionAnchor id="version-history" />
          <h2 className="text-xl font-bold">Version History</h2>
          <div className="space-y-2">
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">
                V3.2 (March 2026) &mdash; Defensibility Rebuild
              </p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li className="pl-3 border-l-2 border-border">
                  Pillar weights rebalanced: EQ 35% &rarr; 40%, GI 15% &rarr; 10%. Engagement
                  quality is the hardest pillar to game and the strongest signal of accountability.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Dissent removed as standalone signal. Replaced with dissent-with-substance
                  modifier (1.2x quality bonus for minority votes with rationale quality 60+).
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Deliberation signal rebuilt: vote diversity &rarr; rationale diversity (catches
                  copy-paste); type breadth &rarr; coverage breadth (weighted by proposal
                  availability).
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Governance Identity: delegation health signals (retention, diversity, growth)
                  replace raw delegator count. Profile staleness decay added.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">V3.1 (February 2026)</p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li className="pl-3 border-l-2 border-border">
                  Added AI rationale quality scoring (5-dimension assessment).
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Introduced importance weighting for proposals (3x critical, 2x important).
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Added confidence gating (vote count tiers cap achievable rank).
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">
                V3.0 (January 2026) &mdash; Four-Pillar Architecture
              </p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li className="pl-3 border-l-2 border-border">
                  Initial four-pillar model: Engagement Quality, Effective Participation,
                  Reliability, Governance Identity.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Absolute calibration curves (not percentile ranking). Temporal decay with{' '}
                  {DECAY_HALF_LIFE_DAYS}-day half-life.
                </li>
                <li className="pl-3 border-l-2 border-border">
                  Six-tier system (Emerging through Legendary) shared across DReps and SPOs.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Methodology Feedback */}
        <section className="space-y-4">
          <SectionAnchor id="methodology-feedback" />
          <h2 className="text-xl font-bold">Challenge Our Methodology</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We believe accountability requires openness to scrutiny. If you are a CC member, DRep,
            or community member who believes our scoring methodology is unfair, incomplete, or
            incorrect, we want to hear from you.
          </p>
          <a
            href="https://github.com/governada/governada-app/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Join the Discussion
          </a>
          <p className="text-xs text-muted-foreground">
            All methodology changes are documented in our public repository. Scoring weights, AI
            prompts, and grade thresholds are open source.
          </p>
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
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Individual DRep score</p>
              <code className="block text-[11px] text-muted-foreground font-mono bg-muted p-2 rounded">
                &ldquo;[DRep Name] holds a Governada DRep Score of [X]/100 ([Tier] tier) as of epoch
                [N]. Source: governada.io/drep/[drep_id]&rdquo;
              </code>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">GHI reference</p>
              <code className="block text-[11px] text-muted-foreground font-mono bg-muted p-2 rounded">
                &ldquo;Cardano governance health stands at [X]/100 ([Band]) per the Governada
                Governance Health Index, epoch [N]. Source: governada.io/governance/health&rdquo;
              </code>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Academic citation</p>
              <code className="block text-[11px] text-muted-foreground font-mono bg-muted p-2 rounded whitespace-pre-wrap">
                Governada. (2026). Scoring Methodology: DRep Score, SPO Governance Score, CC
                Constitutional Fidelity Score, Governance Health Index. Retrieved from
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
              href="https://github.com/governada"
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
