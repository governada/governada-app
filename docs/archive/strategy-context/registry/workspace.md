# Workspace & Authoring — Domain Registry

## Architecture

Full proposal lifecycle for DReps/SPOs. Two sub-systems: Authoring + Review.

```
Draft → Community Review → Response → FCP → Submission → On-chain → Monitoring → Debrief
```

## Authoring Pipeline (`/workspace/author`)

| Feature                     | Route                            | Key Files                                               |
| --------------------------- | -------------------------------- | ------------------------------------------------------- |
| Draft portfolio             | `/workspace/author`              | `hooks/useDrafts.ts`, `hooks/useAuthorTableItems.ts`    |
| Draft editor                | `/workspace/author/[id]`         | `hooks/useDraftActions.ts`, `hooks/useDraftPresence.ts` |
| Rich text editor            | `/workspace/editor/[id]`         | `hooks/useRegisterEditorCommands.ts`                    |
| CIP-108 templates           | Draft creation                   | `lib/workspace/`                                        |
| 5-stage lifecycle           | Draft detail                     | Draft → Community Review → Response → FCP → Submitted   |
| Structured review rubrics   | Draft detail                     | `hooks/useDraftReviews.ts`                              |
| Team collaboration          | Draft detail                     | `hooks/useTeam.ts`, `hooks/useTeamApprovals.ts`         |
| Constitutional AI pre-check | Draft detail                     | `lib/constitution.ts`, AI skills                        |
| Version diff engine         | Draft detail                     | `hooks/useRevision.ts`                                  |
| Submission flow             | `/workspace/author/[id]/submit`  | On-chain CIP-108                                        |
| Post-submission monitoring  | `/workspace/author/[id]/monitor` | `hooks/useProposalMonitor.ts`                           |
| Debrief                     | `/workspace/author/[id]/debrief` | Post-outcome analysis                                   |

## Review Pipeline (`/workspace/review`)

| Feature                        | Key Files                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Urgency-sorted queue           | `hooks/useReviewQueue.ts`, `hooks/useDecisionTableItems.ts`                     |
| On-chain voting (CIP-95)       | `hooks/useVote.ts`                                                              |
| Rationale submission (CIP-100) | `lib/rationale.ts`                                                              |
| Intelligence blocks            | Constitutional check, similar proposals, treasury impact, proposer track record |
| Sealed assessment (5-day)      | Independent review before community discussion                                  |
| Decision journal               | `hooks/useDecisionJournal.ts`                                                   |
| Inline annotations             | `hooks/useAnnotations.ts`, `hooks/useSuggestionAnnotations.ts`                  |
| Review templates               | `hooks/useReviewTemplate.ts`                                                    |

## AI Skills Engine

`lib/ai/skills/`, `hooks/useAISkill.ts` — constitutional check, research precedent, steelman, uniqueness, perspective clustering.

## Other Workspace Pages

`/workspace` (action queue), `/workspace/delegators`, `/workspace/votes`, `/workspace/rationales`, `/workspace/performance`, `/workspace/pool-profile`, `/workspace/position`, `/workspace/amendment/[id]`

## Connections

- **Scoring:** Voting → EP pillar, rationale quality → EQ
- **Engagement:** Community review is an engagement mechanism
- **AI/Seneca:** Powers constitutional analysis, research, steelman
- **Profiles:** Vote history displayed on entity profiles (not workspace)
