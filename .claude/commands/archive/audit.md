Perform a structured product audit of Governada against the vision and quality standards.

## Scope

Argument: `$ARGUMENTS`

- If empty or "full": Full audit across all 10 rubric dimensions
- If "step:N" (e.g., "step:4"): Focused audit on a specific build step
- If area name (e.g., "performance", "ux", "engine"): Focused audit on a specific rubric dimension

## Phase 1: Preparation

1. Read `docs/strategy/context/audit-rubric.md` — this defines the scoring criteria. Every score MUST be anchored to these criteria.
2. Read `docs/strategy/context/build-manifest.md` — this is the checkbox-level status of what's shipped.
3. For full audits, skim `docs/strategy/ultimate-vision.md` sections relevant to gaps (don't re-read shipped steps in detail).
4. For step-focused audits, read the relevant persona doc from `docs/strategy/personas/`.

## Phase 2: Evidence Collection

For each rubric dimension in scope, collect CONCRETE evidence:

- **Intelligence Engine:** Read scoring tests, check snapshot tables, verify calibration
- **Citizen Experience:** Read HomeCitizen, EpochBriefing, onboarding flow, TreasuryCitizenView
- **Governance Workspace:** Read vote casting flow, rationale pipeline, proposal workspace
- **Community Engagement:** Read engagement components, anti-gaming measures, signal aggregation
- **Data Architecture:** Check sync_log for failures, data_freshness_checks, snapshot coverage
- **UX & Visual Design:** Check component consistency, loading states, error states, accessibility
- **Performance:** Launch the `perf-auditor` agent (`.claude/agents/perf-auditor.md`) as a subagent for automated evidence collection. Also review Lighthouse-relevant patterns manually.
- **Testing:** Run `npm run test:coverage`, check CI reliability, review test quality
- **API & Integration:** Read v1 routes, developer page, embed system, rate limiting
- **Product Completeness:** Walk through build-manifest checkboxes against production

Use parallel subagents for independent dimensions to maximize speed.

### Competitive Intelligence (Required for full audits)

Use WebSearch to check the current state of competitors listed in `docs/strategy/context/competitive-landscape.md`:

1. Search for each direct competitor (GovTool, DRep.tools, Tally, SubSquare, Snapshot)
2. Note any new features, UX changes, or competitive moves since the last check
3. Update the competitive-landscape.md file with findings and timestamps
4. Search for latest best practices in key tech areas (Next.js patterns, React 19 features, Tailwind v4, D3 visualization trends)
5. Flag any competitor moves that threaten or validate Governada's approach

## Phase 3: Scoring

Score each dimension 1-10 using the rubric anchors. Requirements:

- Every score must cite specific files, routes, or measurements as evidence
- Never score higher than the evidence supports — this audit exists to find gaps, not to congratulate
- Compare against the competitive benchmark set in the rubric
- Call out specific "state of the art" gaps using the Tech Currency Checklist

## Phase 4: Work Plan

1. Read `docs/strategy/context/work-plan-template.md` for the output format
2. Convert every gap and opportunity into a prioritized chunk
3. Group chunks into PR groups following the template's grouping rules
4. Sequence chunks following the template's sequencing rules
5. Flag decision points where the user needs to weigh in before an agent builds

## Output Format

Present the complete audit following the format in `audit-rubric.md`:

1. Score table (all 10 dimensions with evidence and top gap)
2. Critical gaps list
3. High-impact opportunities list
4. State-of-the-art assessment
5. Complete work plan with chunks following the template format

## Rules

- Be BRUTALLY honest. A 7/10 that should be a 5/10 wastes everyone's time.
- Don't score dimensions you didn't collect evidence for — flag them as "NOT EVALUATED" with reason.
- Don't propose work that isn't grounded in the audit findings.
- The work plan IS the deliverable. The scores are context for prioritization.
- Write the work plan so any future agent can pick up a chunk, do a deep-dive into the relevant files, ask the user targeted questions if needed, and execute autonomously.
- After presenting the work plan, ask the user: "Which chunks should I start? I can run multiple agents in parallel on independent chunks."
