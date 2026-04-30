# Engagement Mechanisms — Domain Registry

## Architecture

7 structured civic engagement tools. Signal > noise. No forums, no threads, no moderation burden.

```
User action → engagement API → Supabase tables → integrity check → score feedback → intelligence
```

## The 7 Mechanisms

| #   | Mechanism            | Component                                       | API Route                        | Table                |
| --- | -------------------- | ----------------------------------------------- | -------------------------------- | -------------------- |
| 1   | Proposal Sentiment   | `components/engagement/ProposalSentiment.tsx`   | `/api/engagement/sentiment/vote` | `sentiment_votes`    |
| 2   | Priority Signals     | `components/engagement/PrioritySignals.tsx`     | `/api/engagement/priorities`     | `priority_signals`   |
| 3   | Concern Flags        | `components/engagement/ConcernFlags.tsx`        | `/api/engagement/concerns`       | `concern_flags`      |
| 4   | Impact Tags          | `components/engagement/ImpactTags.tsx`          | `/api/engagement/impact`         | `impact_tags`        |
| 5   | Citizen Questions    | `components/DRepQuestionsInbox.tsx`             | `/api/governance/questions`      | `citizen_questions`  |
| 6   | Citizen Assemblies   | AI-generated (no user component)                | `/api/engagement/assembly/*`     | `citizen_assemblies` |
| 7   | Citizen Endorsements | `components/engagement/CitizenEndorsements.tsx` | `/api/engagement/endorsements`   | `endorsements`       |

## Integrity System

Rate limiting, stake-weighted voting, quorum thresholds, credibility scoring (`lib/citizenCredibility.ts`).

## Score Feedback Loop

Engagement signals → `precompute-engagement-signals` Inngest → score pipeline (EQ pillar).

## Hooks

`useEngagement.ts`, `useEngagementNudge.ts`, `useFeedbackThemes.ts`

## Connections

- **Scoring:** Signals feed EQ pillar, endorsements feed discovery ranking
- **AI/Seneca:** Community intelligence synthesized from engagement data
- **Hub:** Engagement cards in card system
- **Profiles:** Endorsement counts on DRep profiles
