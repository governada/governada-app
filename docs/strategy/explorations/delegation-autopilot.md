# Feature Spec: Delegation Autopilot

> **Status:** Spec — ready for build planning
> **Created:** 2026-03-16
> **Personas:** Citizen (primary), all authenticated users
> **Monetization:** Premium Delegator tier ($5-10/mo) — this is the headline feature

---

## One-Line Vision

**Governada monitors your governance representation 24/7 and handles re-delegation for you when your criteria trigger — you just approve.**

---

## The Problem

Citizens delegate to a DRep and forget about it. Over time:

- The DRep stops voting (participation drops)
- The DRep's values drift from the citizen's (alignment diverges)
- A better-matched DRep enters the ecosystem
- The citizen wanted to rotate for decentralization but never remembered

By the time the citizen notices (if they ever do), they've been poorly represented for weeks or months. The briefing and alerts help with awareness, but awareness without action is incomplete.

## The Solution

Two connected features:

### 1. Delegation Autopilot (Intelligence Layer)

Users configure criteria that Governada monitors every epoch:

| Trigger                       | Description                                        | Example Config                                    |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| **Match drift**               | Re-delegate when alignment drops below threshold   | "Switch if match drops below 60%"                 |
| **Inactivity**                | Re-delegate when DRep stops participating          | "Switch if DRep misses votes for 2 epochs"        |
| **Score collapse**            | Re-delegate when DRep score drops below tier       | "Switch if DRep drops below Silver tier"          |
| **Decentralization rotation** | Rotate to a similar DRep periodically              | "Rotate every 90 days to similar DReps"           |
| **Better match found**        | Proactive suggestion when a superior match appears | "Notify if a DRep with >85% match becomes active" |

When a trigger fires:

1. Autopilot finds the best alternative DRep using the existing matching engine
2. Constructs a delegation transaction via MeshJS (CIP-95)
3. Sends a notification with full context
4. Queues the recommendation in the user's inbox
5. When the user opens the app, presents the one-tap approval flow

### 2. Seamless Transaction UX (Option C — Custom Review Modal)

Every wallet interaction in Governada (delegation, voting, staking) gets wrapped in a polished 4-step flow:

**Step 1: Context Modal** (Governada-controlled)

- Full-screen or large modal with the action summary
- For re-delegation: DRep comparison card (current vs recommended), match scores, reason for switch
- Clear statement: "No ADA will leave your wallet"
- "Approve" button

**Step 2: Wallet Handoff** (Transition frame)

- Brief interstitial: "Your wallet will ask you to confirm" with the wallet's logo
- Reduces the jarring feeling of the extension popup
- 1-2 seconds, then the wallet popup appears

**Step 3: Extension Signing** (Wallet-controlled, ~3 seconds)

- The standard wallet popup for password + approval
- We can't control this, but it's now sandwiched between two polished steps

**Step 4: Celebration** (Governada-controlled)

- Transaction confirmed animation
- Updated delegation status
- Civic identity update: "Delegation updated! Your governance coverage is restored."
- For Autopilot: "Autopilot handled this for you" badge
- Optional: share card for social

**Net effect**: The wallet popup becomes a 3-second blip in a 15-second, beautiful, contextual flow.

---

## User Flows

### Autopilot Setup Flow

1. User visits `/you/settings` or gets prompted from delegation health alert
2. "Delegation Autopilot" section with toggle + criteria configuration
3. Each trigger type has a toggle + threshold slider/selector
4. User enables desired triggers
5. Confirmation: "Autopilot will monitor your delegation every epoch and recommend changes when your criteria trigger. You'll always approve before anything changes."

### Autopilot Triggered Flow

1. Epoch boundary → Inngest job runs for all opted-in users
2. Check each user's criteria against current data
3. If triggered: find best alternative DRep via matching engine
4. Send push notification: "Autopilot: Your DRep's match dropped to 52%. [New DRep] is a 78% match."
5. Queue action in user's inbox with pre-built transaction
6. User opens app → Context Modal → Wallet Sign → Celebration
7. Total time from notification to completion: ~15 seconds

### Manual Delegation Flow (Enhanced with Option C)

Same 4-step flow applies to ALL delegation actions, not just Autopilot:

- First-time delegation from Match results
- Manual re-delegation from DRep profile
- Pool staking delegation
- Voting transactions (DRep/SPO)

---

## Technical Architecture

### Autopilot Monitoring

```
Inngest: delegation-autopilot-check (runs every epoch)
├── Query all users with autopilot_enabled = true
├── For each user:
│   ├── Load their criteria config from user_preferences
│   ├── Load current DRep data (score, participation, alignment)
│   ├── Check each trigger:
│   │   ├── match_drift: recalculate alignment, compare to threshold
│   │   ├── inactivity: check votes_last_N_epochs
│   │   ├── score_collapse: check current tier vs threshold tier
│   │   ├── rotation: check epochs_since_delegation vs rotation_period
│   │   └── better_match: run matching engine, compare top result to current
│   ├── If any trigger fires:
│   │   ├── Find best alternative via matching engine
│   │   ├── Create autopilot_recommendation record in DB
│   │   ├── Send push notification
│   │   └── Create inbox notification with action_type: 'redelegation'
│   └── If no triggers: skip (silent)
└── Log results to sync_log
```

### Transaction Builder

```
lib/delegation/transactionBuilder.ts
├── buildDelegationTx(stakeAddress, newDrepId) → UnsignedTx
├── buildVoteTx(drepId, proposalId, vote, rationale?) → UnsignedTx
├── buildStakeDelegationTx(stakeAddress, poolId) → UnsignedTx
└── All use MeshJS CIP-95 transaction construction
```

### Transaction Review Modal

```
components/wallet/TransactionReviewModal.tsx
├── Step 1: ContextStep (action summary, comparison, safety message)
├── Step 2: HandoffStep (wallet logo, "confirming..." message)
├── Step 3: SigningStep (monitors wallet response)
├── Step 4: CelebrationStep (confirmation, identity update, share)
└── Props: { action, context, onComplete, onCancel }
```

### Database

```sql
-- User autopilot preferences
ALTER TABLE users ADD COLUMN autopilot_config jsonb DEFAULT null;
-- Schema: { enabled: boolean, triggers: { match_drift?: { threshold: number }, inactivity?: { epochs: number }, ... } }

-- Autopilot recommendations (queued actions)
CREATE TABLE autopilot_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  trigger_type text NOT NULL,
  current_drep_id text,
  recommended_drep_id text NOT NULL,
  reason text NOT NULL,
  match_score numeric,
  status text DEFAULT 'pending', -- pending, approved, dismissed, expired
  created_at timestamptz DEFAULT now(),
  acted_at timestamptz
);
```

---

## Scope & Phasing

### Phase A: Transaction Review Modal (Option C)

- Build `TransactionReviewModal` with the 4-step flow
- Apply to ALL existing delegation/voting flows (match result, DRep profile, vote casting)
- No autopilot yet — just the improved UX
- **Effort**: Medium (1-2 build sessions)

### Phase B: Autopilot Infrastructure

- Database migration for autopilot_config + autopilot_recommendations
- Inngest monitoring job (epoch-triggered)
- Autopilot settings UI in `/you/settings`
- Inbox integration for queued recommendations
- **Effort**: Large (2-3 build sessions)

### Phase C: Autopilot Triggers

- Implement each trigger type one at a time
- Start with match_drift (highest value, uses existing alignment engine)
- Then inactivity (simple, high-signal)
- Then rotation (unique differentiator)
- Then score_collapse and better_match
- **Effort**: Medium per trigger

---

## Monetization

Delegation Autopilot is the headline feature for Premium Delegator ($5-10/mo):

- **Free**: Manual delegation + Option C transaction UX (everyone gets the better UX)
- **Premium**: Autopilot monitoring + triggers + proactive recommendations + one-tap re-delegation queue

The free tier still benefits from Option C — the improved transaction flow applies to everyone. Premium adds the intelligence that watches your delegation 24/7.

---

## Competitive Position

No governance tool in any blockchain ecosystem offers automated delegation management. This is genuinely novel:

- **GovTool**: Manual delegation only, no monitoring
- **Tally**: No delegation health monitoring
- **Snapshot**: Off-chain only, no delegation concept

Delegation Autopilot + the seamless transaction UX would make Governada the first governance platform that actively manages your representation — shifting from "tool you use" to "service that works for you."
