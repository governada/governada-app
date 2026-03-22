'use client';

import Link from 'next/link';
import {
  GHI_COMPONENT_WEIGHTS,
  GHI_CALIBRATION,
  DREP_PILLAR_WEIGHTS,
  SPO_PILLAR_WEIGHTS,
  CC_FIDELITY_WEIGHTS,
  EDI_METRIC_WEIGHTS,
  ENGAGEMENT_LAYER_WEIGHTS,
  RELIABILITY_WEIGHTS,
  IDENTITY_WEIGHTS,
  TEMPORAL_DECAY,
  DISSENT_SUBSTANCE_MODIFIER,
  RATIONALE_DIVERSITY_CONFIG,
  type CalibrationCurve,
} from '@/lib/scoring/calibration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MethodologyProps {
  version: {
    version: string;
    lastCalibrated: string;
    methodology: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function CurveTable({ curve, label }: { curve: CalibrationCurve; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{label} calibration curve</caption>
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-white/50">
            <th className="py-2 pr-4">Zone</th>
            <th className="py-2 pr-4">Raw range</th>
            <th className="py-2">Calibrated</th>
          </tr>
        </thead>
        <tbody className="text-white/70">
          <tr className="border-b border-white/5">
            <td className="py-1.5 pr-4 text-red-400">Critical</td>
            <td className="py-1.5 pr-4">0 – {curve.floor}</td>
            <td className="py-1.5">0 – 20</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="py-1.5 pr-4 text-amber-400">Fair</td>
            <td className="py-1.5 pr-4">
              {curve.floor} – {curve.targetLow}
            </td>
            <td className="py-1.5">20 – 50</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="py-1.5 pr-4 text-cyan-400">Good</td>
            <td className="py-1.5 pr-4">
              {curve.targetLow} – {curve.targetHigh}
            </td>
            <td className="py-1.5">50 – 80</td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-emerald-400">Strong</td>
            <td className="py-1.5 pr-4">
              {curve.targetHigh} – {curve.ceiling}+
            </td>
            <td className="py-1.5">80 – 95 (cap)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-4 text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
      <h3 className="mb-3 text-base font-medium text-white/90">{title}</h3>
      <div className="space-y-3 text-sm text-white/70">{children}</div>
    </div>
  );
}

function WeightBar({ label, weight }: { label: string; weight: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-48 shrink-0 text-sm text-white/70">{label}</span>
      <div className="flex-1 rounded-full bg-white/5">
        <div className="h-2 rounded-full bg-cyan-500/60" style={{ width: `${weight * 100}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-white/50">{pct(weight)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GHIMethodology({ version }: MethodologyProps) {
  const weights = GHI_COMPONENT_WEIGHTS;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <div className="mb-2 flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-white">GHI Scoring Methodology</h1>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/40">
            v{version.version}
          </span>
        </div>
        <p className="text-sm text-white/50">
          Last calibrated: {version.lastCalibrated} · {version.methodology}
        </p>
        <p className="mt-4 text-white/70">
          The Governance Health Index (GHI) measures how well Cardano&apos;s governance mechanisms
          are functioning. It is a composite of 9 components across 4 categories, computed daily and
          tracked epoch-over-epoch. Every weight, threshold, and calibration curve is published here
          for public scrutiny.
        </p>
        <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
          <p className="text-sm text-cyan-300/80">
            <strong>Design principle:</strong> GHI uses absolute calibration, not percentile
            ranking. Your actions determine your score, independent of how others perform. This
            means GHI can measure real improvement in governance health over time — not just
            reshuffling of relative positions.
          </p>
        </div>
      </header>

      {/* Table of Contents */}
      <nav className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <h2 className="mb-2 text-sm font-medium text-white/50">Contents</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-cyan-400/80">
          <li>
            <a href="#overview" className="hover:text-cyan-300">
              Overview & Weights
            </a>
          </li>
          <li>
            <a href="#calibration" className="hover:text-cyan-300">
              Calibration System
            </a>
          </li>
          <li>
            <a href="#components" className="hover:text-cyan-300">
              Component Details
            </a>
          </li>
          <li>
            <a href="#drep-score" className="hover:text-cyan-300">
              DRep Score V3.2
            </a>
          </li>
          <li>
            <a href="#spo-score" className="hover:text-cyan-300">
              SPO Score V3.1
            </a>
          </li>
          <li>
            <a href="#cc-fidelity" className="hover:text-cyan-300">
              CC Fidelity Score
            </a>
          </li>
          <li>
            <a href="#edi" className="hover:text-cyan-300">
              Edinburgh Decentralization Index
            </a>
          </li>
          <li>
            <a href="#ai-scoring" className="hover:text-cyan-300">
              AI Rationale Quality Scoring
            </a>
          </li>
          <li>
            <a href="#anti-gaming" className="hover:text-cyan-300">
              Anti-Gaming Measures
            </a>
          </li>
          <li>
            <a href="#limitations" className="hover:text-cyan-300">
              Known Limitations
            </a>
          </li>
          <li>
            <a href="#changelog" className="hover:text-cyan-300">
              Version History
            </a>
          </li>
        </ol>
      </nav>

      {/* 1. Overview & Weights */}
      <Section id="overview" title="1. Overview & Weights">
        <p>
          GHI is a weighted composite of 9 components. Each component produces a raw score (0–100)
          which is mapped through a calibration curve, then multiplied by its weight. The final GHI
          score is the sum of all weighted contributions, clamped to 0–100.
        </p>
        <div className="space-y-2">
          {Object.entries(weights).map(([name, weight]) => (
            <WeightBar key={name} label={name} weight={weight} />
          ))}
        </div>
        <p className="text-xs text-white/40">
          Total: {pct(Object.values(weights).reduce((s, w) => s + w, 0))}. When Citizen Engagement
          is disabled (requires sufficient delegation data), its weight is redistributed
          proportionally across the remaining components.
        </p>
        <div className="mt-2">
          <p className="font-medium text-white/80">Health bands:</p>
          <div className="mt-1 flex gap-4 text-sm">
            <span className="text-red-400">Critical: 0–25</span>
            <span className="text-amber-400">Fair: 26–50</span>
            <span className="text-cyan-400">Good: 51–75</span>
            <span className="text-emerald-400">Strong: 76–100</span>
          </div>
        </div>
      </Section>

      {/* 2. Calibration System */}
      <Section id="calibration" title="2. Calibration System">
        <p>
          Raw scores are mapped to calibrated scores using piecewise linear curves with 4
          breakpoints: <strong>floor</strong>, <strong>targetLow</strong>,{' '}
          <strong>targetHigh</strong>, and <strong>ceiling</strong>. Each breakpoint corresponds to
          specific, observable governance behaviors — not arbitrary thresholds.
        </p>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 font-mono text-xs text-white/60">
          <pre>{`Below floor     → 0-20   (Critical)
Floor→targetLow  → 20-50  (Fair)
TargetLow→High   → 50-80  (Good)
High→ceiling     → 80-95  (Strong)
Above ceiling    → cap 95 (never 100)`}</pre>
        </div>
        <p>
          The cap at 95 is intentional: no component can claim perfection. This prevents ceiling
          effects where meaningful improvement becomes invisible.
        </p>
      </Section>

      {/* 3. Component Details */}
      <Section id="components" title="3. Component Details">
        <SubSection title="DRep Participation (14%)">
          <p>
            Weighted median participation rate across active DReps. Each DRep&apos;s participation
            is weighted by their voting power (delegated ADA), so the score reflects whether the ADA
            that IS delegated is being well-represented — not penalizing the system for ghost DReps
            who registered but never participate.
          </p>
          <CurveTable curve={GHI_CALIBRATION.drepParticipation} label="DRep Participation" />
          <p className="text-xs text-white/40">
            Floor (20): ~20% weighted median participation — most DReps vote sporadically. Ceiling
            (90): Near-universal participation among power-weighted DReps.
          </p>
        </SubSection>

        <SubSection title="SPO Participation (9%)">
          <p>
            Median participation rate across stake pool operators who have cast at least one
            governance vote. SPO governance participation is structurally lower than DRep
            participation (block production is their primary role), so the curve is more generous.
          </p>
          <CurveTable curve={GHI_CALIBRATION.spoParticipation} label="SPO Participation" />
        </SubSection>

        <SubSection title="Citizen Engagement (9%) — Currently Disabled">
          <p>
            Measures delegation rate (what fraction of circulating ADA is delegated to governance)
            and delegation dynamism (are citizens actively choosing and switching representatives).
            Currently disabled via feature flag because it requires 5+ epochs of delegation snapshot
            history to produce meaningful scores.
          </p>
          <p>
            When disabled, its 9% weight is redistributed proportionally across the other 8
            components. The redistribution is mathematical (each component keeps its relative share
            of the remaining weight) — not a subjective reallocation.
          </p>
          <CurveTable curve={GHI_CALIBRATION.citizenEngagement} label="Citizen Engagement" />
        </SubSection>

        <SubSection title="Deliberation Quality (14%)">
          <p>Composite of three sub-signals measuring the quality of governance discourse:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Rationale Quality (50%)</strong> — Average AI-assessed quality score across
              recent votes. See{' '}
              <a href="#ai-scoring" className="text-cyan-400 hover:underline">
                AI Scoring section
              </a>{' '}
              for methodology.
            </li>
            <li>
              <strong>Debate Diversity (30%)</strong> — For each proposal with 3+ votes, measures
              vote distribution. Balanced debate (not unanimous) scores higher.
            </li>
            <li>
              <strong>Voting Independence (20%)</strong> — Percentage of proposals where top 10
              DReps by voting power did NOT all vote the same way. Detects coordinated voting.
            </li>
          </ul>
          <CurveTable curve={GHI_CALIBRATION.deliberationQuality} label="Deliberation Quality" />
        </SubSection>

        <SubSection title="Governance Effectiveness (14%)">
          <p>Three sub-signals measuring whether governance produces results:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Resolution Rate (40%)</strong> — What fraction of resolved proposals were
              enacted vs. dropped/expired?
            </li>
            <li>
              <strong>Decision Velocity (30%)</strong> — Median epochs from proposal to resolution.
              Target: 2–6 epochs. Below 1 = rushed, above 10 = gridlock.
            </li>
            <li>
              <strong>Throughput (30%)</strong> — What fraction of proposals received at least one
              vote?
            </li>
          </ul>
          <CurveTable
            curve={GHI_CALIBRATION.governanceEffectiveness}
            label="Governance Effectiveness"
          />
        </SubSection>

        <SubSection title="CC Constitutional Fidelity (9%)">
          <p>
            Median fidelity score across active Constitutional Committee members. Individual CC
            scores are computed using a{' '}
            <a href="#cc-fidelity" className="text-cyan-400 hover:underline">
              4-pillar model
            </a>{' '}
            that measures process quality, never vote direction.
          </p>
          <CurveTable
            curve={GHI_CALIBRATION.ccConstitutionalFidelity}
            label="CC Constitutional Fidelity"
          />
        </SubSection>

        <SubSection title="Power Distribution (14%)">
          <p>
            Built on the{' '}
            <a href="#edi" className="text-cyan-400 hover:underline">
              Edinburgh Decentralization Index
            </a>{' '}
            — a 7-metric composite measuring DRep voting power concentration. Includes a small
            onboarding bonus (up to +10 points) for new DRep participation in recent epochs.
          </p>
          <CurveTable curve={GHI_CALIBRATION.powerDistribution} label="Power Distribution" />
        </SubSection>

        <SubSection title="System Stability (9%)">
          <p>
            Measures whether governance activity is stable and sustainable. Three pure governance
            signals:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>DRep Retention (50%)</strong> — Are DReps staying active epoch-over-epoch?
              Compares active DRep count across consecutive snapshots.
            </li>
            <li>
              <strong>Score Volatility (30%)</strong> — Are individual DRep scores stable? Low
              volatility = healthy, predictable governance behavior.
            </li>
            <li>
              <strong>Governance Throughput Stability (20%)</strong> — Coefficient of variation of
              votes-per-epoch over a 5-epoch window. Consistent voting activity across epochs
              signals a healthy governance rhythm.
            </li>
          </ul>
          <CurveTable curve={GHI_CALIBRATION.systemStability} label="System Stability" />
        </SubSection>

        <SubSection title="Treasury Health (8%)">
          <p>Six sub-components measuring fiscal sustainability:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Balance Trend (15%)</strong> — Is the treasury balance growing or shrinking?
            </li>
            <li>
              <strong>Withdrawal Velocity (15%)</strong> — Is spending accelerating dangerously?
            </li>
            <li>
              <strong>Income Stability (15%)</strong> — How consistent is reserves income?
            </li>
            <li>
              <strong>Pending Load (15%)</strong> — Pending withdrawals as fraction of balance.
            </li>
            <li>
              <strong>Runway Adequacy (20%)</strong> — Months of funding at current burn rate vs.
              24-month target.
            </li>
            <li>
              <strong>NCL Discipline (20%)</strong> — Is spending within the Net Change Limit
              allocation?
            </li>
          </ul>
          <CurveTable curve={GHI_CALIBRATION.treasuryHealth} label="Treasury Health" />
        </SubSection>

        <SubSection title="Governance Outcomes (6%) — Currently Disabled">
          <p>
            Closes the governance value loop: are enacted proposals actually delivering results for
            Cardano? Without this component, GHI measures governance process health but not whether
            governance produces positive outcomes.
          </p>
          <p>Three sub-signals:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Delivery Rate (40%)</strong> — What fraction of enacted proposals have been
              delivered or partially delivered, based on community accountability polls?
            </li>
            <li>
              <strong>Community Satisfaction (30%)</strong> — &ldquo;Would you approve this proposal
              again?&rdquo; sentiment aggregated across evaluated proposals.
            </li>
            <li>
              <strong>Treasury Efficiency (30%)</strong> — Average delivery quality score across all
              evaluated proposals (weighted by poll data quality).
            </li>
          </ul>
          <p>
            Currently disabled via feature flag because it requires sufficient enacted proposals
            with outcome data. When disabled, its 6% weight is redistributed proportionally across
            the other components.
          </p>
          <CurveTable curve={GHI_CALIBRATION.governanceOutcomes} label="Governance Outcomes" />
        </SubSection>
      </Section>

      {/* 4. DRep Score V3.2 */}
      <Section id="drep-score" title="4. DRep Score V3.2">
        <p>
          Individual DRep scores use a 4-pillar model. Weight was shifted from gameable (Identity)
          to non-gameable (Engagement Quality) in V3.2 to increase manipulation resistance.
        </p>
        <div className="space-y-2">
          <WeightBar label="Engagement Quality" weight={DREP_PILLAR_WEIGHTS.engagementQuality} />
          <WeightBar
            label="Effective Participation"
            weight={DREP_PILLAR_WEIGHTS.effectiveParticipation}
          />
          <WeightBar label="Reliability" weight={DREP_PILLAR_WEIGHTS.reliability} />
          <WeightBar label="Governance Identity" weight={DREP_PILLAR_WEIGHTS.governanceIdentity} />
        </div>

        <SubSection title="Engagement Quality (40%)">
          <p>Three layers measuring the substance of governance participation:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Provision Rate ({pct(ENGAGEMENT_LAYER_WEIGHTS.provision)})</strong> —
              Percentage of votes accompanied by a rationale, weighted by proposal importance and
              temporal decay (half-life: {TEMPORAL_DECAY.halfLifeDays} days).
            </li>
            <li>
              <strong>Rationale Quality ({pct(ENGAGEMENT_LAYER_WEIGHTS.quality)})</strong> —
              AI-assessed deliberation substance (see{' '}
              <a href="#ai-scoring" className="text-cyan-400 hover:underline">
                AI Scoring
              </a>
              ).
            </li>
            <li>
              <strong>Deliberation Signal ({pct(ENGAGEMENT_LAYER_WEIGHTS.deliberation)})</strong> —
              Rationale diversity (unique rationales vs. copy-paste) and governance coverage
              breadth.
            </li>
          </ul>
        </SubSection>

        <SubSection title="Effective Participation (25%)">
          <p>
            Importance-weighted vote coverage. Critical governance actions (HardForkInitiation,
            NoConfidence, NewCommittee) count 3×. Important actions (ParameterChange, significant
            treasury) count 2×. Close-margin proposals (&lt;20% margin) get 1.5× bonus.
          </p>
        </SubSection>

        <SubSection title="Reliability (25%)">
          <p>Four sub-components measuring consistency:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Active Streak ({pct(RELIABILITY_WEIGHTS.streak)})</strong> — Consecutive
              epochs with votes
            </li>
            <li>
              <strong>Recency ({pct(RELIABILITY_WEIGHTS.recency)})</strong> — Exponential decay from
              last vote
            </li>
            <li>
              <strong>Gap Penalty ({pct(RELIABILITY_WEIGHTS.gap)})</strong> — Longest run of missed
              proposal-active epochs
            </li>
            <li>
              <strong>Tenure ({pct(RELIABILITY_WEIGHTS.tenure)})</strong> — Epochs since first vote
              (asymptotic curve)
            </li>
          </ul>
        </SubSection>

        <SubSection title="Governance Identity (10%)">
          <p>
            Profile quality ({pct(IDENTITY_WEIGHTS.profileQuality)}) and community presence (
            {pct(IDENTITY_WEIGHTS.communityPresence)}). Lowest weight because it&apos;s easiest to
            game — filling out a form. V3.2 adds staleness decay (profiles older than 180 days lose
            up to 50% of their quality score) and delegation health signals (retention, diversity,
            organic growth) when snapshot history is available.
          </p>
        </SubSection>
      </Section>

      {/* 5. SPO Score */}
      <Section id="spo-score" title="5. SPO Score V3.1">
        <p>
          Same 4-pillar structure as DRep Score but with curves shifted left (more generous) because
          governance is secondary to block production for SPOs.
        </p>
        <div className="space-y-2">
          <WeightBar label="Participation" weight={SPO_PILLAR_WEIGHTS.participation} />
          <WeightBar label="Deliberation Quality" weight={SPO_PILLAR_WEIGHTS.deliberation} />
          <WeightBar label="Reliability" weight={SPO_PILLAR_WEIGHTS.reliability} />
          <WeightBar label="Governance Identity" weight={SPO_PILLAR_WEIGHTS.governanceIdentity} />
        </div>
      </Section>

      {/* 6. CC Fidelity */}
      <Section id="cc-fidelity" title="6. CC Constitutional Fidelity Score">
        <p>
          Measures whether Constitutional Committee members fulfill their guardian role with
          substance. Scores <strong>process</strong> (did they show up, explain, reason well, engage
          the constitution) — never <strong>outcome</strong> (whether their vote was
          &ldquo;right&rdquo;). A &ldquo;No&rdquo; vote with excellent reasoning scores identically
          to a &ldquo;Yes&rdquo; vote with excellent reasoning.
        </p>
        <div className="space-y-2">
          <WeightBar label="Participation" weight={CC_FIDELITY_WEIGHTS.participation} />
          <WeightBar label="Rationale Provision" weight={CC_FIDELITY_WEIGHTS.rationaleProvision} />
          <WeightBar label="Reasoning Quality" weight={CC_FIDELITY_WEIGHTS.reasoningQuality} />
          <WeightBar
            label="Constitutional Engagement"
            weight={CC_FIDELITY_WEIGHTS.constitutionalEngagement}
          />
        </div>
        <p>
          Reasoning Quality is the primary differentiator (40%) because it&apos;s the hardest to
          game — requires actual argument substance. Constitutional Engagement measures breadth
          (unique articles cited) and depth (average articles per rationale).
        </p>
      </Section>

      {/* 7. EDI */}
      <Section id="edi" title="7. Edinburgh Decentralization Index">
        <p>
          A 7-metric composite measuring DRep voting power distribution. Each metric is normalized
          to 0–1 where 1 = maximally decentralized, then weighted and summed.
        </p>
        <div className="space-y-2">
          <WeightBar label="Nakamoto Coefficient" weight={EDI_METRIC_WEIGHTS.nakamoto} />
          <WeightBar label="Shannon Entropy" weight={EDI_METRIC_WEIGHTS.shannonEntropy} />
          <WeightBar label="Gini Coefficient (inverted)" weight={EDI_METRIC_WEIGHTS.gini} />
          <WeightBar label="HHI (inverted)" weight={EDI_METRIC_WEIGHTS.hhi} />
          <WeightBar label="Theil Index (inverted)" weight={EDI_METRIC_WEIGHTS.theil} />
          <WeightBar label="Concentration Ratio" weight={EDI_METRIC_WEIGHTS.concentration} />
          <WeightBar label="Tau Decentralization (66%)" weight={EDI_METRIC_WEIGHTS.tau} />
        </div>
        <p>
          <strong>Scope limitation:</strong> EDI currently measures DRep voting power distribution
          only. It does not yet capture geographic diversity, SPO governance participation
          distribution, or cross-role concentration. The name reflects our aspiration to build
          toward Edinburgh-standard academic rigor, not a claim of comprehensive decentralization
          measurement.
        </p>
      </Section>

      {/* 8. AI Scoring */}
      <Section id="ai-scoring" title="8. AI Rationale Quality Scoring">
        <p>
          AI-assessed rationale quality is the most impactful signal in the system (40% of DRep
          Engagement Quality, 40% of CC Reasoning Quality). We use this approach because human
          review doesn&apos;t scale, and binary &ldquo;has rationale / doesn&apos;t&rdquo; tells you
          nothing about quality.
        </p>
        <SubSection title="What the AI evaluates">
          <p>Each rationale is scored 0–100 on:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Relevance</strong> — Does the rationale address the specific proposal being
              voted on?
            </li>
            <li>
              <strong>Reasoning depth</strong> — Does it provide justification, or just state a
              position?
            </li>
            <li>
              <strong>Constitutional grounding</strong> — Does it reference governance principles or
              constitutional provisions?
            </li>
            <li>
              <strong>Originality</strong> — Is this original thought, or boilerplate/templated
              text?
            </li>
          </ul>
          <p className="text-xs text-white/40">
            The AI evaluates reasoning quality only — never vote direction. A well-reasoned
            &ldquo;No&rdquo; vote scores the same as a well-reasoned &ldquo;Yes&rdquo; vote.
          </p>
        </SubSection>

        <SubSection title="Example quality levels">
          <div className="space-y-3">
            <div className="rounded border border-white/5 bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                  High (75-100)
                </span>
              </div>
              <p className="text-xs text-white/60 italic">
                &ldquo;I vote Yes on this parameter change because reducing the min pool cost from
                340 to 170 ADA aligns with Article III Section 5 of the Constitution which mandates
                fair competition among stake pools. The current 340 ADA minimum disproportionately
                burdens small pools operating at low margins. Economic modeling from the Edinburgh
                workshop suggests this reduction would lower the break-even delegator count by
                approximately 40%, enabling more viable small pools and improving the Nakamoto
                coefficient.&rdquo;
              </p>
            </div>
            <div className="rounded border border-white/5 bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                  Medium (35-65)
                </span>
              </div>
              <p className="text-xs text-white/60 italic">
                &ldquo;I support this proposal. Lowering the min pool cost makes sense for
                decentralization. Small pools need more support and this is a step in the right
                direction.&rdquo;
              </p>
            </div>
            <div className="rounded border border-white/5 bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                  Low (0-30)
                </span>
              </div>
              <p className="text-xs text-white/60 italic">
                &ldquo;Yes&rdquo; / &ldquo;I agree with this proposal.&rdquo; / [copy of the
                proposal abstract]
              </p>
            </div>
          </div>
        </SubSection>

        <SubSection title="Transparency commitment">
          <p>
            We acknowledge that AI quality scoring is the most controversial aspect of this
            methodology. Our commitments:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>The AI never evaluates vote direction — only reasoning quality</li>
            <li>Scores are visible to the DRep/CC member on their profile</li>
            <li>The scoring rubric (above) is public and versioned</li>
            <li>Boilerplate/copy-paste rationales are detected and penalized separately</li>
            <li>
              We welcome external audit of our scoring outputs and will publish correlation studies
              when sufficient data exists
            </li>
          </ul>
        </SubSection>
      </Section>

      {/* 9. Anti-Gaming */}
      <Section id="anti-gaming" title="9. Anti-Gaming Measures">
        <ul className="ml-4 list-disc space-y-3">
          <li>
            <strong>Multi-dimensional scoring:</strong> No single action produces a high score. DRep
            Score requires excellence across 4 pillars (quality, participation, reliability,
            identity).
          </li>
          <li>
            <strong>Dissent-with-substance modifier:</strong> DReps who vote against the majority
            AND provide quality rationales (≥{DISSENT_SUBSTANCE_MODIFIER.minQuality}/100) get a{' '}
            {DISSENT_SUBSTANCE_MODIFIER.multiplier}× bonus on that rationale&apos;s quality
            contribution. Capped to {pct(DISSENT_SUBSTANCE_MODIFIER.maxVoteFraction)} of votes to
            prevent strategic contrarianism.
          </li>
          <li>
            <strong>Copy-paste detection:</strong> Rationale diversity measures unique CIP-100
            meta_hashes vs. total rationales. Reusing the same rationale across multiple votes
            lowers your deliberation signal. Minimum {RATIONALE_DIVERSITY_CONFIG.minRationales}{' '}
            rationales required before evaluation (below that, neutral score of{' '}
            {RATIONALE_DIVERSITY_CONFIG.neutralScore}).
          </li>
          <li>
            <strong>Graduated confidence gating:</strong> DReps with fewer than 5 votes are capped
            at Emerging tier (50% confidence). 5–9 votes: max Bronze. 10–14: max Silver. 15+ votes:
            full confidence, no cap.
          </li>
          <li>
            <strong>Temporal decay:</strong> Half-life of {TEMPORAL_DECAY.halfLifeDays} days. Past
            governance behavior matters, but recent behavior matters more. You can&apos;t coast on
            historical participation.
          </li>
          <li>
            <strong>Profile staleness:</strong> Profiles older than 180 days lose up to 50% of their
            quality score. Governance identity requires ongoing maintenance.
          </li>
        </ul>
      </Section>

      {/* 10. Known Limitations */}
      <Section id="limitations" title="10. Known Limitations">
        <p>
          No scoring system is perfect. We document our known limitations so you can evaluate GHI
          with full context:
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong>AI quality scoring is a proxy:</strong> What constitutes &ldquo;quality
            governance reasoning&rdquo; is inherently subjective. Our AI model provides a
            consistent, scalable assessment but cannot replace human judgment on what matters most
            for Cardano.
          </li>
          <li>
            <strong>Calibration breakpoints are expert judgment:</strong> The floor/target/ceiling
            values map to real governance behaviors, but choosing where &ldquo;fair&rdquo; becomes
            &ldquo;good&rdquo; is a judgment call. We will recalibrate as governance patterns
            mature.
          </li>
          <li>
            <strong>EDI scope is limited:</strong> The decentralization index measures DRep voting
            power distribution only. Geographic diversity, role concentration, and stakeholder
            diversity are not yet captured.
          </li>
          <li>
            <strong>Governance outcomes data is nascent:</strong> The Governance Outcomes component
            exists but is feature-flagged until sufficient enacted proposals have completed their
            delivery cycles. Early data may be noisy due to small sample sizes.
          </li>
          <li>
            <strong>Goodhart&apos;s Law risk:</strong> When a measure becomes a target, it ceases to
            be a good measure. As GHI gains visibility, actors may optimize for the metric rather
            than the underlying behaviors. Our multi-dimensional, anti-gaming design mitigates but
            cannot eliminate this risk.
          </li>
          <li>
            <strong>Attribution vs. correlation:</strong> If GHI improves, we can demonstrate
            correlation but not prove causation. Governance health may improve for reasons unrelated
            to Governada&apos;s influence.
          </li>
        </ul>
      </Section>

      {/* 11. Version History */}
      <Section id="changelog" title="11. Version History">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
          <h3 className="mb-2 text-sm font-medium text-white/90">
            V3.2.0 — {version.lastCalibrated}
          </h3>
          <ul className="ml-4 list-disc space-y-1 text-xs text-white/60">
            <li>DRep Score: EQ weight raised 35%→40%, GI reduced 15%→10% (anti-gaming)</li>
            <li>Dissent-with-substance modifier replaces standalone dissent signal</li>
            <li>Rationale diversity (meta_hash uniqueness) replaces vote diversity</li>
            <li>Coverage breadth weighted by proposal frequency</li>
            <li>Profile staleness decay (180-day half-life, 50% floor)</li>
            <li>
              Delegation health signals (retention, diversity, growth) replace simple count tiers
            </li>
            <li>
              System Stability: infrastructure health replaced by governance throughput stability
            </li>
            <li>
              Governance Outcomes added as 10th component (6%, feature-flagged) — closes the
              governance value loop
            </li>
            <li>All calibration breakpoints justified with behavioral anchors</li>
          </ul>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-white/5 pt-6 text-sm text-white/40">
        <p>
          This methodology is open for public review. If you identify a flaw, gaming vector, or
          bias, please{' '}
          <Link
            href="https://github.com/governada/governada-app/issues"
            className="text-cyan-400 hover:underline"
            target="_blank"
          >
            open an issue
          </Link>
          . Governada is built on transparency — we welcome scrutiny.
        </p>
        <p className="mt-2">
          Calibration v{version.version} · Last updated {version.lastCalibrated}
        </p>
      </footer>
    </div>
  );
}
