# Governada — Active Work

## Current Phase: Phase 3B (My Gov Completion + DRep Profile Redesign)

See `docs/strategy/ultimate-vision.md` for full build sequence.
See `.cursor/plans/governada_phase_3b_eab7f1b4.plan.md` for this phase's detailed plan.

## Completed

- [x] Governada Shell Foundation (Phase 1A) — PR #77 merged
  - Feature flag `governada_frontend` in feature_flags table
  - SegmentProvider + useSegment() hook
  - TierThemeProvider + useTierTheme() hook
  - GovernadaHeader (desktop) + GovernadaBottomNav (mobile) 4-tab nav
  - Tier color palette + motion tokens in globals.css
  - Root layout branching (old shell when flag off, GovernadaShell when on)
  - /my-gov stub page (auth-gated)

- [x] Governada Phase 1B — GovTerm, Metadata, Home Pages
  - GovTerm component (localStorage progressive dismissal, segment-aware tooltips)
  - 12 governance terms in lib/microcopy.ts GOV_TERMS
  - generateMetadata() on /, /discover, /pulse, /my-gov (Governada-branded)
  - Home/anonymous: constellation hero + value prop + Quick Match CTA + SSR stats
  - Home/citizen: DRep report card, pillar bars, epoch callout
  - Home/DRep: score hero, sparkline, quick win card, competitive context
  - Home/SPO: governance score hero, claim prompt, competitive neighbors
  - GovernadaHomePage segment dispatcher
  - useDRepReportCard, useDashboardCompetitive, useSPOPoolCompetitive hooks

- [x] Governada Phase 2A — Discover, Cards, Leaderboard
  - GovernadaDRepCard: tier-colored browse card with score, tier badge, 6-axis alignment mini-bars, hover expansion
  - GovernadaSPOCard: tier-colored pool card with governance score, participation/consistency/reliability bars, claimed badge
  - tierStyles.ts: shared token map (border/bg/glow/badge per tier)
  - GovernadaDiscover: 5-tab shell (DReps / SPOs / Proposals / Committee / Rankings), sticky tab bar
  - GovernadaDRepBrowse: SSR DRep grid with search, tier filter chips, alignment filter, active-only toggle, 24/page pagination
  - GovernadaSPOBrowse: client-fetched SPO grid with search + tier + claimed filters
  - ProposalsBrowse: lightweight proposal list with search + status filter
  - GovernadaLeaderboard: ranked DRep table with tier filter chips, delta trend arrows, 7-day movers strip, 25/page pagination
  - app/discover/page.tsx + app/pulse/page.tsx: governada_frontend flag-gated rendering

- [x] Governada Phase 2B — Pulse deep dive + My Gov action feed
  - GovernadaPulse: full Pulse page with GHI, cross-chain observatory, AI State of Governance narrative, governance calendar
  - Action feed architecture (lib/actionFeed.ts + ActionFeed component)
  - CitizenCommandCenter: delegation health card, recent DRep votes, action feed
  - DRepCommandCenter: score gauge, stats row, pending votes widget, action feed

- [x] Governada Phase 3A — Pulse completion + SPO command center + SPO claim flow
  - EDI-driven Cross-Chain Observatory in Pulse
  - AI "State of Governance" narrative
  - Governance Calendar
  - SPOCommandCenter: score gauge, pool stats, governance activity, action feed
  - SPO claim flow (wallet-verified pool ownership)

- [x] Governada Phase 3B — My Gov completion + DRep Profile Redesign
  - Feature flag audit: restored governada_frontend, drep_communication, score_tiers, alignment_drift,
    spo_claim_flow, spo_governance_identity flags deleted by migration 039
  - My Gov Inbox (4.5): multi-segment notification hub, filter tabs (All/Proposals/Score/Alignment/System),
    read/unread state (localStorage), deep-link CTAs, DRep pending proposals detail
  - My Gov Profile & Settings (4.6): identity card with tier ambient, governance philosophy editor,
    Quick Match/alignment section, notification toggles, email digest prefs, disconnect wallet
  - DRep Profile VP1: TierThemeProvider wrapping, personality label with hysteresis, tier progress
    with recommendedAction chip in Score Analysis tab
  - DRep Profile VP2: DRepProfileTabsV2 with Statements tab scaffold (behind drep_communication flag)
  - Backend: getPersonalityLabelWithHysteresis() in lib/drepIdentity.ts,
    computeTierProgress(score, pillars) with recommendedAction in lib/scoring/tiers.ts,
    last_personality_label column on dreps table, spo_power_snapshots table verified
  - Nav + route hygiene: My Gov sub-nav (Dashboard/Inbox/Profile), 8 legacy route redirects,
    CommandPalette updated with Inbox/Profile routes

## Completed (Phase 3B — shipped)

- [x] Preflight (lint, type-check, build)
- [x] Commit, PR, merge, deploy, smoke test

## Completed (Phase 3C — shipped)

- [x] SPO Profile Redesign (5.2): Mirror DRep profile architecture — VP1 hero with SPO Score,
      alignment radar, governance statement. VP2 tabs: voting record, score analysis, delegator breakdown,
      competitive context. Wire retrospective #7 (Koios /pool_delegators + /pool_voting_power_history).
- [x] Proposal Detail Redesign (5.3): "Proposal cards that connect everything" — AI category badge,
      tri-body vote bars, treasury impact, similar proposals, your DRep's vote highlighted,
      Phase B scaffold "What representatives are saying" section.
- [x] CC Members Governada Integration: /discover/committee — server-rendered page with CC transparency
      scores (participation rate + DRep alignment), alignment tension detection, route redirects
      (/committee → /discover/committee, /proposals/:txHash/:index → /proposal/:txHash/:index),
      CommandPalette entry added.

## Next Up (Phase 3D — Celebrations, Sharing & Communication Preview)

- [ ] Phase 3D: Celebrations, sharing, polish
  - Milestone celebration modals (first vote delegation, score tier upgrade)
  - Social share cards for DRep scores and governance milestones
  - DRep communication preview (Statements tab VP2 — behind drep_communication flag)
  - Confetti / achievement system scaffold
- [ ] Phase 6: Full polish run — after all profile pages are complete.
