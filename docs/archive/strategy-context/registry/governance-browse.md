# Governance Browse — Domain Registry

## Architecture

Directory/exploration surfaces for all governance entities. Each directory supports filtering, sorting, and persona-adaptive display.

## Directory Pages

| Page               | Route                           | Key Component                        |
| ------------------ | ------------------------------- | ------------------------------------ |
| DRep directory     | `/governance/representatives`   | `GovernadaDRepBrowse.tsx`            |
| Pool/SPO directory | `/governance/pools`             | `GovernadaSPOBrowse.tsx`             |
| CC transparency    | `/governance/committee`         | `app/governance/committee/page.tsx`  |
| CC comparison      | `/governance/committee/compare` | `components/cc/CCComparisonView.tsx` |
| CC data export     | `/governance/committee/data`    | `components/cc/CCDataExport.tsx`     |
| Proposal browse    | `/governance/proposals`         | `ProposalsBrowse.tsx`                |
| Treasury           | `/governance/treasury`          | `TreasuryOverview.tsx`               |

## Health & Analytics

| Page                  | Route                              | Key Component                       |
| --------------------- | ---------------------------------- | ----------------------------------- |
| GHI dashboard         | `/governance/health`               | `GovernanceHealthIndex.tsx`         |
| GHI epoch history     | `/governance/health/epoch/[epoch]` | `app/governance/health/`            |
| GHI tracker           | `/governance/health/tracker`       | `app/governance/health/tracker/`    |
| GHI methodology       | `/governance/health/methodology`   | `components/governada/methodology/` |
| Leaderboard           | `/governance/leaderboard`          | `PulseLeaderboardClient.tsx`        |
| Observatory           | `/governance/observatory`          | `GovernanceObservatory.tsx`         |
| Governance report     | `/governance/report/[epoch]`       | `app/governance/report/`            |
| Pulse (live activity) | `/pulse`                           | `app/pulse/`                        |

## Entity Detail Pages

| Entity          | Route                        | Key Component                                |
| --------------- | ---------------------------- | -------------------------------------------- |
| DRep profile    | `/drep/[id]`                 | `DRepProfileHero.tsx`, `DRepProfileTabs.tsx` |
| Pool profile    | `/pool/[id]`                 | `PoolGovernanceCard.tsx`                     |
| CC member       | `/governance/committee/[id]` | `components/cc/CCMemberProfileClient.tsx`    |
| Proposal detail | `/proposal/[tx]/[i]`         | `app/proposal/[txHash]/[index]/page.tsx`     |

## Hub & Home

| Feature           | Key Component                                                    |
| ----------------- | ---------------------------------------------------------------- |
| Hub card system   | `components/hub/HubCardRenderer.tsx`, `components/hub/cards/`    |
| 4 persona MLEs    | `components/governada/home/Home{Citizen,DRep,SPO,Anonymous}.tsx` |
| Epoch briefing    | `components/governada/home/EpochBriefing.tsx`                    |
| Anonymous landing | `components/governada/home/HomeAnonymous.tsx`                    |

## Shared Browse Components

| Component              | File                                               |
| ---------------------- | -------------------------------------------------- |
| DRep card              | `components/governada/cards/GovernadaDRepCard.tsx` |
| SPO card               | `components/governada/cards/GovernadaSPOCard.tsx`  |
| Tier badge             | `components/governada/cards/TierBadge.tsx`         |
| Proposal card          | `components/governada/discover/ProposalCard.tsx`   |
| Compare (side-by-side) | `app/compare/page.tsx`                             |
| Filter panel           | `components/FilterPanel.tsx`                       |

## Other Browse Features

| Feature                | Key Files                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| Governance briefing    | `/governance/briefing`, `app/governance/briefing/`                    |
| Treasury categories    | `lib/treasury-categories.ts`                                          |
| Treasury simulator     | `components/TreasurySimulator.tsx`                                    |
| Governance calendar    | `hooks/useGovernanceCalendar.ts`, `components/GovernanceCalendar.tsx` |
| Governance sparklines  | `components/GovernanceSparklines.tsx`                                 |
| Cross-chain governance | `lib/crossChain/`, `components/CrossChainDecentralization.tsx`        |
