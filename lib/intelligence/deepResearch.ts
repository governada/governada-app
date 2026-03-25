/**
 * Deep Research — Research plan orchestration for Seneca Tier 3.
 *
 * Decomposes a user question into 3-5 sub-queries based on content heuristics.
 * The actual execution happens server-side via the /api/intelligence/research endpoint.
 * This file defines the plan structure and a client-side helper to create a plan.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  summary?: string;
}

export interface ResearchPlan {
  question: string;
  steps: ResearchStep[];
}

// ---------------------------------------------------------------------------
// Step templates
// ---------------------------------------------------------------------------

interface StepTemplate {
  id: string;
  label: string;
}

const STEP_TEMPLATES = {
  gatherContext: { id: 'gather-context', label: 'Gathering governance context' },
  analyzeData: { id: 'analyze-data', label: 'Analyzing data' },
  synthesize: { id: 'synthesize', label: 'Synthesizing findings' },
  comparison: { id: 'comparison', label: 'Comparing entities' },
  treasuryAnalysis: { id: 'treasury', label: 'Analyzing treasury impact' },
  constitutionalCheck: { id: 'constitutional', label: 'Checking constitutional alignment' },
  entityAnalysis: { id: 'entity-analysis', label: 'Analyzing entity record' },
  votingPatterns: { id: 'voting-patterns', label: 'Reviewing voting patterns' },
  proposalAnalysis: { id: 'proposal-analysis', label: 'Analyzing proposal details' },
} as const satisfies Record<string, StepTemplate>;

// ---------------------------------------------------------------------------
// Heuristic planner
// ---------------------------------------------------------------------------

/**
 * Decompose a question into a research plan using keyword heuristics.
 * Returns 3-5 steps based on the content of the question.
 */
export function planResearch(
  question: string,
  context: { pageContext?: string; entityId?: string },
): ResearchPlan {
  const lower = question.toLowerCase();
  const steps: StepTemplate[] = [];

  // Always start with context gathering
  steps.push(STEP_TEMPLATES.gatherContext);

  // Comparison queries
  if (/\bcompar/i.test(lower) || /\bvs\.?\b/i.test(lower) || /\bdifference/i.test(lower)) {
    steps.push(STEP_TEMPLATES.comparison);
  }

  // Treasury queries
  if (/\btreasur/i.test(lower) || /\bbudget/i.test(lower) || /\bspending/i.test(lower)) {
    steps.push(STEP_TEMPLATES.treasuryAnalysis);
  }

  // Constitutional queries
  if (
    /\bconstitution/i.test(lower) ||
    /\bguardrail/i.test(lower) ||
    /\blegal/i.test(lower) ||
    /\bcomplian/i.test(lower)
  ) {
    steps.push(STEP_TEMPLATES.constitutionalCheck);
  }

  // Specific entity queries (DRep, SPO, CC member)
  if (
    context.entityId ||
    /\bdrep\b/i.test(lower) ||
    /\brepresentative/i.test(lower) ||
    /\bspo\b/i.test(lower) ||
    /\bpool\b/i.test(lower) ||
    /\bcommittee/i.test(lower)
  ) {
    steps.push(STEP_TEMPLATES.entityAnalysis);
  }

  // Voting pattern queries
  if (
    /\bvot(e|ing|ed)\b/i.test(lower) ||
    /\bparticipat/i.test(lower) ||
    /\battendance/i.test(lower)
  ) {
    steps.push(STEP_TEMPLATES.votingPatterns);
  }

  // Proposal queries
  if (
    /\bproposal/i.test(lower) ||
    /\baction\b/i.test(lower) ||
    /\bgovernance action/i.test(lower)
  ) {
    steps.push(STEP_TEMPLATES.proposalAnalysis);
  }

  // If we only have the gather step (no specific domain detected), add a generic analysis step
  if (steps.length === 1) {
    steps.push(STEP_TEMPLATES.analyzeData);
  }

  // Always end with synthesis
  steps.push(STEP_TEMPLATES.synthesize);

  // Deduplicate (in case something was double-added)
  const seen = new Set<string>();
  const dedupedSteps = steps.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // Cap at 5 steps (gather + 3 domain + synthesize)
  const finalSteps = dedupedSteps.slice(0, 5);

  return {
    question,
    steps: finalSteps.map((template) => ({
      id: template.id,
      label: template.label,
      status: 'pending' as const,
    })),
  };
}
