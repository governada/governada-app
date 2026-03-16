# Feature Exploration: Embedded Wallet for Hands-Free Governance

> **Status:** Exploration — not scheduled
> **Created:** 2026-03-16
> **Context:** Arose from Delegation Autopilot discussion. Option C (custom transaction review modal) was chosen for near-term. This doc captures Option A (embedded wallet) for future consideration.

---

## The Idea

Allow users to create or import a governance-only wallet directly inside Governada. Key material is encrypted and stored in the browser (IndexedDB), protected by a user-set password. Signing happens in-app — no extension popup, full UX control.

## Why It's Interesting

- **Hands-free Autopilot**: With an embedded wallet, Delegation Autopilot could execute re-delegations without any user interaction beyond the initial opt-in. The app signs on behalf of the user using their stored keys.
- **Seamless UX**: Transaction review, signing, and confirmation all happen in Governada-designed modals. No jarring browser extension popups.
- **New user onboarding**: Users who don't have a Cardano wallet yet could start their governance journey entirely within Governada — create wallet, fund it, delegate, all in one flow.

## How It Would Work

1. User creates a "Governada Governance Wallet" — a Cardano wallet whose keys live encrypted in the browser
2. User funds it with ADA (transfer from main wallet) or uses it as their primary wallet
3. Delegation, voting, and rationale submission all sign in-app via the embedded keys
4. Autopilot can sign delegation transactions automatically when criteria trigger

**MeshJS support**: MeshJS has been developing embedded wallet capabilities. Implementation would use their SDK for key generation, encryption, and transaction signing.

## Concerns & Open Questions

### Security

- Browser-stored keys are inherently less secure than hardware wallets or dedicated extensions
- IndexedDB can be accessed by browser extensions with sufficient permissions
- If the user clears browser data, they lose access (mitigated by seed phrase backup)
- For governance-only wallets (no significant ADA holdings), the risk is lower

### Trust

- Users must trust Governada enough to store key material in the app
- "Import your seed phrase" is a red flag for security-conscious crypto users
- Works better for NEW wallets than for importing existing ones

### Scope

- This is a significant product surface: wallet creation, backup flows, password management, recovery
- Regulatory implications of holding/managing key material (varies by jurisdiction)
- Support burden: lost passwords, cleared browsers, cross-device access

## Recommendation

- **v1 (now)**: Ship Delegation Autopilot with Option C (custom transaction review modal). The wallet popup is a 3-second interruption in a 15-second flow.
- **v2 (evaluate after Autopilot adoption)**: If Autopilot usage is high and users express friction with the signing step, build the embedded wallet as a premium "governance wallet" feature.
- **Positioning**: "Create a Governada governance wallet for hands-free autopilot" — framed as an upgrade, not a requirement.

## Prerequisites Before Building

1. MeshJS embedded wallet SDK is stable and audited
2. Legal review of key custody implications
3. Security audit of browser-based key storage approach
4. User research: would users actually create a separate governance wallet?
5. Autopilot has proven adoption (validates the demand for hands-free signing)
