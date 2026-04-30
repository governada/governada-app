# Matching & Discovery â€” Domain Registry

## Architecture

PCA-based alignment system powers DRep/Pool matching. 6 governance dimensions from AI proposal classification.

```
Proposals â†’ AI classification (6D) â†’ PCA alignment â†’ Match scoring â†’ Discovery/Match UI
```

## Core Engine

| Component                  | Key Files                            |
| -------------------------- | ------------------------------------ |
| 6D PCA alignment           | `lib/alignment/`, `lib/alignment.ts` |
| AI proposal classification | `lib/alignment/classifyProposal.ts`  |
| Match scoring              | `lib/matching/`                      |
| Persona-agnostic matching  | `match_type` param (DRep, SPO, Pool) |
| Match store (client state) | `lib/matchStore.ts`                  |
| Match signals              | `lib/matchSignals.ts`                |
| Representation match       | `lib/representationMatch.ts`         |

## Match Flows

| Flow                 | Route                                         | Key Files                                                                |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Quick Match (PCA 6D) | `/?mode=match`, `/match` alias, `/match/vote` | `components/matching/QuickMatchExperience.tsx`, `hooks/useQuickMatch.ts` |
| Match results        | `/match/result`                               | `components/governada/match/QuickMatchFlow.tsx`                          |
| Conversational Match | `Seneca overlay`                              | `hooks/useConversationalMatch.ts`                                        |
| Pool Match           | `/?mode=match`                                | `lib/matching/` (match_type param)                                       |
| Curated Vote Flow    | `/match/vote`                                 | `components/governada/match/CuratedVoteFlow.tsx`                         |

## Supporting Components

| Component              | File                                                  |
| ---------------------- | ----------------------------------------------------- |
| Match prompt panel     | `components/governada/match/MatchPromptPanel.tsx`     |
| Quiz explainer         | `components/governada/match/QuizExplainer.tsx`        |
| Pool match enhancement | `components/governada/match/PoolMatchEnhancement.tsx` |
| Unlock preview         | `components/governada/match/UnlockPreview.tsx`        |
| Match result overlay   | `components/governada/MatchResultOverlay.tsx`         |
| Cerebro match flow     | `components/governada/match/CerebroMatchFlow.tsx`     |

## Similarity & Discovery

| Feature              | Key Files                                          |
| -------------------- | -------------------------------------------------- |
| Proposal similarity  | `lib/proposalSimilarity.ts`, `lib/similarity.ts`   |
| Similar DReps        | `/api/dreps/[id]/similar`                          |
| Similar proposals    | `/api/proposals/similar`                           |
| Discovery algorithms | `lib/discovery/`                                   |
| Semantic embeddings  | `lib/embeddings/` (powers similarity)              |
| Discovery hook       | `hooks/useDiscovery.ts`, `hooks/useExplorePath.ts` |

## Alignment Snapshots

Daily alignment snapshots for trend analysis: `alignment_snapshots`, `spo_alignment_snapshots` tables. Computed by `sync-alignment` Inngest.

## Connections

- **Scoring:** Match results show DRep/SPO scores and tiers
- **AI/Seneca:** Conversational match driven by Seneca, AI classifies proposals for PCA
- **Hub:** Discovery cards suggest matches
- **Profiles:** Alignment displayed on entity profiles
- **Embeddings:** Semantic similarity powers "similar proposals/DReps" features
