# Vision Document Changelog

Track incremental updates to `ultimate-vision.md` and persona docs. Agents should log changes here when updating vision documents.

## Format

```
### vX.Y -- YYYY-MM-DD
- **Section:** What changed and why
```

---

### v2.1 -- 2026-03-07

- **Build sequence:** Complete rewrite grounded in codebase audit. Compressed completed Steps 0-3 into "Foundation" summary with existing infrastructure inventory (269+ components, 145 API routes, 75+ tables, 24 Inngest functions). Renumbered forward steps: Step 4 (Citizen Experience), Step 5 (Governance Workspace), Step 6 (Community Engagement), Step 7 (Viral Growth), Step 8 (Monetization), Step 9 (API Platform), Step 10 (Advanced Intelligence), Step 11 (New Product Lines). Each forward step now specifies: what exists to reuse/modify, what is net-new, primary/secondary personas served.
- **Monetization Roadmap:** Updated step references to match new numbering. Consolidated DRep Pro + SPO Pro + Premium Delegator + Verified Projects under Step 8.
- **Wow Framework:** Updated all step references from old numbering (Steps 0-3.75) to new (Foundation + Steps 4-10).
- **Data Compounding Schedule:** Updated step references. Added new snapshots for Steps 4-7 (citizen_milestones, citizen_briefings, governance_actions, rationale_documents, citizen_concern_flags, citizen_assembly_responses, citizen_impact_scores).
- **Integration Opportunities:** Marked all Koios integrations as "Foundation (done)". Updated MeshJS CIP-95 to Step 5, Catalyst to Step 11a, Midnight to Step 11b.

### v2.0 -- 2026-03-07

- **Full document:** V2 rewrite. Persona-centric reframe, civic hub thesis, governance workspace, community engagement layer, treasury accountability. Added Steps 3.5 and 3.75 to build sequence. Updated principles from 8 to 11. Expanded data flywheel with civic engagement inputs. Added distribution strategy section.
- **Personas:** Created 6 persona documents in `docs/strategy/personas/`: citizen, drep, spo, cc-member, treasury-team, researcher, integration-partner. Dropped Cross-Chain Observer persona, added Integration Partner.
- **Build sequence:** Restored full detail for Steps 8-11 (rationale, monetization angles, data modeling milestones).

### v1.0 -- 2026-03 (original)

- **Full document:** Original vision document. Governance intelligence layer framing, 7 personas, build sequence Steps 0-11, monetization roadmap, wow framework, data compounding schedule, principles.
