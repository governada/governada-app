# Persona: The Proposer (Governance Action Author)

> **Status:** Active -- defines the proposal authoring capability and team collaboration experience.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`, `personas/citizen.md`, `personas/drep.md`

---

## Who They Are

Proposers are anyone who submits a governance action on Cardano. They range from individuals (DReps filing Info Actions to signal community priorities) to established organizations (development shops seeking treasury funding for tooling) to community groups (coalitions proposing constitutional amendments or parameter changes).

The critical architectural insight: **Proposer is a capability, not a persona segment.** A citizen who drafts a proposal is still a citizen. A DRep who files a governance action is still a DRep. The proposer layer adds authoring tools on top of whatever base persona the user already has. It does not change their navigation, information depth, or public page adaptation. It grants access to the authoring workspace at `/workspace/author`.

This means:

- A citizen who creates a draft sees the citizen navigation with access to the Author workspace
- A DRep who creates a draft sees the DRep workspace with Author already in their Home nav
- An SPO who creates a draft sees the SPO workspace with Author in their Home nav
- No "Proposer" segment exists in the system -- only the presence of draft data

### Current Population

Governance action submissions have been relatively rare in Cardano's first year of on-chain governance. The deposit requirements (100,000 ADA for most action types) create a natural filter. Most proposers to date have been:

- **Treasury seekers:** Teams requesting funding for development, tooling, or community initiatives
- **Info Action filers:** DReps or community members signaling priorities through non-binding proposals
- **Parameter advocates:** Technical community members proposing protocol parameter adjustments
- **Constitutional actors:** Individuals or groups proposing governance structure changes

As the ecosystem matures and tooling improves, the proposer population will expand. Governada's authoring pipeline reduces the barrier from "only people who can construct CIP-108 JSON by hand" to "anyone with an idea and a wallet."

---

## What They Want

### As citizens (inherited from their base persona)

- Everything their base persona provides -- the briefing, treasury transparency, civic identity, workspace tools
- The proposer capability is additive; it never replaces base functionality

### As governance action authors

- **Structured feedback before risking 100K ADA:** The deposit for most governance actions is substantial. Proposers want to know if their proposal has community support, constitutional issues, or fatal flaws before committing funds to an on-chain submission.
- **A clear path from idea to on-chain submission:** The journey from "I have an idea" to "this is on-chain and being voted on" is currently fragmented across multiple tools, forums, and manual processes. Proposers want one workspace that handles the entire lifecycle.
- **Transparent track record:** Proposers who deliver on funded proposals should build reputation that makes future proposals easier to pass. Those who don't deliver should face appropriate scrutiny.
- **Team collaboration on complex proposals:** Large treasury requests and constitutional changes require input from multiple people. Proposers need shared authoring, version management, and role-based access for their teams.
- **Constitutional pre-check:** Before spending time writing a full proposal, authors want to know if their idea conflicts with the ratified constitution.

### What would delight them

- Opening the authoring workspace, writing a proposal draft, and seeing a constitutional pre-check flag a potential issue before they invest hours of work
- Publishing a draft for community review and getting structured, rubric-based feedback from engaged citizens and DReps within a day
- Responding to each piece of feedback point-by-point and watching their proposal's community confidence score rise
- Inviting a co-author to help with the technical rationale section while maintaining version control
- Clicking "Submit On-Chain" and having Governada handle CIP-108 generation, IPFS hosting, anchor hash computation, and transaction construction -- all in one flow

---

## The Proposer Experience

### Philosophy

The proposer experience is a **structured authoring pipeline** -- Governada is to proposal authors what Google Docs + peer review is to academic papers. They draft, iterate, get feedback, respond to feedback, and ultimately submit. The intelligence layer (constitutional analysis, community sentiment, precedent matching) makes their proposals better without requiring them to be governance experts.

The base persona experience runs underneath. The proposer capability adds to it; it never replaces it.

### Draft Authoring Workspace

The primary creation surface at `/workspace/author`:

**Draft creation:**

- Type selector: pick the governance action type (Info Action, Treasury Withdrawal, Parameter Change, etc.)
- Structured fields: title, abstract, motivation, rationale -- matching the CIP-108 standard
- Type-specific fields: withdrawal amount and receiving address for treasury proposals, parameter name and proposed value for parameter changes
- Auto-save: changes persist on blur, with clear save status indicators
- Version management: snapshot named versions with edit summaries at any point

**AI Skills for planning (Pro):**

- Constitutional pre-check: AI analysis of draft content against the ratified constitution, flagging potential conflicts by article and section
- Precedent research: "Has anything similar been proposed before? What happened?"
- Impact analysis: "If this treasury withdrawal is approved, what percentage of the treasury does it represent?"

**Version management:**

- Named versions with edit summaries
- Side-by-side diff comparison between any two versions
- Full version history with ability to view or restore any previous version

### Community Review

When the proposer is ready, they advance the draft to community review:

**Structured feedback:**

- Citizens and DReps provide rubric-based reviews: impact, feasibility, constitutionality, and value scores (1-5)
- Free-form feedback text with optional theme tags
- Deduplication: if similar feedback already exists, reviewers can endorse it rather than duplicate
- Contribution uniqueness check: AI detects when a new review substantially overlaps existing feedback

**Point-by-point response:**

- Proposers respond to each review: accept, decline, or modify
- Response text explains their reasoning
- All responses are public -- transparency is the default
- The response creates a dialogue: reviewers see they were heard, other voters see how the proposer handles criticism

**Lifecycle stages:**

1. **Draft** -- private authoring, any edits allowed
2. **Community Review** -- public, accepting feedback
3. **Response/Revision** -- proposer responds to feedback and revises
4. **Final Comment Period** -- last chance for community input before submission
5. **Submitted** -- on-chain, voting in progress
6. **Archived** -- withdrawn or expired

### Team Collaboration

For complex proposals requiring multiple authors:

- **Lead/Editor/Viewer roles:** The draft owner is the Lead. They can invite Editors (can edit the draft) and Viewers (read-only access).
- **Invite links:** UUID-based invite codes with configurable role, expiry (up to 1 week), and max uses. The Lead generates links and shares them.
- **Team management:** Lead can change member roles, remove members. Members can leave voluntarily.
- **Shared workspace:** All team members see the same draft, versions, reviews, and responses.

### CIP-108 Generation

When the draft is ready for on-chain submission:

- Auto-generates CIP-108 compliant JSON from the structured draft fields
- Computes the content hash (anchor hash)
- Preview modal shows exactly what will be published
- Hosts the document (Supabase Storage)
- Bundles the metadata anchor with the governance action transaction

### On-Chain Submission

The final step, behind a feature flag:

- Preflight check: verifies the wallet has sufficient funds for the deposit + fees
- Transaction construction via MeshJS
- Wallet signing flow
- On-chain confirmation and tx hash tracking
- Draft status updates to "submitted" with chain references

---

## Free vs. Pro

### Free (Full Authoring Pipeline)

Everything a proposer needs to take a proposal from idea to on-chain submission:

- **Full authoring workspace** -- structured fields, auto-save, type-specific sections
- **Version management** -- named versions, diff comparison, version history
- **Community review** -- publish for structured feedback, receive rubric-based reviews
- **Point-by-point response** -- respond to each review publicly
- **CIP-108 generation** -- auto-formatted output, content hashing, hosting
- **On-chain submission** -- transaction construction, wallet signing, chain tracking
- **Team collaboration** -- up to 3 team members (Lead + 2 invited)
- **Lifecycle management** -- stage transitions, status tracking

### Pro (Advanced Authoring Intelligence)

Tools for proposers who want the best chance of proposal success:

- **Unlimited team members** -- no cap on editors and viewers
- **AI planning skills** -- constitutional pre-check, precedent research, impact analysis
- **Advanced analytics** -- how reviewers engage with your proposals, which sections get the most feedback, sentiment trends over time
- **Priority constitutional checks** -- faster processing, more detailed analysis
- **Proposal coaching** -- AI-generated suggestions for improving weak sections based on review patterns

### Why This Split Works

The free tier is generous because proposer adoption feeds the ecosystem:

- Every proposal that goes through structured community review improves governance quality
- Every CIP-108 document generated through Governada standardizes the metadata ecosystem
- Every team collaboration creates network effects (invitees become Governada users)
- The more proposals flow through Governada, the richer the precedent and sentiment data for everyone

Pro monetizes the intelligence and scaling layer. Proposers seeking treasury funding -- especially larger amounts -- will pay for the edge that increases their approval odds. The free tier makes them capable. Pro makes them strategic.

---

## How Proposers Connect to Other Personas

| Persona         | Relationship                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizens**    | Citizens review proposals and provide structured feedback through the rubric. Their sentiment data feeds the proposer's community confidence signal. Citizens are the proposer's primary audience for community review.       |
| **DReps**       | DReps ask structured questions about proposals and ultimately vote on them. The proposer's relationship to DReps is: "I'm asking you to trust me with governance decisions." DRep feedback carries more weight in visibility. |
| **SPOs**        | SPOs evaluate proposals from the infrastructure and protocol perspective, especially for parameter changes and hard fork proposals. SPO feedback highlights technical implications.                                           |
| **CC Members**  | CC checks proposals for constitutionality. The constitutional pre-check AI skill helps proposers anticipate CC concerns before submission.                                                                                    |
| **Researchers** | Researcher analysis of proposal outcomes feeds back into the intelligence layer. Historical success/failure data from past proposals informs the precedent matching skill.                                                    |

---

## Architecture Decision: Capability, Not Segment

This is the most important architectural choice for the Proposer experience:

**Proposer is NOT a new UserSegment.** It does not appear in the segment detection flow, the View As registry segment list, or the navigation persona mapping. Adding it as a segment would:

1. **Break the segment model:** Users can only be one segment. A DRep who is also a proposer would need to "switch" between segments, which contradicts the current single-segment-per-user design.
2. **Fragment navigation:** A "Proposer" segment would need its own Home items, bottom bar config, and pill bar mapping. This duplicates work and creates maintenance burden.
3. **Misrepresent the relationship:** Being a proposer is something you DO, not something you ARE. It's like "has drafts" -- a state, not an identity.

Instead, the Author workspace is accessible to any authenticated user regardless of segment. The nav config exposes it through existing segment-specific Home items (for DRep/SPO) or through a workspace section for citizens. The View As registry includes "Citizen + Active Proposer" and "DRep + Active Proposer" presets that let admins navigate to `/workspace/author` as different segments to test the experience.

---

## Metrics That Matter

| Metric                                    | What It Measures                   | Target                                                                |
| ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| **Proposals submitted through Governada** | Pipeline adoption                  | >25% of on-chain governance actions authored in Governada within 1 yr |
| **Full lifecycle completion rate**        | Is the pipeline useful end-to-end? | >60% of drafts that reach community review eventually get submitted   |
| **Average review scores**                 | Is the feedback loop working?      | Proposals with >3 reviews average higher on-chain approval rates      |
| **Team adoption rate**                    | Is collaboration valued?           | >20% of proposals use team features                                   |
| **Constitutional pre-check usage**        | Is the AI skill useful?            | >70% of proposals run a pre-check before community review             |
| **Time from draft to submission**         | Is the pipeline efficient?         | Measurable reduction vs. manual CIP-108 authoring                     |
| **Reviewer engagement**                   | Is the review system compelling?   | Average >3 reviews per proposal in community review                   |

---

## The One-Line Vision

**Governada is where governance actions are born -- from idea to community feedback to on-chain submission, with structured collaboration and AI intelligence at every step.**

The authoring pipeline doesn't just serve proposers. Every proposal that goes through structured review generates data that helps DReps vote, helps citizens understand governance, and helps the ecosystem learn from its own decision-making history. The proposer's workspace is the starting point of the governance intelligence flywheel.
