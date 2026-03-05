# ADR 007: Multi-Wallet Identity Model

**Status:** Accepted
**Date:** 2026-03-05
**Supersedes:** Implicit single-wallet-as-identity model

## Context

Civica's identity was wallet-address-centric: `users.wallet_address` was the PK, and every user-scoped table used it as the FK. This creates problems for engaged Cardano governance participants who routinely operate multiple wallets:

- A DRep with a separate cold storage wallet
- An SPO who also has a personal delegation wallet
- A CC member with an operational wallet distinct from their governance key
- Any security-conscious user splitting ADA across hot/cold wallets

Under the old model, each wallet was a separate user — fragmenting watchlists, engagement history, governance profiles, and poll responses. This directly undermines the intelligence layer (governance profiles, Wrapped, AI advisor) and the "best UX in crypto" goal.

## Decision

Decouple user identity from wallet address:

1. **`users.id` (UUID)** becomes the stable identity anchor (PK)
2. **`user_wallets`** junction table maps many wallets to one user
3. **All user-scoped tables** reference `user_id` (UUID) instead of `wallet_address`
4. **`wallet_address`** remains on `users` as a unique indexed column for auth lookup (backward-compatible session resolution)

### Schema

```
users (id UUID PK, wallet_address TEXT UNIQUE, ...)
  └── user_wallets (address TEXT PK, user_id UUID FK, stake_address, label, is_primary, segments[], drep_id, pool_id)
  └── poll_responses (user_id UUID FK, ...)
  └── governance_events (user_id UUID FK, ...)
  └── governance_briefs (user_id UUID FK, ...)
  └── user_governance_profiles (user_id UUID PK, ...)
  └── user_governance_profile_history (user_id UUID + snapshot_at PK, ...)
  └── notification_preferences (user_id UUID FK, ...)
  └── user_channels (user_id UUID FK, ...)
  └── notification_log (user_id UUID FK, ...)
  └── revoked_sessions (user_id UUID FK, ...)
```

### Wallet Linking Flow (Future)

1. User authenticates with Wallet A → session JWT carries `userId`
2. User clicks "Link Wallet" → connects Wallet B via CIP-30
3. Sign ownership challenge with Wallet B
4. Insert into `user_wallets`, run segment detection, cache results
5. All future queries use `user_id` — data aggregates automatically

### Segment Detection

Each wallet in `user_wallets` has cached `segments[]` (e.g., `['drep']`, `['spo', 'citizen']`). The user's effective segments are the union across all linked wallets. Detection runs on link and can be refreshed periodically.

## Consequences

**Positive:**

- One human = one profile, regardless of wallet count
- Governance intelligence (profiles, Wrapped, AI advisor) sees the full picture
- Engagement levels compound across wallets
- Cleaner auth model: JWT carries stable UUID, not a mutable wallet address
- `user_wallets` enables future features (wallet labels, segment badges, portfolio view)

**Negative:**

- Migration touches ~40 files across API routes, lib/, Inngest functions, and types
- JWT session token must carry `userId` instead of (or alongside) `walletAddress`
- Wallet linking creates a server-side association — privacy-sensitive users may object

**Risks:**

- Privacy: linked wallets are deanonymizable. Mitigate with clear opt-in UX and ability to unlink
- Merge conflicts: if wallet B already has a user record when linked to wallet A, data merge logic needed (watchlists, prefs, history)

## Migration

- **Migration 047** (`047_multi_wallet_identity.sql`): Schema changes
- **Phase 2** (code): Update all API routes, lib functions, Inngest functions, and types to use `user_id`
- **Phase 3** (auth): Update JWT to carry `userId`, update session validation
- **Phase 4** (UI): Wallet linking flow, wallet selector, segment badges

Pre-launch, so no backward compatibility or dual-write period needed.
