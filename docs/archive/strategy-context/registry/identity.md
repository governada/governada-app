# Identity & Profiles — Domain Registry

## Architecture

Entity profiles, civic identity, milestone system, wrapped/share, OG images.

## Entity Profiles

| Entity    | Route                        | Key Components                                                     |
| --------- | ---------------------------- | ------------------------------------------------------------------ |
| DRep      | `/drep/[id]`                 | `DRepProfileHero.tsx`, `DRepProfileTabs.tsx`, `DRepReportCard.tsx` |
| SPO/Pool  | `/pool/[id]`                 | `PoolGovernanceCard.tsx`                                           |
| CC Member | `/governance/committee/[id]` | `components/cc/CCMemberProfileClient.tsx`                          |
| Proposal  | `/proposal/[tx]/[i]`         | `ProposalDescription.tsx`, `ProposalVotersClient.tsx`              |

## Civic Identity

| Feature                | Route            | Key Files                                                                        |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------- |
| Identity page          | `/you/identity`  | `components/governada/identity/CivicIdentityProfile.tsx`                         |
| Governance Rings       | `/you`, profiles | `components/governada/identity/GovernanceRings.tsx`                              |
| Impact score           | `/you`           | `lib/citizenImpactScore.ts`, `components/governada/identity/ImpactScoreCard.tsx` |
| Credibility            | —                | `lib/citizenCredibility.ts`                                                      |
| Milestone stamps       | `/you`           | `components/governada/identity/MilestoneStamps.tsx`, `lib/citizenMilestones.ts`  |
| Milestone gallery      | `/you`           | `components/governada/identity/MilestoneGallery.tsx`                             |
| Milestone celebration  | —                | `components/governada/identity/CitizenMilestoneCelebration.tsx`                  |
| Identity narrative     | `/you`           | `components/governada/identity/IdentityNarrative.tsx`                            |
| Governance pulse chart | `/you`           | `components/governada/identity/PulseHistoryChart.tsx`                            |
| DRep scorecard view    | `/you/scorecard` | `components/governada/identity/DRepScorecardView.tsx`                            |
| SPO scorecard view     | `/you/scorecard` | `components/governada/identity/SPOScorecardView.tsx`                             |
| Civic identity card    | Hub, profiles    | `components/governada/shared/CivicIdentityCard.tsx`                              |
| Citizen rings snapshot | —                | `snapshot-citizen-rings` Inngest                                                 |

## Profile Claiming

| Flow       | Route         | Key Files                                |
| ---------- | ------------- | ---------------------------------------- |
| DRep claim | `/claim/[id]` | `app/claim/[drepId]/ClaimPageClient.tsx` |
| SPO claim  | —             | `/api/spo/claim/route.ts`                |

## Wrapped & Share

| Feature                | Route                           | Key Files                                     |
| ---------------------- | ------------------------------- | --------------------------------------------- |
| Governance Wrapped     | `/wrapped/[type]/[id]/[period]` | `generate-governance-wrapped` Inngest         |
| My Gov Wrapped         | `/my-gov/wrapped/[period]`      | `app/my-gov/wrapped/`                         |
| OG images (30+ routes) | `/api/og/*`                     | `app/api/og/`, `lib/og-utils.tsx`             |
| Badge embed            | `/api/badge/[id]`               | `components/BadgeEmbed.tsx`                   |
| Share actions          | Various                         | `lib/share.ts`, `components/ShareActions.tsx` |
| Embed routes           | `/embed/*`                      | `app/embed/` (3 routes)                       |

## You Section

| Page           | Route                 | Purpose                          |
| -------------- | --------------------- | -------------------------------- |
| You hub        | `/you`                | Identity overview                |
| Public profile | `/you/public-profile` | Public-facing governance profile |
| Scorecard      | `/you/scorecard`      | Detailed score breakdown         |
| Settings       | `/you/settings`       | Account settings                 |
| Delegation     | `/you/delegation`     | Delegation health monitoring     |
| Record         | `/you/record`         | Governance record                |
| DRep view      | `/you/drep`           | DRep-specific identity           |
| SPO view       | `/you/spo`            | SPO-specific identity            |

## Delegation

| Feature               | Key Files                                   |
| --------------------- | ------------------------------------------- |
| Delegation page       | `/delegation`, `DelegationIntelligence.tsx` |
| Delegation hook       | `hooks/useDelegation.ts`                    |
| Delegation coaching   | `hooks/useDelegationCoaching.ts`            |
| Delegation milestones | `lib/delegationMilestones.ts`               |
| Coverage calculation  | `CoverageCard.tsx`                          |

## Connections

- **Scoring:** Scores displayed on all entity profiles
- **Engagement:** Endorsement counts on DRep profiles
- **Hub:** Civic identity card in Hub
- **Matching:** Alignment displayed on profiles
- **Share:** OG images generated for all shareable surfaces
