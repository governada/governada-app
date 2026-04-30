# Product Registry

> **Purpose:** Agent-readable feature catalog. Organized by capability domain (not build phase). Read this FIRST in any planning session to understand what exists before recommending changes.
> **Last manual review:** 2026-03-30
> **Maintenance:** Any PR adding a feature, route, hook, or lib module MUST update this file.
> **Deep dive:** Domain detail files in `docs/strategy/context/registry/<domain>.md`

---

## Scoring & Reputation

Deterministic scoring models powering trust signals, discovery, and accountability.

| Feature                              | Routes                                      | Key Files                                                           | Status                            |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| DRep Score V3 (4-pillar: EQ/EP/R/GI) | `/drep/[id]`, `/governance/representatives` | `lib/scoring/drepScore.ts`, `lib/scoring/percentile.ts`             | Shipped                           |
| SPO Governance Score (4-pillar)      | `/pool/[id]`, `/governance/pools`           | `lib/scoring/spoScore.ts`, `lib/scoring/spoDeliberation.ts`         | Shipped                           |
| CC Transparency Index                | `/governance/committee/[id]`                | `lib/scoring/ccTransparency.ts`                                     | Shipped                           |
| GHI (6 components + 7 EDI metrics)   | `/governance/health`, `/pulse`              | `lib/ghi/`, `lib/ghi.ts`                                            | Shipped                           |
| Citizen Impact Score                 | `/you/identity`                             | `lib/citizenImpactScore.ts`, `lib/citizenCredibility.ts`            | Shipped (display pending Phase 2) |
| Score history snapshots              | —                                           | `drep_score_history`, `spo_score_snapshots`, `ghi_snapshots` tables | Shipped                           |
| Tier system (5 tiers)                | All entity profiles                         | `lib/scoring/drepScore.ts` (tier thresholds)                        | Shipped                           |
| Gaming detection                     | —                                           | `lib/scoring/gamingDetection.ts`                                    | Shipped                           |

**Detail:** `registry/scoring.md`

---

## Matching & Discovery

PCA-based alignment + matching engine for DRep/Pool discovery.

| Feature                    | Routes                                   | Key Files                                          | Status  |
| -------------------------- | ---------------------------------------- | -------------------------------------------------- | ------- |
| Quick Match (PCA 6D)       | `/match`, `/match/vote`, `/match/result` | `lib/matching/`, `lib/alignment/`                  | Shipped |
| Conversational Match       | `/match` (Seneca-driven)                 | `hooks/useConversationalMatch.ts`, `lib/matching/` | Shipped |
| Pool Match                 | `/match` (pool tab)                      | `lib/matching/` (match_type param)                 | Shipped |
| 6D PCA alignment system    | —                                        | `lib/alignment/`, `lib/alignment.ts`               | Shipped |
| AI proposal classification | —                                        | `lib/alignment/classifyProposal.ts`                | Shipped |
| Proposal similarity        | Proposal pages                           | `lib/proposalSimilarity.ts`, `lib/similarity.ts`   | Shipped |
| Semantic embeddings        | Cross-feature                            | `lib/embeddings/`, `generate-embeddings` Inngest   | Shipped |

**Detail:** `registry/matching.md`

---

## Engagement Mechanisms

7 structured civic engagement tools (signal > noise, no forums).

| Feature                                 | Routes               | Key Files                                                        | Status  |
| --------------------------------------- | -------------------- | ---------------------------------------------------------------- | ------- |
| Proposal Sentiment (stake-weighted)     | Proposal pages, Hub  | `lib/engagement/`, `components/engagement/ProposalSentiment.tsx` | Shipped |
| Priority Signals (ranked-choice)        | Proposal pages       | `components/engagement/PrioritySignals.tsx`                      | Shipped |
| Concern Flags                           | Proposal pages       | `components/engagement/ConcernFlags.tsx`                         | Shipped |
| Impact Tags                             | Funded project pages | `components/engagement/ImpactTags.tsx`                           | Shipped |
| Citizen Questions (proposal-linked)     | Proposal pages       | `components/DRepQuestionsInbox.tsx`                              | Shipped |
| Citizen Assemblies (AI-generated)       | —                    | `generate-citizen-assembly` Inngest                              | Shipped |
| Citizen Endorsements                    | DRep profiles        | `components/engagement/CitizenEndorsements.tsx`                  | Shipped |
| Engagement integrity (anti-spam/quorum) | —                    | `lib/engagement/` (integrity module)                             | Shipped |
| Engagement -> score feedback loop       | —                    | `lib/engagement/` -> `lib/scoring/`                              | Shipped |

**Detail:** `registry/engagement.md`

---

## Workspace & Authoring

DRep/SPO operational workspace: proposal authoring, review, voting, delegation management.

| Feature                        | Routes                                        | Key Files                                                      | Status  |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------------------- | ------- |
| Proposal authoring (CIP-108)   | `/workspace/author`, `/workspace/author/[id]` | `lib/workspace/`, `components/workspace/author/`               | Shipped |
| Draft lifecycle (5 stages)     | `/workspace/author/[id]`                      | `hooks/useDraftActions.ts`, `hooks/useDrafts.ts`               | Shipped |
| Community review system        | `/workspace/author/[id]`                      | `hooks/useReviewableDrafts.ts`, `hooks/useDraftReviews.ts`     | Shipped |
| Review queue + intelligence    | `/workspace/review`                           | `hooks/useReviewQueue.ts`, `components/workspace/review/`      | Shipped |
| On-chain voting (CIP-95)       | `/workspace/review`                           | `hooks/useVote.ts`, `VoteCastingPanel.tsx`                     | Shipped |
| Rationale submission (CIP-100) | `/workspace/review`                           | `lib/rationale.ts`                                             | Shipped |
| Decision journal               | `/workspace/review`                           | `hooks/useDecisionJournal.ts`                                  | Shipped |
| Inline annotations             | `/workspace/review`, `/workspace/editor/[id]` | `hooks/useAnnotations.ts`, `hooks/useSuggestionAnnotations.ts` | Shipped |
| Team collaboration             | `/workspace/author/[id]`                      | `hooks/useTeam.ts`, `hooks/useTeamApprovals.ts`                | Shipped |
| Submission ceremony            | `/workspace/author/[id]/submit`               | `components/workspace/author/`                                 | Shipped |
| Post-vote monitoring           | `/workspace/author/[id]/monitor`              | `hooks/useProposalMonitor.ts`                                  | Shipped |
| Action queue                   | `/workspace`                                  | `hooks/useActionQueue.ts`, `lib/actionQueue.ts`                | Shipped |
| DRep delegator management      | `/workspace/delegators`                       | `components/workspace/DelegatorInsights.tsx`                   | Shipped |
| SPO pool profile               | `/workspace/pool-profile`                     | `components/PoolProfileClient.tsx`                             | Shipped |
| Position statements            | `/workspace/position`                         | `components/PositionStatementEditor.tsx`                       | Shipped |
| Amendment authoring            | `/workspace/amendment/[id]`                   | `hooks/useAmendmentBridging.ts`                                | Shipped |
| AI skills engine               | —                                             | `lib/ai/skills/`, `hooks/useAISkill.ts`                        | Shipped |
| Review templates               | `/workspace/review`                           | `hooks/useReviewTemplate.ts`                                   | Shipped |
| Version diff engine            | `/workspace/author/[id]`                      | `hooks/useRevision.ts`                                         | Shipped |

**Detail:** `registry/workspace.md`

---

## AI & Intelligence (Seneca)

AI companion + narrative generation + classification + research.

| Feature                          | Routes                    | Key Files                                                                       | Status  |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------- | ------- |
| Seneca conversational panel      | All pages (panel)         | `hooks/useSenecaThread.ts`, `components/governada/panel/SenecaConversation.tsx` | Shipped |
| Seneca memory system             | —                         | `hooks/useSenecaMemory.ts`                                                      | Shipped |
| Seneca search                    | —                         | `hooks/useSenecaSearch.ts`                                                      | Shipped |
| Seneca ghost prompts             | —                         | `hooks/useSenecaGhostPrompts.ts`, `hooks/useSenecaProactiveWhispers.ts`         | Shipped |
| Seneca-globe bridge              | Homepage                  | `hooks/useSenecaGlobeBridge.ts`                                                 | Shipped |
| Seneca annotations               | Entity pages              | `hooks/useSenecaAnnotations.ts`                                                 | Shipped |
| Governance briefs (AI-generated) | `/governance/briefing`    | `lib/governanceBrief.ts`, `generate-governance-brief` Inngest                   | Shipped |
| Proposal briefs                  | Proposal pages            | `lib/proposalBrief.ts`, `generate-proposal-briefs` Inngest                      | Shipped |
| Citizen briefings                | Hub                       | `generate-citizen-briefings` Inngest                                            | Shipped |
| CC briefings                     | `/governance/committee`   | `generate-cc-briefing` Inngest                                                  | Shipped |
| Epoch recaps/summaries           | `/governance`, Hub        | `generate-epoch-summary` Inngest                                                | Shipped |
| State of Governance              | —                         | `lib/stateOfGovernance.ts`, `generate-state-of-governance` Inngest              | Shipped |
| Constitutional analysis          | Proposal pages, Workspace | `lib/constitution.ts`, AI skills                                                | Shipped |
| Proposal intelligence            | Workspace review          | `precompute-proposal-intelligence` Inngest                                      | Shipped |
| Rationale quality scoring        | —                         | `lib/ai/`, `score-ai-quality` Inngest                                           | Shipped |
| Editorial headlines              | Hub                       | `lib/editorialHeadline.ts`                                                      | Shipped |
| Research assistant               | Workspace                 | `hooks/useResearchAssistant.ts`                                                 | Shipped |
| BYOK (bring your own key)        | Settings                  | `hooks/useBYOKKeys.ts`                                                          | Shipped |

**Detail:** `registry/ai-features.md`

---

## Hub & Home

Persona-adaptive homepage with card system + globe visualization.

| Feature                            | Routes       | Key Files                                                        | Status      |
| ---------------------------------- | ------------ | ---------------------------------------------------------------- | ----------- |
| Hub card system                    | `/`          | `components/hub/HubCardRenderer.tsx`, `components/hub/cards/`    | Shipped     |
| Persona-adaptive MLEs (4 personas) | `/`          | `components/governada/home/Home{Citizen,DRep,SPO,Anonymous}.tsx` | Shipped     |
| Globe constellation                | `/`          | `components/globe/`, `lib/constellation/`, `lib/globe/`          | Shipped     |
| Globe-Seneca bridge                | `/`          | `hooks/useSenecaGlobeBridge.ts`                                  | In progress |
| Epoch briefing                     | `/`          | `components/governada/home/EpochBriefing.tsx`                    | Shipped     |
| Civic identity card                | Hub, `/you`  | `components/governada/shared/CivicIdentityCard.tsx`              | Shipped     |
| Treasury citizen view              | Hub          | `components/governada/home/TreasuryCitizenView.tsx`              | Shipped     |
| Anonymous landing                  | `/`          | `components/governada/home/HomeAnonymous.tsx`                    | Shipped     |
| Anonymous nudges                   | Browse pages | `AnonymousNudge` component                                       | Shipped     |

**Detail:** `registry/hub.md` (included in governance-browse)

---

## Governance Browse

Directories, exploration, and transparency surfaces.

| Feature                | Routes                             | Key Files                            | Status  |
| ---------------------- | ---------------------------------- | ------------------------------------ | ------- |
| DRep directory         | `/governance/representatives`      | `GovernadaDRepBrowse.tsx`            | Shipped |
| SPO/Pool directory     | `/governance/pools`                | `GovernadaSPOBrowse.tsx`             | Shipped |
| CC transparency        | `/governance/committee`            | `app/governance/committee/`          | Shipped |
| CC comparison          | `/governance/committee/compare`    | `components/cc/CCComparisonView.tsx` | Shipped |
| Proposal browse        | `/governance/proposals`            | `ProposalsBrowse.tsx`                | Shipped |
| Treasury transparency  | `/governance/treasury`             | `TreasuryOverview.tsx`               | Shipped |
| GHI dashboard          | `/governance/health`               | `GovernanceHealthIndex.tsx`          | Shipped |
| GHI epoch history      | `/governance/health/epoch/[epoch]` | `app/governance/health/`             | Shipped |
| GHI methodology        | `/governance/health/methodology`   | `components/governada/methodology/`  | Shipped |
| Leaderboard            | `/governance/leaderboard`          | `PulseLeaderboardClient.tsx`         | Shipped |
| Observatory            | `/governance/observatory`          | `GovernanceObservatory.tsx`          | Shipped |
| Governance report      | `/governance/report/[epoch]`       | `app/governance/report/`             | Shipped |
| Pulse (live activity)  | `/pulse`                           | `app/pulse/`                         | Shipped |
| Compare (side-by-side) | `/compare`                         | `app/compare/page.tsx`               | Shipped |

**Detail:** `registry/governance-browse.md`

---

## Identity & Profiles

Entity profiles, civic identity, wrapped/share, OG images.

| Feature                  | Routes                           | Key Files                                                | Status  |
| ------------------------ | -------------------------------- | -------------------------------------------------------- | ------- |
| DRep profiles            | `/drep/[id]`                     | `DRepProfileHero.tsx`, `DRepProfileTabs.tsx`             | Shipped |
| SPO profiles             | `/pool/[id]`                     | `PoolGovernanceCard.tsx`                                 | Shipped |
| CC member profiles       | `/governance/committee/[id]`     | `components/cc/CCMemberProfileClient.tsx`                | Shipped |
| Proposal detail          | `/proposal/[tx]/[i]`             | `app/proposal/[txHash]/[index]/page.tsx`                 | Shipped |
| Civic identity page      | `/you/identity`                  | `components/governada/identity/CivicIdentityProfile.tsx` | Shipped |
| Governance Rings         | `/you`, profiles                 | `components/governada/identity/GovernanceRings.tsx`      | Shipped |
| Milestone system         | `/you`                           | `lib/citizenMilestones.ts`, `lib/milestones.ts`          | Shipped |
| Wrapped (all entities)   | `/wrapped/[type]/[id]/[period]`  | `generate-governance-wrapped` Inngest                    | Shipped |
| OG image generation      | `/api/og/*` (30+ routes)         | `app/api/og/`, `lib/og-utils.tsx`                        | Shipped |
| Share cards + deep links | Various                          | `lib/share.ts`, `components/ShareActions.tsx`            | Shipped |
| Profile claiming (DRep)  | `/claim/[id]`                    | `app/claim/`                                             | Shipped |
| SPO claiming             | —                                | `app/api/spo/claim/`                                     | Shipped |
| Badge embed              | `/api/badge/[id]`                | `components/BadgeEmbed.tsx`                              | Shipped |
| Public profile           | `/you/public-profile`            | `app/you/public-profile/`                                | Shipped |
| Scorecard                | `/you/scorecard`                 | `app/you/scorecard/`                                     | Shipped |
| Delegation health        | `/delegation`, `/you/delegation` | `DelegationIntelligence.tsx`                             | Shipped |

**Detail:** `registry/identity.md`

---

## Sync & Data Pipeline

Inngest-powered sync from Koios/chain to Supabase. 55+ functions.

| Category          | Key Functions                                                                                                                           | Schedule              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Core sync         | `sync-dreps`, `sync-proposals`, `sync-votes`, `sync-spo-cc-votes`                                                                       | Every 5-15 min        |
| Score computation | `sync-drep-scores`, `sync-spo-scores`, `sync-alignment`                                                                                 | After sync            |
| Snapshots         | `snapshot-ghi`, `snapshot-citizen-rings`, `check-snapshot-completeness`                                                                 | Per epoch             |
| AI generation     | `generate-proposal-briefs`, `generate-governance-brief`, `generate-epoch-summary`, `generate-cc-briefing`, `generate-citizen-briefings` | Event-driven          |
| Intelligence      | `precompute-proposal-intelligence`, `precompute-engagement-signals`, `precompute-citizen-summaries`, `compute-community-intelligence`   | Scheduled             |
| Integrity         | `reconcile-data`, `detect-gaming-signals`, `detect-alignment-drift`, `sync-freshness-guard`                                             | Every 2-6h            |
| Alerting          | `alert-api-health`, `alert-inbox`, `alert-integrity`                                                                                    | Every 15 min          |
| Content           | `generate-governance-wrapped`, `generate-weekly-digest`, `generate-drep-epoch-updates`                                                  | Event-driven          |
| Embeddings        | `generate-embeddings`, `generate-user-embedding`                                                                                        | After content changes |
| Secondary         | `sync-secondary`, `sync-slow`, `sync-catalyst`, `sync-treasury-snapshot`, `sync-governance-benchmarks`                                  | Hourly-daily          |

**Key infra:** Inngest self-hosted on Railway (`inngest-server.railway.internal:8288`), registered via `app/api/inngest/route.ts`

**Detail:** `registry/sync-pipeline.md`

---

## Navigation & Shell

App-level UX infrastructure.

| Feature                           | Key Files                                                                    | Status  |
| --------------------------------- | ---------------------------------------------------------------------------- | ------- |
| Desktop navigation rail           | `components/governada/NavigationRail.tsx`                                    | Shipped |
| Mobile bottom nav                 | `components/governada/GovernadaBottomNav.tsx`                                | Shipped |
| Header + search                   | `components/governada/GovernadaHeader.tsx`, `HeaderSenecaInput.tsx`          | Shipped |
| Keyboard shortcuts                | `hooks/useKeyboardShortcuts.ts`, `components/governada/ShortcutProvider.tsx` | Shipped |
| Command palette                   | `components/CommandPalette.tsx`, `lib/commandIndex.ts`                       | Shipped |
| Peek drawer (mobile detail)       | `components/governada/peeks/`, `hooks/usePeekDrawer.ts`                      | Shipped |
| Breadcrumbs                       | `components/governada/HeaderBreadcrumbs.tsx`                                 | Shipped |
| Section tab bar                   | `components/governada/SectionTabBar.tsx`                                     | Shipped |
| Depth/density modes               | `components/providers/ModeProvider.tsx`, `hooks/useDepthConfig.ts`           | Shipped |
| Pull to refresh                   | `components/governada/PullToRefresh.tsx`                                     | Shipped |
| Edge swipe                        | `components/governada/EdgeSwipeMenu.tsx`                                     | Shipped |
| View As (admin persona switching) | `lib/admin/viewAsRegistry.ts`, `components/governada/AdminViewAsPicker.tsx`  | Shipped |
| Epoch context bar                 | `components/governada/EpochContextBar.tsx`                                   | Shipped |
| Feature flags                     | `lib/featureFlags.ts`, `components/FeatureGate.tsx`                          | Shipped |

---

## Cross-Cutting Infrastructure

| Feature                    | Key Files                                                     | Status  |
| -------------------------- | ------------------------------------------------------------- | ------- |
| TanStack Query provider    | `components/Providers.tsx`, `lib/queryClient.ts`              | Shipped |
| Database-first reads       | `lib/data.ts`                                                 | Shipped |
| Wallet connection (MeshJS) | `components/WalletConnectModal.tsx`, `lib/walletDetection.ts` | Shipped |
| PostHog analytics          | `lib/posthog.ts`, `lib/posthog-server.ts`                     | Shipped |
| Sentry monitoring          | `lib/sentry-cron.ts`, `hooks/useSentryContext.ts`             | Shipped |
| Email system               | `lib/email.ts`, `lib/emailTemplates.tsx`                      | Shipped |
| Push notifications         | `lib/push.ts`, `lib/pushSubscription.ts`                      | Shipped |
| Redis caching (Upstash)    | `lib/redis.ts`                                                | Shipped |
| i18n                       | `lib/i18n/`                                                   | Shipped |
| Preview mode               | `lib/preview.ts`                                              | Shipped |
| Data reconciliation        | `lib/reconciliation/`, `reconcile-data` Inngest               | Shipped |
| API v1 (11 public routes)  | `app/api/v1/`                                                 | Shipped |
| Developer page + explorer  | `components/DeveloperPage.tsx`, `components/ApiExplorer.tsx`  | Shipped |
| Embed routes (3)           | `app/embed/`                                                  | Shipped |

---

## What's NOT Shipped (Phase 2-3 gaps)

See `build-manifest.md` for full checklist. Key gaps:

- Hub engagement activation (inline polls/sentiment on Hub cards)
- Anonymous glass window (see engagement results, can't participate)
- Notification pipeline wired to real events
- Conversion funnel instrumentation (PostHog)
- Email collection + epoch digest
- Monetization (Stripe, subscription tiers)
- API v2 + SDK generation
