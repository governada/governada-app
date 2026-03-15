# Constitutional Intelligence — Implementation Plan

> **Status**: APPROVED — Execution started 2026-03-15
> **Origin**: `/explore-feature Committee pages` (2026-03-14)
> **Goal**: Transform the CC pages from an accountability dashboard into the world's first Constitutional Intelligence platform — combining relational dynamics visualization ("The Chamber") with AI-powered constitutional interpretation tracking, reasoning quality analysis, and predictive intelligence.

---

## Vision Summary

The Constitutional Committee is a 7-10 member body with disproportionate power — a CC rejection blocks governance actions even with overwhelming DRep/SPO support. Today, Governada scores individual CC members on 3 pillars and ranks them. This is already ahead of every competitor. But it treats members as isolated entities and ignores the most valuable intelligence: **how members relate to each other, how they interpret the constitution, and how those interpretations evolve.**

This plan builds two layers simultaneously:

1. **The Chamber** (Computational) — Agreement heatmap, bloc detection, constitutional personality archetypes, composition timeline. Shows the CC as a living system of relationships.
2. **Constitutional Intelligence** (AI) — Rationale deep analysis, interpretation tracking, precedent graph, reasoning quality scoring, predictive signals, AI briefings. Understands _what the constitution means_ based on how it's being applied.

Together, these make Governada the **case law tracker for Cardano** — something that doesn't exist for any blockchain governance body, and is competitive with what Harvard Law Review and legal scholars do for the Supreme Court.

### Core Principles

1. **Relationships first, scores second.** With 7-10 members, the heatmap reveals more than any ranked list.
2. **Interpretation > citation.** "Did they cite Article II §6?" is table stakes. "How did they interpret Article II §6, and does that conflict with how they interpreted it last month?" is intelligence.
3. **Forward-looking, not just historical.** Predictive signals about upcoming governance actions make Governada essential _before_ decisions happen.
4. **Accessible to citizens, deep enough for researchers.** AI briefings make constitutional interpretation understandable to anyone. Raw data and methodology remain available for depth users.
5. **Compounding moat.** Every CC decision makes the interpretation tracker, precedent graph, and prediction model more valuable. Competitors launching later can never catch up on accumulated intelligence.

### The "Holy Shit" Moments

These are the specific experiences that create the launch reaction:

- **The Heatmap**: "I can see how the entire CC works together in one glance — who agrees, who clashes, where the blocs are."
- **The Key Finding**: "Governada's AI caught that Member X has never cited Article III despite voting on 4 hard fork proposals that require it."
- **The Interpretation Divergence**: "Members A and B read Article II §6 completely differently — that's why treasury proposals always split 5-2."
- **The Precedent Alert**: "This CC decision contradicts their own precedent from 3 months ago. Governada flagged it automatically."
- **The Prediction**: "Governada predicted this 5-2 split two weeks ago based on interpretation patterns."
- **The Briefing**: A 4-sentence paragraph that makes a citizen actually understand what the CC is doing and why it matters.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA PIPELINE (Inngest)                       │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ syncCcVotes   │    │ syncCcRatio- │    │ NEW: analyzeCc-  │  │
│  │ (existing)    │───▶│ nales        │───▶│ Rationales       │  │
│  │               │    │ (existing)   │    │ (AI analysis)    │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                  │              │
│                           ┌──────────────────────┤              │
│                           ▼                      ▼              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │ NEW: computeCcRelations  │  │ NEW: trackInterpretation │    │
│  │ (agreement matrix,       │  │ History (per-article,    │    │
│  │  blocs, personalities)   │  │  precedent links)        │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
│                           │                      │              │
│                           ▼                      ▼              │
│                  ┌──────────────────────────┐                   │
│                  │ NEW: generateCcBriefing  │                   │
│                  │ (epoch briefings,        │                   │
│                  │  member dossiers,        │                   │
│                  │  predictive signals)     │                   │
│                  └──────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (new tables)                         │
│                                                                 │
│  cc_rationale_analysis     — AI-structured analysis per vote    │
│  cc_agreement_matrix       — pairwise agreement percentages    │
│  cc_bloc_assignments       — detected voting blocs             │
│  cc_member_archetypes      — constitutional personality data   │
│  cc_interpretation_history — per-member, per-article tracking  │
│  cc_precedent_links        — decision-to-decision references   │
│  cc_intelligence_briefs    — cached AI briefings               │
│  cc_predictive_signals     — upcoming vote predictions         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API LAYER                                     │
│                                                                 │
│  /api/governance/committee          — enhanced with relations   │
│  /api/governance/committee/[id]     — NEW: member intelligence  │
│  /api/governance/committee/briefing — NEW: AI briefings         │
│  /api/governance/committee/predict  — NEW: predictive signals   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                      │
│                                                                 │
│  /governance/committee                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CCHealthVerdict (existing, enhanced with briefing)      │   │
│  │  CCHeatmap (NEW — dominant element)                      │   │
│  │  CCBlocBadges (NEW)                                      │   │
│  │  CCMemberDirectory (existing list, demoted)              │   │
│  │  Methodology (existing, collapsed)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  /governance/committee/[id]                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ProfileHero (enhanced: chamber position + personality)  │   │
│  │  CCKeyFinding (NEW — AI-generated callout)               │   │
│  │  KeyStats (existing, kept)                               │   │
│  │  Overview: PillarBreakdown + Trend + RecentVotes         │   │
│  │  Deep: Tabs + CCInterpretationProfile (NEW)              │   │
│  │        + CCPairwiseAlignment (NEW)                       │   │
│  │        + Enhanced VotingRecord (significance badges)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- 1. AI-structured analysis per CC rationale
CREATE TABLE cc_rationale_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cc_hot_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,

  -- Interpretation extraction
  interpretation_stance TEXT,          -- 'strict' | 'moderate' | 'broad' per article
  key_arguments JSONB,                 -- [{claim, evidence, article_cited}]
  logical_structure TEXT,              -- 'deductive' | 'analogical' | 'precedent-based' | 'textual'

  -- Reasoning quality (AQuA-inspired)
  rationality_score SMALLINT,          -- 0-100: evidence-based reasoning
  reciprocity_score SMALLINT,          -- 0-100: engages with other CC arguments
  clarity_score SMALLINT,              -- 0-100: clear, well-structured prose
  deliberation_quality SMALLINT,       -- 0-100: weighted composite

  -- Constitutional coverage
  articles_analyzed JSONB,             -- [{article, interpretation, stance}]
  novel_interpretation BOOLEAN DEFAULT FALSE,  -- flags new readings
  contradicts_own_precedent BOOLEAN DEFAULT FALSE,

  -- Key finding extraction
  notable_finding TEXT,                -- 1-sentence AI-extracted finding
  finding_severity TEXT,               -- 'info' | 'noteworthy' | 'concern' | 'critical'

  -- Metadata
  model_version TEXT NOT NULL,         -- track which Claude model generated this
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cc_hot_id, proposal_tx_hash, proposal_index)
);

-- 2. Pairwise agreement matrix (recomputed after each new vote batch)
CREATE TABLE cc_agreement_matrix (
  member_a TEXT NOT NULL,
  member_b TEXT NOT NULL,
  agreement_pct NUMERIC(5,2),          -- 0.00-100.00
  total_shared_proposals INT,          -- proposals both voted on
  agreed_count INT,
  disagreed_count INT,
  -- Most recent disagreement for quick access
  last_disagreement_proposal TEXT,
  last_disagreement_index INT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (member_a, member_b)
);

-- 3. Detected voting blocs
CREATE TABLE cc_bloc_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloc_label TEXT NOT NULL,            -- 'Bloc A', 'Bloc B', or 'Independent'
  cc_hot_id TEXT NOT NULL,
  internal_agreement_pct NUMERIC(5,2), -- bloc's internal cohesion
  member_count INT,                    -- total members in this bloc
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cc_hot_id, computed_at)
);

-- 4. Constitutional personality archetypes
CREATE TABLE cc_member_archetypes (
  cc_hot_id TEXT PRIMARY KEY,
  archetype_label TEXT NOT NULL,       -- 'Treasury Guardian', 'Consensus Builder', etc.
  archetype_description TEXT,          -- 1-2 sentence explanation
  strictness_score NUMERIC(5,2),       -- 0-100 (low=permissive, high=strict)
  specialization JSONB,                -- {proposalType: approvalRate} showing focus areas
  independence_profile TEXT,           -- 'independent' | 'consensus-leaning' | 'bloc-aligned'
  -- Relationships
  most_aligned_member TEXT,
  most_aligned_pct NUMERIC(5,2),
  most_divergent_member TEXT,
  most_divergent_pct NUMERIC(5,2),
  -- Sole dissenter stats
  sole_dissenter_count INT DEFAULT 0,
  sole_dissenter_proposals JSONB,      -- [{tx_hash, index, proposal_title}]
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Per-member, per-article interpretation history
CREATE TABLE cc_interpretation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cc_hot_id TEXT NOT NULL,
  article TEXT NOT NULL,               -- 'Article II, § 6', etc.
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  epoch INT,

  interpretation_stance TEXT,          -- 'strict' | 'moderate' | 'broad'
  interpretation_summary TEXT,         -- 1-sentence: how they read this article here
  consistent_with_prior BOOLEAN,       -- matches their previous reading?
  drift_note TEXT,                     -- if inconsistent, explain the shift

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cc_hot_id, article, proposal_tx_hash, proposal_index)
);

-- 6. Decision-to-decision precedent links
CREATE TABLE cc_precedent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tx_hash TEXT NOT NULL,        -- the later decision
  source_index INT NOT NULL,
  target_tx_hash TEXT NOT NULL,        -- the earlier decision it references/follows
  target_index INT NOT NULL,
  relationship TEXT NOT NULL,          -- 'follows' | 'extends' | 'narrows' | 'contradicts' | 'distinguishes'
  shared_articles JSONB,               -- articles both decisions interpret
  explanation TEXT,                     -- AI-generated: why these are linked
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_tx_hash, source_index, target_tx_hash, target_index)
);

-- 7. Cached AI briefings
CREATE TABLE cc_intelligence_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_type TEXT NOT NULL,            -- 'committee_epoch' | 'member_dossier' | 'decision_analysis'
  reference_id TEXT NOT NULL,          -- epoch number, cc_hot_id, or proposal key
  persona_variant TEXT DEFAULT 'default', -- 'citizen' | 'drep' | 'researcher' | 'default'

  headline TEXT,                       -- 1-line hook
  executive_summary TEXT,              -- 3-4 sentence overview
  key_findings JSONB,                  -- [{finding, severity, evidence_link}]
  what_changed TEXT,                   -- "What changed this epoch" bullets
  full_narrative TEXT,                 -- complete briefing text (markdown)
  citations JSONB,                     -- [{claim, source_type, source_id}]

  -- Staleness tracking
  input_hash TEXT,                     -- hash of source data; regenerate if changed
  model_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,             -- force refresh after this time

  UNIQUE(brief_type, reference_id, persona_variant)
);

-- 8. Predictive signals for upcoming governance actions
CREATE TABLE cc_predictive_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,

  predicted_outcome TEXT,              -- 'approve' | 'reject' | 'split'
  predicted_split JSONB,               -- {yes: [member_ids], no: [member_ids], uncertain: [member_ids]}
  confidence SMALLINT,                 -- 0-100
  reasoning TEXT,                      -- AI explanation of prediction basis
  key_article TEXT,                    -- constitutional article most likely to drive the decision
  tension_flag BOOLEAN DEFAULT FALSE,  -- true if prediction suggests CC-DRep divergence

  -- Tracking
  actual_outcome TEXT,                 -- filled after vote completes
  prediction_accurate BOOLEAN,         -- did we get it right?
  model_version TEXT NOT NULL,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(proposal_tx_hash, proposal_index)
);
```

### Indexes

```sql
CREATE INDEX idx_rationale_analysis_member ON cc_rationale_analysis(cc_hot_id);
CREATE INDEX idx_rationale_analysis_proposal ON cc_rationale_analysis(proposal_tx_hash, proposal_index);
CREATE INDEX idx_interpretation_member_article ON cc_interpretation_history(cc_hot_id, article);
CREATE INDEX idx_precedent_source ON cc_precedent_links(source_tx_hash, source_index);
CREATE INDEX idx_precedent_target ON cc_precedent_links(target_tx_hash, target_index);
CREATE INDEX idx_briefs_lookup ON cc_intelligence_briefs(brief_type, reference_id, persona_variant);
CREATE INDEX idx_predictions_proposal ON cc_predictive_signals(proposal_tx_hash, proposal_index);
```

---

## Inngest Functions

### Function 1: `analyzeCcRationales` (AI Analysis Pipeline)

**Trigger**: Runs after `syncCcRationales` completes (event-driven via `cc/rationales.synced`)
**Concurrency**: `{ scope: 'cc-analysis', limit: 1 }`

**Steps**:

1. **`find-unanalyzed`** — Query `cc_rationales` LEFT JOIN `cc_rationale_analysis` to find rationales not yet analyzed.

2. **`analyze-batch`** — For each unanalyzed rationale (batch of 5):
   - Fetch the rationale text, cited articles, proposal type, and proposal title
   - Fetch the CC member's prior interpretation history for the same articles (from `cc_interpretation_history`)
   - Call Claude with structured prompt (see Prompt Engineering section below)
   - Parse response into `cc_rationale_analysis` row
   - Extract per-article interpretations into `cc_interpretation_history` rows
   - Detect if this contradicts the member's own prior interpretation of the same article

3. **`link-precedents`** — For each analyzed rationale:
   - Find prior CC decisions on the same proposal type
   - Find prior decisions citing the same constitutional articles
   - Call Claude to classify the relationship (follows/extends/narrows/contradicts/distinguishes)
   - Insert into `cc_precedent_links`

4. **`emit-completion`** — Emit `cc/analysis.completed` event for downstream functions

**Error handling**: If Claude API fails, mark rationale as `analysis_pending` and retry on next run. Never block the pipeline.

### Function 2: `computeCcRelations` (Computational Intelligence)

**Trigger**: Runs after `syncSpoAndCcVotes` completes (event-driven via `cc/votes.synced`), AND on schedule `0 */6 * * *` (every 6 hours as safety net)
**Concurrency**: `{ scope: 'cc-relations', limit: 1 }`

**Steps**:

1. **`compute-agreement-matrix`** — For all pairs of active CC members:

   ```sql
   SELECT
     a.cc_hot_id AS member_a,
     b.cc_hot_id AS member_b,
     COUNT(*) AS total_shared,
     SUM(CASE WHEN a.vote = b.vote THEN 1 ELSE 0 END) AS agreed
   FROM cc_votes a
   JOIN cc_votes b ON a.proposal_tx_hash = b.proposal_tx_hash
     AND a.proposal_index = b.proposal_index
     AND a.cc_hot_id < b.cc_hot_id
   GROUP BY a.cc_hot_id, b.cc_hot_id
   ```

   Upsert into `cc_agreement_matrix`.

2. **`detect-blocs`** — Apply agglomerative clustering on agreement matrix:
   - Convert agreement percentages to distance matrix (100 - agreement%)
   - Use single-linkage clustering with threshold: members with ≥80% internal agreement form a bloc
   - Only label a cluster as a "bloc" if it has ≥2 members AND internal agreement ≥80%
   - Members not in any bloc are labeled "Independent"
   - Upsert into `cc_bloc_assignments`

3. **`compute-archetypes`** — For each active CC member:
   - Calculate strictness_score: `100 - approval_rate` (low approval = strict constitutional guardian)
   - Compute specialization from vote distribution by proposal type
   - Identify most-aligned and most-divergent peers from agreement matrix
   - Count sole dissenter instances (only CC member to vote differently from the rest)
   - Classify independence_profile from bloc assignment + divergence patterns
   - Generate archetype_label using rule-based classification (see Archetype Rules below)
   - Upsert into `cc_member_archetypes`

4. **`emit-completion`** — Emit `cc/relations.computed` event

### Function 3: `generateCcBriefing` (AI Briefings)

**Trigger**: Event-driven via `cc/analysis.completed` AND `cc/relations.computed` (waits for both), PLUS schedule at epoch boundaries
**Concurrency**: `{ scope: 'cc-briefing', limit: 1 }`

**Steps**:

1. **`generate-committee-briefing`** — Create/update the committee-level epoch briefing:
   - Gather: health summary, agreement matrix, bloc assignments, recent rationale analyses, interpretation drift events, precedent links
   - Hash all inputs; skip regeneration if hash matches existing brief
   - Call Claude to generate: headline, executive_summary, key_findings, what_changed
   - Generate persona variants (citizen gets plain language, researcher gets detailed analysis)
   - Upsert into `cc_intelligence_briefs` with `brief_type='committee_epoch'`

2. **`generate-member-dossiers`** — For each active CC member:
   - Gather: member data, archetype, interpretation history, sole dissenter list, pairwise alignment, notable findings from rationale analyses
   - Determine the single most notable "Key Finding" (highest severity from `cc_rationale_analysis.notable_finding` OR interpretation contradictions OR blind spots)
   - Call Claude to generate member dossier: executive summary, key finding callout, behavioral patterns, constitutional interpretation profile
   - Upsert into `cc_intelligence_briefs` with `brief_type='member_dossier'`

3. **`generate-predictions`** — For each pending/active proposal that CC can vote on:
   - Check if CC members have already voted (skip if vote complete)
   - Gather: proposal type, relevant constitutional articles, each CC member's interpretation history for those articles, bloc assignments, historical voting patterns on similar proposal types
   - Call Claude to predict: likely outcome, predicted member-by-member votes, confidence, reasoning
   - Upsert into `cc_predictive_signals`

4. **`backfill-prediction-accuracy`** — For proposals with predictions where CC voting is now complete:
   - Compare predicted outcome to actual outcome
   - Update `actual_outcome` and `prediction_accurate` fields
   - This builds the accuracy track record over time

---

## Prompt Engineering

### Prompt 1: Rationale Analysis

```
You are a constitutional law analyst for Cardano's governance system.

Analyze this CC member's rationale for their vote on a governance action.

## Context
- CC Member: {{authorName}} ({{ccHotId}})
- Proposal: {{proposalTitle}} (Type: {{proposalType}})
- Vote: {{vote}}
- Expected constitutional articles for this proposal type: {{expectedArticles}}

## Prior Interpretation History
This member has previously interpreted these articles as follows:
{{priorInterpretations}}

## Rationale Text
{{rationaleText}}

## Cited Articles
{{citedArticles}}

## Instructions
Analyze this rationale and return a JSON object with these fields:

1. **interpretation_stance** (per cited article): 'strict' | 'moderate' | 'broad'
   - strict: narrow, textual reading limiting the article's scope
   - moderate: balanced interpretation following established precedent
   - broad: expansive reading extending the article's application

2. **key_arguments**: Array of {claim, evidence, article_cited} — the 2-4 core arguments

3. **logical_structure**: 'deductive' | 'analogical' | 'precedent-based' | 'textual'

4. **rationality_score** (0-100): Is the reasoning evidence-based and logically sound?
   - 90-100: Rigorous legal reasoning with clear evidence chain
   - 70-89: Solid reasoning with minor gaps
   - 50-69: Reasoning present but weak evidence or logical gaps
   - 0-49: Assertion without substantiation

5. **reciprocity_score** (0-100): Does the rationale engage with other perspectives?
   - 90-100: Directly addresses counterarguments or other CC members' positions
   - 70-89: Acknowledges alternative interpretations
   - 50-69: Single-perspective but thorough
   - 0-49: No engagement with alternatives

6. **clarity_score** (0-100): Is the prose clear, well-structured, and accessible?

7. **articles_analyzed**: Array of {article, interpretation, stance} for EACH article cited

8. **novel_interpretation** (boolean): Does this represent a new reading of any article
   not seen in this member's prior history?

9. **contradicts_own_precedent** (boolean): Does this interpretation conflict with their
   prior interpretation of the same article? Only true if a clear reversal.

10. **notable_finding** (string): The single most noteworthy thing about this rationale.
    Be specific and concrete. Examples:
    - "First time this member has cited Article IV in a treasury context"
    - "Contradicts their own strict reading of Article II §6 from Epoch 520"
    - "Only CC member to argue this proposal violates Article III §6"
    If nothing notable: null

11. **finding_severity**: 'info' | 'noteworthy' | 'concern' | 'critical'

Return ONLY valid JSON matching this schema. No commentary.
```

### Prompt 2: Precedent Classification

```
You are a constitutional precedent analyst for Cardano's governance.

Classify the relationship between two CC decisions that involve the same
constitutional articles.

## Later Decision (Source)
- Proposal: {{sourceTitle}} ({{sourceType}}, Epoch {{sourceEpoch}})
- CC Outcome: {{sourceOutcome}}
- Key articles cited: {{sourceArticles}}
- Key interpretation: {{sourceInterpretation}}

## Earlier Decision (Target)
- Proposal: {{targetTitle}} ({{targetType}}, Epoch {{targetEpoch}})
- CC Outcome: {{targetOutcome}}
- Key articles cited: {{targetArticles}}
- Key interpretation: {{targetInterpretation}}

## Classify the relationship as ONE of:
- **follows**: Later decision applies the same interpretation as the earlier one
- **extends**: Later decision builds on the earlier interpretation, applying it to a new context
- **narrows**: Later decision limits the scope of the earlier interpretation
- **contradicts**: Later decision directly conflicts with the earlier interpretation
- **distinguishes**: Later decision acknowledges the earlier one but argues it doesn't apply here

Return JSON: {relationship, shared_articles, explanation}
- explanation: 1-2 sentences explaining WHY this relationship exists
```

### Prompt 3: Committee Briefing

```
You are the governance intelligence analyst for Governada, the constitutional
intelligence platform for Cardano.

Write a committee briefing for the current epoch.

## Committee State
- Active members: {{memberCount}}
- Average fidelity: {{avgFidelity}}
- Health status: {{healthStatus}}
- Trend: {{trend}}

## Voting Blocs
{{blocSummary}}

## Recent Decisions (this epoch)
{{recentDecisions}}

## Interpretation Developments
- New interpretations: {{novelInterpretations}}
- Precedent contradictions: {{contradictions}}
- Interpretation drift events: {{driftEvents}}

## Tensions
- CC-DRep divergences: {{tensions}}

## Persona: {{persona}}
{{personaGuidance}}

## Instructions
Generate a briefing with:

1. **headline** (max 12 words): The single most important thing about the CC right now.
   Not generic ("CC continues governance work"). Specific ("First CC split on treasury
   since Epoch 510 signals interpretation shift").

2. **executive_summary** (3-4 sentences): What's happening, why it matters, what to watch.
   Write for {{persona}} audience. Citizens need plain language and significance.
   Researchers need precision and data references.

3. **key_findings** (2-4 items): Array of {finding, severity, evidence_link}
   - Each finding must reference specific proposals, members, or articles
   - severity: 'info' | 'noteworthy' | 'concern' | 'critical'
   - evidence_link: description of the data source (e.g., "cc_rationale for Member X on Proposal Y")

4. **what_changed** (2-3 bullets): What's different since last epoch. Specific, not generic.

Return JSON matching this schema. Every claim must be grounded in the provided data.
Do not invent information.
```

### Prompt 4: Member Dossier

```
You are writing an intelligence dossier on a CC member for Governada.

## Member Profile
- Name: {{authorName}}
- Score: {{fidelityScore}}/100 (Grade {{fidelityGrade}})
- Rank: {{rank}}/{{totalMembers}}
- Term: Epoch {{authorizationEpoch}} – {{expirationEpoch}}
- Archetype: {{archetypeLabel}} — {{archetypeDescription}}

## Chamber Position
- Most aligned with: {{mostAlignedMember}} ({{mostAlignedPct}}%)
- Most divergent from: {{mostDivergentMember}} ({{mostDivergentPct}}%)
- Bloc assignment: {{blocLabel}} ({{blocInternalAgreement}}% internal cohesion)
- Sole dissenter: {{soleDissenterCount}} times

## Pillar Scores
- Participation: {{participationScore}}/100
- Constitutional Grounding: {{groundingScore}}/100
- Reasoning Quality: {{reasoningScore}}/100

## Key Rationale Findings
{{rationaleFindings}}

## Interpretation History
{{interpretationHistory}}

## Contradictions / Drift
{{contradictions}}

## Instructions
Write a dossier with:

1. **executive_summary** (1 paragraph): Who this person is as a constitutional guardian.
   Lead with their defining characteristic, not their score. Reference their archetype
   and chamber position. Mention their strongest and weakest accountability dimension.

2. **key_finding** (1 sentence): The single most notable fact about this member.
   Must be concrete and surprising. Not "has good participation" but "is the only
   CC member who has never cited Article III despite voting on 4 hard fork proposals."

3. **behavioral_patterns** (2-3 sentences): What patterns emerge from their voting
   history? Are they fast or slow voters? Do they specialize in certain proposal types?
   Do they drift or stay consistent?

4. **constitutional_profile** (2-3 sentences): How do they interpret the constitution?
   Are they strict or broad? On which articles? Has their interpretation shifted?

Return JSON: {executive_summary, key_finding, behavioral_patterns, constitutional_profile}
Every claim must reference specific data from the context provided.
```

### Prompt 5: Predictive Signal

```
You are predicting how the CC will vote on an upcoming governance action.

## Proposal
- Title: {{proposalTitle}}
- Type: {{proposalType}}
- Key constitutional articles: {{relevantArticles}}

## CC Members' Relevant History
{{memberHistories}}

## Bloc Dynamics
{{blocSummary}}

## Instructions
Predict:
1. **predicted_outcome**: 'approve' | 'reject' | 'split' (non-unanimous either way)
2. **predicted_split**: {yes: [member_names], no: [member_names], uncertain: [member_names]}
3. **confidence**: 0-100 (be honest — with <10 data points per member, confidence should rarely exceed 75)
4. **reasoning**: 2-3 sentences explaining the prediction basis. Reference specific prior votes and interpretations.
5. **key_article**: The constitutional article most likely to drive divergence.
6. **tension_flag**: true if predicted CC outcome diverges from likely DRep majority.

Return JSON. Mark members as 'uncertain' when their history on this proposal type is insufficient.
```

---

## Archetype Classification Rules

Deterministic first pass (AI can override with nuance in dossier generation):

| Archetype                 | Rule                                                             | Description                                                  |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| **Treasury Guardian**     | Strictness ≥ 70 AND TreasuryWithdrawals approval rate < 50%      | Conservative on spending, demands fiscal evidence            |
| **Consensus Builder**     | In largest bloc AND sole_dissenter_count = 0                     | Rarely breaks from majority, prioritizes committee unity     |
| **Constitutional Purist** | Article coverage ≥ 90% AND interpretation_stance mostly 'strict' | Narrow textual reader, high citation standards               |
| **Independent Voice**     | Not in any bloc AND sole_dissenter_count ≥ 2                     | Votes against the group with rationale, principled dissenter |
| **Pragmatic Interpreter** | interpretation_stance mostly 'broad' AND approval rate ≥ 70%     | Reads constitution expansively, tends to approve             |
| **Silent Voter**          | Rationale provision rate < 40%                                   | Votes but rarely explains why — accountability red flag      |
| **New Guardian**          | Authorization epoch within last 2 epochs                         | Too new to classify — watch for emerging patterns            |

Fallback: "Active Member" if no rule matches.

---

## Workstreams

### WS-1: Database Schema & Migrations

**What**: Create all 8 new tables with indexes and RLS policies.

**Files**:

- **NEW**: Supabase migration via MCP
- **MODIFY**: `npm run gen:types` → commit updated `types/database.ts`

**RLS**: All tables read-public (no auth required for read). Write restricted to service role only (Inngest functions).

**Decision point**: None — execute directly.

---

### WS-2: Computational Intelligence Pipeline (Inngest)

**What**: `computeCcRelations` function — agreement matrix, bloc detection, archetype classification. Pure computation, no AI calls.

**Files**:

- **NEW**: `inngest/functions/compute-cc-relations.ts`
- **NEW**: `lib/cc/blocDetection.ts` — clustering algorithm
- **NEW**: `lib/cc/archetypeClassification.ts` — rule-based archetype assignment
- **MODIFY**: `app/api/inngest/route.ts` — register new function

**Implementation details**:

The bloc detection algorithm (single-linkage agglomerative clustering):

```typescript
// lib/cc/blocDetection.ts

interface AgreementEntry {
  memberA: string;
  memberB: string;
  agreementPct: number;
}

interface BlocAssignment {
  blocLabel: string;
  members: string[];
  internalAgreementPct: number;
}

const BLOC_THRESHOLD = 80; // minimum internal agreement to form a bloc

export function detectBlocs(agreements: AgreementEntry[]): BlocAssignment[] {
  // Build adjacency: members connected if agreement >= threshold
  const members = new Set<string>();
  const edges = new Map<string, Set<string>>();

  for (const { memberA, memberB, agreementPct } of agreements) {
    members.add(memberA);
    members.add(memberB);
    if (agreementPct >= BLOC_THRESHOLD) {
      if (!edges.has(memberA)) edges.set(memberA, new Set());
      if (!edges.has(memberB)) edges.set(memberB, new Set());
      edges.get(memberA)!.add(memberB);
      edges.get(memberB)!.add(memberA);
    }
  }

  // Find connected components (blocs)
  const visited = new Set<string>();
  const blocs: string[][] = [];

  for (const member of members) {
    if (visited.has(member)) continue;
    const component: string[] = [];
    const queue = [member];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of edges.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    blocs.push(component);
  }

  // Label blocs, compute internal agreement
  let blocIndex = 0;
  return blocs.map((members) => {
    if (members.length < 2) {
      return { blocLabel: 'Independent', members, internalAgreementPct: 100 };
    }

    // Compute average pairwise agreement within bloc
    let totalAgreement = 0;
    let pairCount = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const entry = agreements.find(
          (a) =>
            (a.memberA === members[i] && a.memberB === members[j]) ||
            (a.memberA === members[j] && a.memberB === members[i]),
        );
        if (entry) {
          totalAgreement += entry.agreementPct;
          pairCount++;
        }
      }
    }

    blocIndex++;
    return {
      blocLabel: `Bloc ${String.fromCharCode(64 + blocIndex)}`,
      members,
      internalAgreementPct: pairCount > 0 ? totalAgreement / pairCount : 0,
    };
  });
}
```

**Verification**: Run against current `cc_votes` data. Verify agreement matrix produces meaningful variance (not all 95%+). If variance is low, adjust bloc threshold.

---

### WS-3: AI Rationale Analysis Pipeline (Inngest)

**What**: `analyzeCcRationales` function — deep AI analysis of each CC rationale, interpretation tracking, precedent linking.

**Files**:

- **NEW**: `inngest/functions/analyze-cc-rationales.ts`
- **NEW**: `lib/cc/rationaleAnalysis.ts` — prompt construction + response parsing
- **NEW**: `lib/cc/precedentLinker.ts` — precedent detection + classification
- **MODIFY**: `inngest/functions/sync-cc-rationales.ts` — emit `cc/rationales.synced` event on completion
- **MODIFY**: `app/api/inngest/route.ts` — register new function

**Cost control**:

- Use `MODELS.FAST` (Sonnet) for rationale analysis — sufficient quality, lower cost
- Batch 5 rationales per step to stay within Inngest step duration limits
- Cache: never re-analyze a rationale (unique constraint on table)
- Estimated cost: ~$0.02 per rationale × ~50 rationales/epoch = ~$1/epoch

**Error handling**: If a single rationale analysis fails, log the error and continue with the next. Mark failed rationales for retry on next run. The pipeline must never block on a single failure.

---

### WS-4: AI Briefing & Prediction Pipeline (Inngest)

**What**: `generateCcBriefing` function — committee briefings, member dossiers, predictive signals.

**Files**:

- **NEW**: `inngest/functions/generate-cc-briefing.ts`
- **NEW**: `lib/cc/briefingGenerator.ts` — prompt construction + response parsing
- **NEW**: `lib/cc/predictiveSignals.ts` — prediction logic + prompt
- **MODIFY**: `app/api/inngest/route.ts` — register new function

**Staleness management**:

- Hash all input data; skip regeneration if hash unchanged
- Force regeneration at epoch boundaries regardless of hash
- Member dossiers: regenerate when new rationale analysis available for that member
- Predictions: regenerate when new CC votes observed for the proposal
- TTL: briefs expire after 5 epochs (auto-cleaned)

**Persona variants**:

- `citizen`: Plain language, significance-focused, no jargon, shorter
- `drep`: How CC decisions affect DRep governance, tension analysis
- `researcher`: Full data references, methodology notes, longer
- `default`: Balanced (used on public pages without persona detection)

---

### WS-5: API Layer

**What**: Extend existing committee API and create new endpoints.

**Files**:

- **MODIFY**: `app/api/governance/committee/route.ts` — add agreement matrix, bloc data, archetype data to response
- **NEW**: `app/api/governance/committee/[ccHotId]/route.ts` — member intelligence endpoint (dossier, pairwise alignment, interpretation history, key finding)
- **NEW**: `app/api/governance/committee/briefing/route.ts` — committee briefing (persona-variant)
- **NEW**: `app/api/governance/committee/predict/route.ts` — predictive signals for pending proposals
- **MODIFY**: `hooks/queries.ts` — new TanStack Query hooks

**Response shapes**:

```typescript
// Enhanced GET /api/governance/committee
{
  members: CommitteeMemberQuickView[],  // existing
  health: CCHealthSummary,               // existing
  stats: CCCommitteeStats,               // existing
  // NEW:
  agreementMatrix: {
    memberA: string;
    memberB: string;
    agreementPct: number;
    totalSharedProposals: number;
  }[],
  blocs: {
    label: string;
    members: string[];
    internalAgreementPct: number;
  }[],
  archetypes: {
    ccHotId: string;
    label: string;
    description: string;
    mostAlignedMember: string | null;
    mostDivergentMember: string | null;
  }[],
  briefing: {
    headline: string;
    executiveSummary: string;
    keyFindings: { finding: string; severity: string }[];
    whatChanged: string[];
  } | null,
}

// NEW: GET /api/governance/committee/[ccHotId]
{
  dossier: {
    executiveSummary: string;
    keyFinding: string;
    behavioralPatterns: string;
    constitutionalProfile: string;
  } | null,
  chamberPosition: {
    mostAligned: { name: string; pct: number };
    mostDivergent: { name: string; pct: number };
    blocLabel: string;
    soleDissenterCount: number;
    soleDissenterProposals: { txHash: string; index: number; title: string }[];
  },
  pairwiseAlignment: {
    memberId: string;
    memberName: string;
    agreementPct: number;
    sharedProposals: number;
  }[],
  interpretationHistory: {
    article: string;
    entries: {
      proposalTitle: string;
      epoch: number;
      stance: string;
      summary: string;
      consistentWithPrior: boolean;
    }[];
  }[],
  rationaleAnalyses: {
    proposalTitle: string;
    deliberationQuality: number;
    notableFinding: string | null;
    findingSeverity: string | null;
  }[],
}

// NEW: GET /api/governance/committee/predict
{
  predictions: {
    proposalTxHash: string;
    proposalIndex: number;
    proposalTitle: string;
    predictedOutcome: string;
    predictedSplit: { yes: string[]; no: string[]; uncertain: string[] };
    confidence: number;
    reasoning: string;
    keyArticle: string;
    tensionFlag: boolean;
  }[],
  accuracy: {
    totalPredictions: number;
    correct: number;
    accuracyPct: number;
  },
}
```

---

### WS-6: Frontend — The Chamber (Committee Overview)

**What**: Rebuild `/governance/committee` with the heatmap as dominant element.

**Files**:

- **NEW**: `components/cc/CCHeatmap.tsx` — interactive agreement heatmap
- **NEW**: `components/cc/CCBlocBadges.tsx` — detected bloc indicators
- **NEW**: `components/cc/CCBriefingCard.tsx` — AI briefing display
- **MODIFY**: `app/governance/committee/page.tsx` — restructure layout
- **MODIFY**: `hooks/queries.ts` — update `useCommitteeMembers` hook for new data

**Layout (top to bottom)**:

1. **CCHealthVerdict** (existing) — enhanced with briefing headline replacing the static narrative. If briefing exists, show the AI headline. Otherwise fall back to the existing narrative.

2. **CCBriefingCard** (new) — "What changed this epoch" bullets + key findings with severity badges. Collapsible full executive summary. Persona-adapted via `useSegment()`.

3. **CCHeatmap** (new, DOMINANT) — Interactive N×N grid:
   - Rows and columns = CC members (sorted by fidelity score)
   - Cell color: gradient from deep green (95%+ agreement) through neutral (60-70%) to deep red (<40% agreement)
   - Cell shows percentage on hover/tap
   - Tap a cell → slide-out panel showing the specific proposals where those two members agreed/disagreed
   - Diagonal cells show member's own fidelity score
   - Mobile: horizontal scroll with sticky first column (member names)
   - Accessible: screen reader support with aria labels ("Member A and Member B agree 87% of the time")

4. **CCBlocBadges** (new) — Horizontal row of bloc indicators:
   - "Bloc A: Member1, Member2, Member3 (92% internal agreement)"
   - "Independent: Member4, Member5"
   - Or: "No clear blocs — independent voting patterns" if no bloc meets threshold
   - Each member name is a link to their profile

5. **Member Directory** (existing `MemberRow`/`MemberCard`, demoted) — Below the fold. Each row enhanced with:
   - Archetype badge (e.g., "Treasury Guardian" in a subtle chip)
   - Keep: rank, grade, fidelity bar, narrative verdict

6. **Methodology** (existing, collapsed) — Keep as-is

**What to remove**:

- 4 aggregate stat cards (Active Members, Proposals Reviewed, Avg Rationale Rate, Total Votes) — health verdict + heatmap convey this
- CCInsightCard — replaced by CCBriefingCard which is more intelligent

---

### WS-7: Frontend — Enhanced Member Profile

**What**: Enhance `/governance/committee/[id]` with chamber position, AI dossier, interpretation profile.

**Files**:

- **NEW**: `components/cc/CCKeyFinding.tsx` — prominent AI-generated callout
- **NEW**: `components/cc/CCChamberPosition.tsx` — pairwise alignment summary
- **NEW**: `components/cc/CCInterpretationProfile.tsx` — per-article interpretation history
- **NEW**: `components/cc/CCDossierSummary.tsx` — AI executive summary
- **MODIFY**: `components/cc/CCMemberProfileClient.tsx` — integrate new sections
- **MODIFY**: `app/governance/committee/[ccHotId]/page.tsx` — fetch new data

**Enhanced Hero**:

- Existing: Name, grade badge, score card, status badges, term info
- **ADD**: Archetype badge below name (e.g., "Treasury Guardian" with icon)
- **ADD**: Chamber position line: "Agrees most with [Name] (94%) · Diverges most from [Name] (61%)"
- **ADD**: Bloc assignment badge (if in a bloc): "Bloc A · 3 members"

**New section after hero: CCKeyFinding** (above key stats):

- Prominent callout card with left border accent (amber for noteworthy, red for concern)
- Shows the AI-generated key finding: "Has never cited Article III despite voting on 4 hard fork proposals"
- Small "Based on AI analysis" label with info tooltip explaining methodology
- Falls back to deterministic finding (e.g., blind spot data) if no AI analysis yet

**New section: CCDossierSummary** (between key stats and overview mode):

- AI-generated executive summary paragraph (from `cc_intelligence_briefs`)
- Collapsible "Full analysis" expanding to behavioral patterns + constitutional profile
- Falls back gracefully to existing narrative verdict if dossier not yet generated

**Overview mode enhancements**:

- Recent votes: add significance badges on non-unanimous decisions
- Add sole dissenter indicators (icon + "Only dissenter" badge) on relevant votes

**Deep mode — new tabs**:

- **"Chamber" tab** (new): CCChamberPosition showing pairwise alignment with every other CC member as horizontal bars + the proposals driving each relationship
- **"Interpretation" tab** (new): CCInterpretationProfile showing per-article interpretation history as a timeline. Each entry: proposal name, epoch, stance (strict/moderate/broad), consistency indicator (green check if consistent, amber warning if drifted). Groups by article.
- Existing tabs (Votes, Reasoning, Alignment, Trend) kept and enhanced with significance badges

---

### WS-8: Frontend — Predictions Panel

**What**: Display predictive signals on committee and proposal pages.

**Files**:

- **NEW**: `components/cc/CCPredictions.tsx` — predictions for pending proposals
- **MODIFY**: `app/governance/committee/page.tsx` — add predictions section (below heatmap, above directory)
- **MODIFY**: Proposal pages (future integration point) — show predicted CC vote

**Display**:

- Section header: "Predicted CC Votes" with accuracy badge ("72% accurate on 18 predictions")
- Each pending proposal card shows:
  - Proposal title + type
  - Predicted outcome badge (Approve/Reject/Split)
  - Mini vote split: 7 small circles colored by prediction (green=yes, red=no, gray=uncertain)
  - Confidence percentage
  - Key article driving the prediction
  - Tension flag if CC prediction diverges from DRep sentiment
- Collapsible reasoning text per prediction
- DepthGate: only show to `informed` and above (not `hands_off`)

---

## Chunk Execution Plan

Organized for parallel execution. Each chunk = 1 PR.

| Chunk | Workstream | Name                                                  | Priority | Effort | Depends On  | PR Group            |
| ----- | ---------- | ----------------------------------------------------- | -------- | ------ | ----------- | ------------------- |
| 1     | WS-1       | Database schema + migrations                          | P0       | M      | None        | A                   |
| 2     | WS-2       | Computational pipeline (agreement, blocs, archetypes) | P0       | L      | Chunk 1     | B                   |
| 3     | WS-3       | AI rationale analysis pipeline                        | P0       | L      | Chunk 1     | B (parallel with 2) |
| 4     | WS-5       | API layer (enhanced committee + new endpoints)        | P0       | M      | Chunks 2, 3 | C                   |
| 5     | WS-6       | Frontend: The Chamber (heatmap + blocs + briefing)    | P0       | L      | Chunk 4     | D                   |
| 6     | WS-7       | Frontend: Enhanced member profile                     | P0       | L      | Chunk 4     | D (parallel with 5) |
| 7     | WS-4       | AI briefing + prediction pipeline                     | P1       | L      | Chunks 2, 3 | E                   |
| 8     | WS-8       | Frontend: Predictions panel                           | P1       | M      | Chunks 4, 7 | F                   |
| 9     | —          | Data validation + backfill                            | P0       | M      | Chunks 2, 3 | B                   |
| 10    | —          | Mobile polish + accessibility                         | P1       | M      | Chunks 5, 6 | G                   |

**Parallelization opportunities**:

- Chunks 2 + 3 run in parallel (both depend only on schema)
- Chunks 5 + 6 run in parallel (both depend only on API)
- Chunk 9 runs alongside 2+3 (validates data quality)

**Critical path**: 1 → (2 || 3) → 4 → (5 || 6) → deploy

**Total estimated effort**: ~4-5 weeks with parallel execution across 2 agents.

---

## Risk Assessment

| Risk                                                           | Likelihood    | Impact                              | Mitigation                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agreement matrix shows no variance (all members vote the same) | **CONFIRMED** | High — heatmap becomes boring       | **VALIDATED 2026-03-15**: 42/43 unanimous. PIVOT: Heatmap defaults to "Reasoning Similarity" (article citation Jaccard overlap). Rationale data has strong variance (1-8 unique articles per member, different constitutional sections). Near-unanimity itself is a key briefing finding. |
| AI analysis quality inconsistent                               | Medium        | Medium — bad findings erode trust   | Use structured prompts with explicit scoring rubrics. Add `model_version` tracking. Human review first 10 analyses. Add "AI-generated" label on all AI content.                                                                                                                           |
| Claude API cost exceeds budget                                 | Low           | Low — total volume is tiny          | ~50 rationales/epoch × $0.02 = $1/epoch. Briefings + predictions add ~$0.50. Total: <$2/epoch. Cache aggressively.                                                                                                                                                                        |
| Predictions embarrassingly wrong                               | Medium        | Medium — undermines credibility     | Show accuracy track record prominently. Cap confidence at 75% for small sample sizes. Frame as "signal" not "forecast." Hide predictions until ≥10 historical predictions exist for accuracy baseline.                                                                                    |
| Constitutional articles not standardized in rationale text     | High          | Medium — fuzzy matching needed      | Already handled by existing `EXPECTED_ARTICLES` fuzzy matching. AI analysis provides additional normalization.                                                                                                                                                                            |
| Mobile heatmap usability                                       | Medium        | Medium — 7×7 grid is tight on phone | Horizontal scroll with sticky names. Fallback on <640px: show as sorted list of "Strongest agreements" and "Notable divergences" instead of grid.                                                                                                                                         |

---

## Success Metrics

**Launch day**:

- [ ] Heatmap renders with real agreement data for all active CC members
- [ ] At least 1 bloc detected OR "Independent voting patterns" correctly displayed
- [ ] All active members have archetype labels
- [ ] AI analysis completed for ≥80% of existing rationales
- [ ] Committee briefing generated with real findings
- [ ] Member dossiers generated for all active members
- [ ] At least 1 predictive signal generated for a pending proposal (if any exist)

**30 days post-launch**:

- [ ] Prediction accuracy tracking shows ≥60% on ≥5 predictions
- [ ] No AI "hallucination" reports from community
- [ ] Committee page engagement ≥ 2x current (PostHog: `governance_committee_viewed`)
- [ ] Member profile depth: ≥30% of profile visitors reach deep mode (vs current baseline)
- [ ] At least 1 community/media citation of Governada's constitutional intelligence

**Long-term moat indicators**:

- [ ] Interpretation history covers ≥3 epochs per CC member
- [ ] Precedent graph has ≥10 linked decisions
- [ ] Prediction accuracy improves over time (rolling 30-day window)
- [ ] Community treats Governada as the authoritative source for CC accountability

---

## Migration Path from Current Implementation

This is an enhancement, not a rewrite. The existing committee pages continue working throughout the build. New features are additive:

1. **Heatmap** replaces ranked list as dominant element, but the list stays (demoted to "Member Directory")
2. **CCHealthVerdict** stays — enhanced with AI headline when available
3. **Member profile** keeps all existing sections — new sections (key finding, dossier, chamber position) are added above/between
4. **Compare page** remains functional — becomes less important as pairwise data appears everywhere
5. **Data page** remains functional — enhanced with new analysis data in exports
6. **All existing scoring** (3-pillar fidelity) remains unchanged — AI analysis is additive intelligence on top

No existing routes change. No existing components are deleted. The build is purely additive until launch, at which point the aggregate stat cards and CCInsightCard can be removed in a cleanup PR.

---

## Files Reference

### New Files (20)

| File                                              | Purpose                                        |
| ------------------------------------------------- | ---------------------------------------------- |
| `inngest/functions/compute-cc-relations.ts`       | Agreement matrix + bloc detection + archetypes |
| `inngest/functions/analyze-cc-rationales.ts`      | AI rationale deep analysis                     |
| `inngest/functions/generate-cc-briefing.ts`       | AI briefings + dossiers + predictions          |
| `lib/cc/blocDetection.ts`                         | Clustering algorithm                           |
| `lib/cc/archetypeClassification.ts`               | Rule-based archetype assignment                |
| `lib/cc/rationaleAnalysis.ts`                     | AI prompt construction + response parsing      |
| `lib/cc/precedentLinker.ts`                       | Precedent detection + classification           |
| `lib/cc/briefingGenerator.ts`                     | Briefing prompt construction                   |
| `lib/cc/predictiveSignals.ts`                     | Prediction logic + prompt                      |
| `app/api/governance/committee/[ccHotId]/route.ts` | Member intelligence API                        |
| `app/api/governance/committee/briefing/route.ts`  | Committee briefing API                         |
| `app/api/governance/committee/predict/route.ts`   | Predictive signals API                         |
| `components/cc/CCHeatmap.tsx`                     | Interactive agreement heatmap                  |
| `components/cc/CCBlocBadges.tsx`                  | Bloc indicators                                |
| `components/cc/CCBriefingCard.tsx`                | AI briefing display                            |
| `components/cc/CCKeyFinding.tsx`                  | AI key finding callout                         |
| `components/cc/CCChamberPosition.tsx`             | Pairwise alignment view                        |
| `components/cc/CCInterpretationProfile.tsx`       | Article interpretation timeline                |
| `components/cc/CCDossierSummary.tsx`              | AI executive summary                           |
| `components/cc/CCPredictions.tsx`                 | Predictive signals panel                       |

### Modified Files (8)

| File                                          | Change                               |
| --------------------------------------------- | ------------------------------------ |
| `app/api/inngest/route.ts`                    | Register 3 new functions             |
| `inngest/functions/sync-cc-rationales.ts`     | Emit completion event                |
| `app/api/governance/committee/route.ts`       | Add relations + briefing to response |
| `app/governance/committee/page.tsx`           | Restructure with heatmap + briefing  |
| `app/governance/committee/[ccHotId]/page.tsx` | Fetch new intelligence data          |
| `components/cc/CCMemberProfileClient.tsx`     | Integrate new sections + tabs        |
| `hooks/queries.ts`                            | New hooks + enhanced types           |
| `types/database.ts`                           | Regenerated after migration          |
