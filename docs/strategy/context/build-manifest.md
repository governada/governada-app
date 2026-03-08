# Build Manifest (derived from ultimate-vision.md V2.3)

> **Purpose:** Machine-readable audit checklist. Agents verify `[x]` items exist, report `[ ]` items as gaps.
> **Last synced with vision:** 2026-03-08
> **Usage:** `Phase 1 audit` = read this file, verify files/routes/tables. `Phase 2 audit` = read ultimate-vision.md for qualitative alignment.
> **Scoring:** After each `/audit`, record dimension scores in the Audit Score History section at the bottom.

---

## Step 0: Governance Intelligence Engine [COMPLETE]

- [x] DRep Score V3 (4-pillar: EQ 35%, EP 25%, R 25%, GI 15%) | `lib/scoring/drepScore.ts`
- [x] Percentile normalization | `lib/scoring/percentileNormalization.ts`
- [x] Momentum tracking | `lib/scoring/momentum.ts`
- [x] 6D PCA alignment system | `lib/alignment/`
- [x] AI proposal classification | `lib/alignment/classifyProposal.ts`
- [x] GHI with 6 components + 7 EDI metrics | `lib/ghi/`
- [x] Daily score snapshots | table: `drep_score_snapshots`
- [x] Daily alignment snapshots | table: `alignment_snapshots`
- [x] Daily GHI snapshots | table: `ghi_snapshots`
- [x] Daily EDI snapshots | table: `edi_snapshots`
- verify: `GET /api/v1/drep-scores` returns scored DReps

## Step 1: Matching & Personalization [COMPLETE]

- [x] PCA-based Quick Match | `lib/matching/`, `/match` route
- [x] User governance profiles | table: `user_governance_profiles`
- [x] Dimension-level agreement | `lib/matching/dimensionAgreement.ts`
- [x] Persona-agnostic matching (`match_type` param) | `lib/matching/`
- verify: `GET /api/governance/match` returns matched DReps

## Step 2: Cross-Body Intelligence [COMPLETE]

- [x] Treasury intelligence | `/api/treasury/*` (8 routes)
- [x] SPO + CC vote fetching & sync | `lib/sync/`
- [x] Inter-body alignment | table: `inter_body_alignment`
- [x] Governance calendar + AI epoch recaps | table: `epoch_recaps`
- [x] Proposal semantic classification | table: `proposal_similarity_cache`
- [x] Wallet governance footprint | `GovernanceFootprintCard.tsx`
- verify: `GET /api/governance/epoch-recap` returns data

## Step 2.5: SPO Governance Layer [COMPLETE]

- [x] SPO 4-pillar scoring | `lib/scoring/spoScore.ts`
- [x] SPO 6D alignment | `lib/alignment/`
- [x] SPO matching | `lib/matching/`
- [x] CC Transparency Index | `lib/scoring/ccTransparencyIndex.ts`
- [x] SPO score snapshots | table: `spo_score_snapshots`
- [x] SPO alignment snapshots | table: `spo_alignment_snapshots`
- verify: `GET /api/v1/spo-scores` returns scored SPOs

## Step 3: Core Frontend [COMPLETE]

- [x] 33+ page routes | `app/`
- [x] 269+ components | `components/`
- [x] 145+ API endpoints | `app/api/`
- [x] 24 Inngest sync functions | `inngest/functions/`
- [x] 75+ database tables
- [x] Persona-aware homes (HomeCitizen, HomeDRep, HomeSPO) | `components/civica/home/`
- [x] Discover (DRep/SPO/proposal browse) | `app/discover/`
- [x] DRep/SPO/CC profiles | `app/drep/`, `app/spo/`, `app/committee/`
- [x] Pulse observatory | `app/pulse/`
- [x] My Gov command centers | `app/my-gov/`
- [x] Admin dashboard | `app/admin/`
- [x] Quick Match flow | `app/match/`
- [x] Delegation ceremony | `DelegationCeremony.tsx`
- verify: production site loads at https://drepscore.io

## Step 4: Citizen Experience [FOUNDATIONS SHIPPED]

- [x] Epoch Briefing component | `components/civica/home/EpochBriefing.tsx`
- [x] Civic Identity Card | `components/civica/shared/CivicIdentityCard.tsx`
- [x] Treasury Citizen View | `components/civica/home/TreasuryCitizenView.tsx`
- [x] citizen_milestones table | migration 051
- [x] simplified_onboarding feature flag | migration 051
- [x] generate-citizen-briefings Inngest function
- [x] PostHog conversion funnel wired
- [x] Briefing-first citizen home (WP-1) | PR #159
- [x] Citizen milestone detection (WP-4) | PR #159
- [x] Proportional treasury share (WP-5) | PR #159
- [x] Civic Identity Profile page | `app/my-gov/identity/page.tsx`, PR #170
- [ ] SmartAlertManager | not built
- [ ] UX copy optimization + A/B testing | not started
- verify: `GET /api/briefing/citizen` returns data

## Step 5: Governance Workspace [SHIPPED]

- [x] Vote casting (CIP-95/MeshJS) | PR #143
- [x] Rationale submission (CIP-100) | PR #145
- [x] Governance statement (CIP-100 anchoring) | PR #148
- [x] Constitutional alignment analysis | PR #150
- [x] DRep epoch updates | PR #150
- [x] SPO Command Center parity | PR #162
- [x] SPO vote casting | PR #162
- [ ] SPO pool update channel | lower priority, deferred
- verify: vote casting flow accessible from proposal pages

## Step 6: Community Engagement [SHIPPED]

- [x] Proposal Sentiment (stake-weighted DRep view) | PR #157
- [x] Priority Signals (ranked-choice) | PR #157
- [x] Concern Flags | PR #157
- [x] Impact Tags | PR #157
- [x] Citizen Questions (proposal-linked) | PR #157
- [x] Citizen Assemblies (AI-generated) | PR #157
- [x] precompute-engagement-signals Inngest function | PR #157
- [x] /engage page | PR #157
- [x] Engagement -> score feedback loop (WP-7) | PR #161
- [x] Inter-body dynamics narrative (WP-8) | PR #161
- [x] Engagement integrity (anti-spam + quorum) | PR #169
- [ ] Citizen Endorsements (7th mechanism) | deferred
- verify: `/engage` page loads, sentiment voting works

## Step 7: Viral Growth [PARTIALLY COMPLETE]

- [x] Wrapped generation (all entity types) | `generate-governance-wrapped` Inngest
- [x] OG image generation | `app/api/og/`
- [x] Civic identity OG images | PR #170
- [ ] GovernanceImpactScore | not built
- [ ] CivicMilestoneShare | not built
- [ ] Animated share preview generation | not built
- [ ] citizen_impact_scores table | not created

## Step 8: Monetization [NOT STARTED]

- [ ] Subscription infrastructure (Stripe or ADA-native)
- [ ] DRep Pro ($15-25/mo)
- [ ] SPO Pro ($15-25/mo)
- [ ] Premium Delegator ($5-10/mo)
- [ ] Verified Project ($10-25/project)

## Step 9: API Platform [V1 EXISTS]

- [x] 11 public routes at `/api/v1/` | `app/api/v1/`
- [x] Developer page | `DeveloperPage.tsx`
- [x] API explorer | `ApiExplorer.tsx`
- [x] Embed routes | `app/embed/`
- [ ] API v2 expansion
- [ ] Rate limiting tiers (paid)
- [ ] Research tier
- [ ] Embeddable widgets (themeable)
- [ ] OpenAPI spec + SDK generation

## Step 10: Advanced Intelligence [NOT STARTED]

- [ ] Delegation network graph + influence mapping
- [ ] Governance simulation engine
- [ ] delegation_snapshots per-epoch collection

## Step 11: New Product Lines [NOT STARTED]

- [ ] 11a: Catalyst Score
- [ ] 11b: Cross-Ecosystem Governance Identity

---

## Quality Packages (post-vision-parity)

Tracked in `docs/strategy/world-class-packages.md`. 13 QPs targeting 84->95+ score.

| QP       | Name                             | Status            |
| -------- | -------------------------------- | ----------------- |
| QP-1/2   | Accessibility (WCAG 2.1 AA)      | SHIPPED (PR #164) |
| QP-3     | Core algorithm tests             | SHIPPED (PR #165) |
| QP-4     | Error recovery + resilience      | SHIPPED (PR #166) |
| QP-5/6   | Scoring calibration + PCA        | SHIPPED (PR #167) |
| QP-7/8   | Animation + onboarding education | SHIPPED (PR #168) |
| QP-9     | Civic identity elevation         | SHIPPED (PR #170) |
| QP-10/11 | Engagement feedback + integrity  | SHIPPED (PR #169) |
| QP-12    | Citizen endorsements             | NOT STARTED       |
| QP-13    | Load testing + performance       | NOT STARTED       |

---

## Audit Score History

> Updated by `/audit` and `/verify-audit` commands. Tracks score trends across sessions.
> Rubric: `docs/strategy/context/audit-rubric.md` (10 dimensions, 10 pts each = 100 total)

| Date                       | Engine | Citizen | Workspace | Engagement | Data | UX  | Perf | Testing | API | Completeness | Total |
| -------------------------- | ------ | ------- | --------- | ---------- | ---- | --- | ---- | ------- | --- | ------------ | ----- |
| _Run `/audit` to populate_ | —      | —       | —         | —          | —    | —   | —    | —       | —   | —            | —/100 |
