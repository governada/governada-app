# AI & Intelligence (Seneca) — Domain Registry

## Architecture

AI companion (Seneca) + narrative generation + classification + research. Uses Anthropic Claude. BYOK support for user-provided keys.

```
User query → Seneca thread → AI skills/context → response → annotations/globe choreography
```

## Seneca Conversational System

| Feature              | Key Files                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| Conversational panel | `hooks/useSenecaThread.ts`, `components/governada/panel/SenecaConversation.tsx`  |
| Memory system        | `hooks/useSenecaMemory.ts`                                                       |
| Search               | `hooks/useSenecaSearch.ts`, `components/governada/panel/SenecaSearchPanel.tsx`   |
| Ghost prompts        | `hooks/useSenecaGhostPrompts.ts`, `hooks/useSenecaProactiveWhispers.ts`          |
| Globe bridge         | `hooks/useSenecaGlobeBridge.ts` — Seneca choreographs globe                      |
| Annotations          | `hooks/useSenecaAnnotations.ts` — inline on entity pages                         |
| Research mode        | `hooks/useResearchAssistant.ts`, `components/governada/panel/SenecaResearch.tsx` |
| Idle state           | `components/governada/panel/SenecaIdle.tsx`                                      |
| Input                | `components/governada/panel/SenecaInput.tsx`                                     |
| Match flow           | `components/governada/panel/SenecaMatch.tsx`                                     |

## AI-Generated Content (Inngest)

| Content             | Inngest Function               | Display                 |
| ------------------- | ------------------------------ | ----------------------- |
| Governance briefs   | `generate-governance-brief`    | `/governance/briefing`  |
| Proposal briefs     | `generate-proposal-briefs`     | Proposal pages          |
| Citizen briefings   | `generate-citizen-briefings`   | Hub                     |
| CC briefings        | `generate-cc-briefing`         | `/governance/committee` |
| Epoch summaries     | `generate-epoch-summary`       | `/governance`, Hub      |
| State of Governance | `generate-state-of-governance` | —                       |
| DRep epoch updates  | `generate-drep-epoch-updates`  | DRep profiles           |
| Weekly digest       | `generate-weekly-digest`       | Email                   |
| Governance wrapped  | `generate-governance-wrapped`  | `/wrapped/`             |
| Editorial headlines | `lib/editorialHeadline.ts`     | Hub                     |

## Classification & Analysis

| Feature                      | Key Files                                                                 |
| ---------------------------- | ------------------------------------------------------------------------- |
| Proposal classification (6D) | `lib/alignment/classifyProposal.ts`                                       |
| Constitutional analysis      | `lib/constitution.ts`                                                     |
| Rationale quality scoring    | `score-ai-quality`, `compute-ai-quality` Inngest                          |
| Proposal intelligence        | `precompute-proposal-intelligence` Inngest, `lib/proposalIntelligence.ts` |
| Community intelligence       | `compute-community-intelligence` Inngest, `lib/communityIntelligence.ts`  |
| Alignment drift detection    | `detect-alignment-drift` Inngest                                          |
| Passage prediction           | `lib/passagePrediction.ts`, `update-passage-predictions` Inngest          |

## Embeddings

| Feature             | Key Files                                        |
| ------------------- | ------------------------------------------------ |
| Semantic embeddings | `lib/embeddings/`, `generate-embeddings` Inngest |
| User embeddings     | `generate-user-embedding` Inngest                |
| Proposal similarity | `lib/proposalSimilarity.ts`, `lib/similarity.ts` |

## AI Skills Engine

`lib/ai/skills/` — modular skill system. Skills: constitutional-check, research-precedent, steelman, uniqueness, perspective-clustering. Invoked via `hooks/useAISkill.ts`, `/api/ai/skill/route.ts`.

## BYOK Support

`hooks/useBYOKKeys.ts` — users can provide their own Anthropic API key for AI features.

## Connections

- **Workspace:** Constitutional analysis, research, steelman skills used during review
- **Matching:** Seneca drives conversational match flow
- **Globe:** Seneca choreographs globe visualization
- **Scoring:** Rationale quality scoring feeds EQ pillar
- **Engagement:** Community intelligence synthesized from engagement data
