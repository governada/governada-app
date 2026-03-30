/**
 * advisor-tools.ts — Tool definitions and executors for Seneca's governance brain.
 *
 * Each tool maps to existing lib/data.ts functions. Executors return compact
 * serialized results + globe choreography commands for visualization.
 *
 * Tool executors use `any` for data rows since lib/data.ts types are complex
 * and varied. The focus is on compact serialization, not type safety of DB rows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { logger } from '@/lib/logger';
import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

// ---------------------------------------------------------------------------
// Tool result type
// ---------------------------------------------------------------------------

export interface ToolResult {
  /** Compact text result for the LLM to consume */
  result: string;
  /** Globe commands to execute as the tool completes */
  globeCommands: GlobeCommand[];
  /** Human-readable status message shown to the user during execution */
  displayStatus: string;
}

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic format)
// ---------------------------------------------------------------------------

export const ADVISOR_TOOLS = [
  {
    name: 'search_dreps',
    description:
      'Search DReps by name, handle, or governance alignment criteria. Returns matches with scores, participation rates, and alignment profiles. Use when the user asks about finding representatives, filtering DReps, or wants to know who focuses on specific governance topics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Name, handle, ticker, or topic to search for (e.g., "treasury", "decentralization")',
        },
        min_score: {
          type: 'number',
          description: 'Minimum governance score (0-100) to filter by',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_drep_profile',
    description:
      "Get a specific DRep's complete profile: governance score, participation rate, alignment dimensions, delegation stats, tier, and rank. Use when asked about a specific representative.",
    input_schema: {
      type: 'object' as const,
      properties: {
        drep_id: {
          type: 'string',
          description: 'DRep bech32 ID, name, or handle',
        },
      },
      required: ['drep_id'],
    },
  },
  {
    name: 'get_drep_votes',
    description:
      "Get a DRep's voting history with proposal context and rationales. Use when asked about how a specific representative voted.",
    input_schema: {
      type: 'object' as const,
      properties: {
        drep_id: {
          type: 'string',
          description: 'DRep bech32 ID',
        },
        limit: {
          type: 'number',
          description: 'Max votes to return (default 10)',
        },
      },
      required: ['drep_id'],
    },
  },
  {
    name: 'get_leaderboard',
    description:
      'Get top-ranked DReps sorted by governance score, participation rate, or rationale quality. Use for "top DReps", "best representatives", leaderboard queries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sort_by: {
          type: 'string',
          enum: ['score', 'participation', 'rationale'],
          description: 'Sort criteria (default: score)',
        },
        limit: {
          type: 'number',
          description: 'Number of DReps to return (default 10)',
        },
      },
    },
  },
  {
    name: 'get_proposal',
    description:
      'Get detailed proposal information including vote counts, type, status, and voting breakdown by body (DRep/SPO/CC). Use when asked about a specific proposal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tx_hash: {
          type: 'string',
          description: 'Proposal transaction hash',
        },
        proposal_index: {
          type: 'number',
          description: 'Proposal index within the transaction',
        },
      },
      required: ['tx_hash', 'proposal_index'],
    },
  },
  {
    name: 'list_proposals',
    description:
      'List governance proposals with optional filters. Returns proposals with vote summaries and status. Use for browsing or filtering proposals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'voting', 'ratified', 'enacted', 'expired', 'dropped'],
          description: 'Filter by status',
        },
        type: {
          type: 'string',
          description: 'Filter by proposal type (e.g., TreasuryWithdrawals, ParameterChange)',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10)',
        },
      },
    },
  },
  {
    name: 'get_treasury_status',
    description:
      'Get current treasury balance, pending withdrawal proposals, and spending summary. Use for treasury questions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_governance_health',
    description:
      'Get the Governance Health Index (GHI) score, component breakdown (participation, deliberation, power distribution, etc.), and Constitutional Committee health summary.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  // --- Discovery tools (Chunk 2) ---
  {
    name: 'highlight_cluster',
    description:
      'Highlight a governance faction (cluster) on the constellation globe. Use when the user asks about factions, groups, clusters, or governance alignments like "show me the treasury faction" or "who are the innovation advocates".',
    input_schema: {
      type: 'object' as const,
      properties: {
        cluster_name: {
          type: 'string',
          description:
            'Name or keyword to match a cluster (e.g., "Treasury Conservatives", "innovation", "security")',
        },
        dimension: {
          type: 'string',
          description:
            'Governance dimension to highlight (treasury, decentralization, security, innovation, transparency)',
        },
      },
    },
  },
  {
    name: 'show_neighborhood',
    description:
      "Show entities that are spatially near a specific DRep in governance alignment space. Use when the user asks about similar DReps, neighbors, or 'who is like X'.",
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: {
          type: 'string',
          description: 'DRep ID, name, or handle',
        },
        entity_type: {
          type: 'string',
          enum: ['drep'],
          description: 'Entity type (currently only drep supported)',
        },
        count: {
          type: 'number',
          description: 'Number of neighbors to show (default 5, max 10)',
        },
      },
      required: ['entity_id'],
    },
  },
  {
    name: 'show_controversy',
    description:
      'Find the most controversial proposals — those with the biggest voting split between DReps and SPOs. Use when the user asks about controversy, disagreements, contested proposals, or voting splits.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'show_active_entities',
    description:
      'Show the most recently active governance entities — DReps who voted most recently, or proposals currently accepting votes. Use when the user asks "who is active?", "what\'s happening?", or wants to see current activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_type: {
          type: 'string',
          enum: ['drep', 'proposal'],
          description: 'Type of entity to show (default: drep)',
        },
      },
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Globe choreography per tool (thinking/scanning phase)
// ---------------------------------------------------------------------------

/**
 * Globe choreography during tool "thinking" phase.
 *
 * Returns commands that create a progressive reveal effect:
 * 1. Initial: scan/sweep effect to show Seneca is searching
 * 2. On result: the advisor.ts loop sends result-specific commands
 *
 * For sequenced effects, returns a single `sequence` command.
 */
export function getToolThinkingGlobeCommands(
  toolName: string,
  toolInput: Record<string, unknown>,
): GlobeCommand[] {
  switch (toolName) {
    case 'search_dreps':
      // Progressive scan: dim → scan across DRep space → reveal matches
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [50, 50, 50, 50, 50, 50], durationMs: 600 },
              delayMs: 200,
            },
          ],
        },
      ];

    case 'get_drep_profile': {
      const id = toolInput.drep_id as string | undefined;
      if (!id) return [];
      // Dim everything, then pulse the target node
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            { command: { type: 'pulse', nodeId: `drep_${id}` }, delayMs: 300 },
            { command: { type: 'flyTo', nodeId: `drep_${id}` }, delayMs: 100 },
          ],
        },
      ];
    }

    case 'get_drep_votes': {
      const id = toolInput.drep_id as string | undefined;
      if (!id) return [];
      // Fly to the DRep and pulse while loading votes
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'flyTo', nodeId: `drep_${id}` }, delayMs: 0 },
            { command: { type: 'pulse', nodeId: `drep_${id}` }, delayMs: 400 },
          ],
        },
      ];
    }

    case 'get_leaderboard':
      // Scan across the constellation, then highlight top tier
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [80, 80, 80, 80, 80, 80], durationMs: 800 },
              delayMs: 200,
            },
          ],
        },
      ];

    case 'get_proposal': {
      const hash = toolInput.tx_hash as string | undefined;
      const idx = toolInput.proposal_index as number | undefined;
      if (!hash) return [];
      const nodeId = `proposal_${hash}_${idx ?? 0}`;
      // Dim → fly to proposal → pulse
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            { command: { type: 'flyTo', nodeId }, delayMs: 200 },
            { command: { type: 'pulse', nodeId }, delayMs: 400 },
          ],
        },
      ];
    }

    case 'list_proposals':
      // Warm the proposal space with a scan
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'warmTopic', topic: 'proposals' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [50, 50, 50, 80, 50, 50], durationMs: 600 },
              delayMs: 300,
            },
          ],
        },
      ];

    case 'get_treasury_status':
      // Treasury affects the whole constellation — warm glow then scan
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'warmTopic', topic: 'treasury' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [85, 20, 50, 50, 50, 50], durationMs: 1000 },
              delayMs: 400,
            },
          ],
        },
      ];

    case 'get_governance_health':
      // Broad scan — governance health touches everything
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'warmTopic', topic: 'participation' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [50, 50, 50, 50, 50, 50], durationMs: 1200 },
              delayMs: 300,
            },
          ],
        },
      ];

    // --- Discovery tools ---

    case 'highlight_cluster':
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [50, 50, 50, 50, 50, 50], durationMs: 800 },
              delayMs: 200,
            },
          ],
        },
      ];

    case 'show_neighborhood': {
      const id = toolInput.entity_id as string | undefined;
      if (!id) return [];
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            { command: { type: 'pulse', nodeId: `drep_${id}` }, delayMs: 300 },
          ],
        },
      ];
    }

    case 'show_controversy':
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [50, 50, 50, 50, 50, 50], durationMs: 1000 },
              delayMs: 200,
            },
          ],
        },
      ];

    case 'show_active_entities':
      return [
        {
          type: 'sequence',
          steps: [
            { command: { type: 'dim' }, delayMs: 0 },
            {
              command: { type: 'scan', alignment: [60, 60, 60, 60, 60, 60], durationMs: 600 },
              delayMs: 200,
            },
          ],
        },
      ];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Tool display status messages
// ---------------------------------------------------------------------------

function getDisplayStatus(toolName: string): string {
  switch (toolName) {
    case 'search_dreps':
      return 'Searching representatives...';
    case 'get_drep_profile':
      return 'Looking up representative profile...';
    case 'get_drep_votes':
      return 'Checking voting history...';
    case 'get_leaderboard':
      return 'Ranking representatives...';
    case 'get_proposal':
      return 'Examining proposal details...';
    case 'list_proposals':
      return 'Scanning proposals...';
    case 'get_treasury_status':
      return 'Checking treasury...';
    case 'get_governance_health':
      return 'Assessing governance health...';
    case 'highlight_cluster':
      return 'Exploring governance factions...';
    case 'show_neighborhood':
      return 'Finding nearby entities...';
    case 'show_controversy':
      return 'Analyzing voting divisions...';
    case 'show_active_entities':
      return 'Scanning recent activity...';
    default:
      return 'Looking up data...';
  }
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

export async function executeAdvisorTool(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<ToolResult> {
  const displayStatus = getDisplayStatus(toolName);

  try {
    switch (toolName) {
      case 'search_dreps':
        return { ...(await executeSearchDreps(toolInput)), displayStatus };
      case 'get_drep_profile':
        return { ...(await executeGetDrepProfile(toolInput)), displayStatus };
      case 'get_drep_votes':
        return { ...(await executeGetDrepVotes(toolInput)), displayStatus };
      case 'get_leaderboard':
        return { ...(await executeGetLeaderboard(toolInput)), displayStatus };
      case 'get_proposal':
        return { ...(await executeGetProposal(toolInput)), displayStatus };
      case 'list_proposals':
        return { ...(await executeListProposals(toolInput)), displayStatus };
      case 'get_treasury_status':
        return { ...(await executeGetTreasuryStatus()), displayStatus };
      case 'get_governance_health':
        return { ...(await executeGetGovernanceHealth()), displayStatus };
      case 'highlight_cluster': {
        const { executeHighlightCluster } = await import('./advisor-discovery-tools');
        return { ...(await executeHighlightCluster(toolInput)), displayStatus };
      }
      case 'show_neighborhood': {
        const { executeShowNeighborhood } = await import('./advisor-discovery-tools');
        return { ...(await executeShowNeighborhood(toolInput)), displayStatus };
      }
      case 'show_controversy': {
        const { executeShowControversy } = await import('./advisor-discovery-tools');
        return { ...(await executeShowControversy()), displayStatus };
      }
      case 'show_active_entities': {
        const { executeShowActiveEntities } = await import('./advisor-discovery-tools');
        return { ...(await executeShowActiveEntities(toolInput)), displayStatus };
      }
      default:
        return {
          result: `Unknown tool: ${toolName}`,
          globeCommands: [],
          displayStatus: 'Unknown tool',
        };
    }
  } catch (err) {
    logger.error(`[Advisor Tool] ${toolName} failed`, { error: err, input: toolInput });
    return {
      result: `Error executing ${toolName}: ${err instanceof Error ? err.message : 'unknown error'}`,
      globeCommands: [{ type: 'reset' }],
      displayStatus,
    };
  }
}

// ---------------------------------------------------------------------------
// Individual tool implementations
// ---------------------------------------------------------------------------

async function executeSearchDreps(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getAllDReps } = await import('@/lib/data');
  const { dreps } = await getAllDReps();

  const query = (input.query as string).toLowerCase();
  const minScore = (input.min_score as number) ?? 0;
  const limit = Math.min((input.limit as number) ?? 10, 15);

  // Search by name/handle match or alignment topic
  const alignmentKeywords: Record<string, number[]> = {
    treasury: [85, 85, 50, 50, 50, 50],
    conservative: [90, 15, 50, 50, 50, 50],
    growth: [15, 90, 50, 50, 50, 50],
    decentralization: [50, 50, 90, 50, 50, 50],
    security: [50, 50, 50, 90, 50, 50],
    innovation: [50, 50, 50, 50, 90, 50],
    transparency: [50, 50, 50, 50, 50, 90],
  };

  // Check if query matches an alignment keyword
  const alignmentMatch = Object.entries(alignmentKeywords).find(([key]) => query.includes(key));

  let filtered = dreps.filter((d) => (d.drepScore ?? 0) >= minScore);

  if (alignmentMatch) {
    // Sort by alignment distance to the keyword vector
    const targetAlignment = alignmentMatch[1];
    filtered = filtered
      .filter((d) => d.alignmentTreasuryConservative != null)
      .map((d) => {
        const vec = [
          d.alignmentTreasuryConservative ?? 50,
          d.alignmentTreasuryGrowth ?? 50,
          d.alignmentDecentralization ?? 50,
          d.alignmentSecurity ?? 50,
          d.alignmentInnovation ?? 50,
          d.alignmentTransparency ?? 50,
        ];
        const dist = Math.sqrt(vec.reduce((sum, v, i) => sum + (v - targetAlignment[i]) ** 2, 0));
        return { ...d, _dist: dist };
      })
      .sort((a, b) => a._dist - b._dist);
  } else {
    // Text search by name/handle
    filtered = filtered.filter((d) => {
      const name = (d.name || d.handle || d.drepId || '').toString().toLowerCase();
      return name.includes(query) || d.drepId.toLowerCase().includes(query);
    });
  }

  const results = filtered.slice(0, limit);

  if (results.length === 0) {
    return {
      result: `No DReps found matching "${input.query}". Try a different search term or broaden criteria.`,
      globeCommands: [{ type: 'clear' }],
    };
  }

  const lines = results.map((d, i) => {
    const name = d.name || d.handle || d.drepId.slice(0, 16) + '...';
    return `${i + 1}. ${name} — Score: ${d.drepScore ?? 0}, Participation: ${d.participationRate ?? 0}%, ID: ${d.drepId.slice(0, 24)}`;
  });

  // Globe: highlight matching DReps
  const globeCommands: GlobeCommand[] = alignmentMatch
    ? [{ type: 'highlight', alignment: alignmentMatch[1], threshold: 100, zoomToCluster: true }]
    : results.length > 0
      ? [{ type: 'flyTo', nodeId: `drep_${results[0].drepId}` }]
      : [{ type: 'clear' }];

  return {
    result: `Found ${results.length} DReps matching "${input.query}":\n${lines.join('\n')}`,
    globeCommands,
  };
}

async function executeGetDrepProfile(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getDRepById, getDRepRank, getAllDReps } = await import('@/lib/data');

  let drepId = input.drep_id as string;

  // If it doesn't look like a bech32 ID, search by name
  if (!drepId.startsWith('drep1') && drepId.length < 40) {
    const { dreps } = await getAllDReps();
    const match = dreps.find((d) => {
      const name = (d.name || d.handle || '').toString().toLowerCase();
      return name.includes(drepId.toLowerCase());
    });
    if (match) drepId = match.drepId;
    else
      return {
        result: `DRep "${input.drep_id}" not found. Try searching by name.`,
        globeCommands: [{ type: 'clear' }],
      };
  }

  const drep = await getDRepById(drepId);
  if (!drep) {
    return { result: `DRep "${drepId}" not found.`, globeCommands: [{ type: 'clear' }] };
  }

  const rank = await getDRepRank(drepId);
  const drepName = drep.name || drep.handle || drepId.slice(0, 16);

  const lines = [
    `**${drepName}** (${drepId.slice(0, 20)}...)`,
    `Score: ${drep.drepScore ?? 0}/100 | Rank: #${rank ?? '?'} | Participation: ${drep.participationRate ?? 0}%`,
    `Rationale rate: ${drep.rationaleRate ?? 0}% | Delegators: ${drep.delegatorCount ?? 0}`,
    drep.sizeTier ? `Tier: ${drep.sizeTier}` : '',
    drep.alignmentTreasuryConservative != null
      ? `Alignment: Treasury Conservative ${drep.alignmentTreasuryConservative}, Growth ${drep.alignmentTreasuryGrowth ?? 50}, Decentralization ${drep.alignmentDecentralization ?? 50}, Security ${drep.alignmentSecurity ?? 50}, Innovation ${drep.alignmentInnovation ?? 50}, Transparency ${drep.alignmentTransparency ?? 50}`
      : '',
    drep.description ? `Description: ${drep.description.slice(0, 200)}` : '',
  ].filter(Boolean);

  return {
    result: lines.join('\n'),
    globeCommands: [{ type: 'flyTo', nodeId: `drep_${drepId}` }],
  };
}

async function executeGetDrepVotes(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getVotesByDRepId } = await import('@/lib/data');
  const drepId = input.drep_id as string;
  const limit = Math.min((input.limit as number) ?? 10, 15);

  const votes = await getVotesByDRepId(drepId);
  if (!votes || votes.length === 0) {
    return { result: `No votes found for DRep ${drepId.slice(0, 20)}.`, globeCommands: [] };
  }

  const recent = votes.slice(0, limit);
  const lines = recent.map((v: any) => {
    const title = v.proposal_title || v.tx_hash;
    return `- ${v.vote} on "${String(title).slice(0, 60)}" (epoch ${v.epoch_no ?? '?'})`;
  });

  // Pulse the DRep
  const globeCommands: GlobeCommand[] = [{ type: 'pulse', nodeId: `drep_${drepId}` }];

  return {
    result: `Recent ${recent.length} votes for ${drepId.slice(0, 20)}:\n${lines.join('\n')}`,
    globeCommands,
  };
}

async function executeGetLeaderboard(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getLeaderboard } = await import('@/lib/data');
  const sortBy = (input.sort_by as 'score' | 'participation' | 'rationale') ?? 'score';
  const limit = Math.min((input.limit as number) ?? 10, 15);

  const entries: any[] = await getLeaderboard(limit, sortBy);
  if (!entries || entries.length === 0) {
    return { result: 'No leaderboard data available.', globeCommands: [] };
  }

  const lines = entries.map((e: any, i: number) => {
    return `${i + 1}. ${e.name || e.drepId?.slice(0, 16)} — Score: ${e.score ?? e.drepScore}, Participation: ${e.participation ?? e.participationRate}%, ID: ${(e.drepId || e.id || '').slice(0, 24)}`;
  });

  // Highlight top DReps on globe
  const topId = entries[0]?.drepId || entries[0]?.id;
  const globeCommands: GlobeCommand[] = topId ? [{ type: 'flyTo', nodeId: `drep_${topId}` }] : [];

  return {
    result: `Top ${entries.length} DReps by ${sortBy}:\n${lines.join('\n')}`,
    globeCommands,
  };
}

async function executeGetProposal(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getProposalByKey, getVotesByProposal } = await import('@/lib/data');
  const txHash = input.tx_hash as string;
  const index = (input.proposal_index as number) ?? 0;

  const proposal: any = await getProposalByKey(txHash, index);
  if (!proposal) {
    return { result: `Proposal ${txHash.slice(0, 16)}#${index} not found.`, globeCommands: [] };
  }

  const votes: any = await getVotesByProposal(txHash, index);
  const drepVotes = Array.isArray(votes) ? votes : (votes?.drepVotes ?? []);
  const yesCount = drepVotes.filter((v: any) => v.vote === 'Yes').length;
  const noCount = drepVotes.filter((v: any) => v.vote === 'No').length;
  const abstainCount = drepVotes.filter((v: any) => v.vote === 'Abstain').length;

  const lines = [
    `**${proposal.title}**`,
    `Type: ${proposal.type || proposal.proposalType} | Status: ${proposal.status}`,
    `DRep votes: ${yesCount} Yes, ${noCount} No, ${abstainCount} Abstain`,
    proposal.abstract ? `Summary: ${String(proposal.abstract).slice(0, 200)}` : '',
  ].filter(Boolean);

  return {
    result: lines.join('\n'),
    globeCommands: [{ type: 'voteSplit', proposalRef: `${txHash}_${index}` }],
  };
}

async function executeListProposals(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getAllProposalsWithVoteSummary } = await import('@/lib/data');
  const limit = Math.min((input.limit as number) ?? 10, 15);

  const proposals: any[] = await getAllProposalsWithVoteSummary();
  if (!proposals || proposals.length === 0) {
    return { result: 'No proposals found.', globeCommands: [] };
  }

  let filtered = proposals;
  if (input.status) {
    filtered = filtered.filter((p: any) => p.status === input.status);
  }
  if (input.type) {
    filtered = filtered.filter((p: any) => (p.type || p.proposalType) === input.type);
  }

  const results = filtered.slice(0, limit);
  const lines = results.map((p: any, i: number) => {
    const hash = p.txHash || p.tx_hash || '';
    return `${i + 1}. [${p.type || p.proposalType}] "${String(p.title).slice(0, 60)}" (${p.status}) — ${hash.slice(0, 12)}#${p.index ?? 0}`;
  });

  const firstHash = results[0]?.txHash || results[0]?.tx_hash;
  return {
    result: `${results.length} proposals${input.status ? ` (${input.status})` : ''}:\n${lines.join('\n')}`,
    globeCommands: firstHash
      ? [{ type: 'pulse', nodeId: `proposal_${firstHash}_${results[0]?.index ?? 0}` }]
      : [],
  };
}

async function executeGetTreasuryStatus(): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getSupabaseAdmin();

  const [snapshotRes, pendingRes] = await Promise.all([
    supabase
      .from('treasury_snapshots')
      .select('balance_lovelace, epoch_no')
      .order('epoch_no', { ascending: false })
      .limit(2),
    supabase
      .from('proposals')
      .select('title, type, status, tx_hash, index')
      .eq('type', 'TreasuryWithdrawals')
      .in('status', ['active', 'voting']),
  ]);

  const snapshots = snapshotRes.data ?? [];
  const pending = pendingRes.data ?? [];

  if (snapshots.length === 0) {
    return { result: 'Treasury data not available.', globeCommands: [] };
  }

  const latest = snapshots[0];
  const balanceAda = Math.round(Number(BigInt(latest.balance_lovelace ?? 0) / BigInt(1_000_000)));
  const formatted =
    balanceAda >= 1_000_000_000
      ? `${(balanceAda / 1_000_000_000).toFixed(2)}B`
      : balanceAda >= 1_000_000
        ? `${(balanceAda / 1_000_000).toFixed(1)}M`
        : balanceAda.toLocaleString();

  const lines = [
    `Treasury balance: ${formatted} ADA (epoch ${latest.epoch_no})`,
    `Pending withdrawals: ${pending.length} proposals`,
  ];

  if (pending.length > 0) {
    for (const p of pending.slice(0, 5)) {
      lines.push(`- "${String(p.title).slice(0, 60)}" (${p.status})`);
    }
  }

  return {
    result: lines.join('\n'),
    globeCommands: [
      { type: 'highlight', alignment: [85, 20, 50, 50, 50, 50], threshold: 200, noZoom: true },
    ],
  };
}

async function executeGetGovernanceHealth(): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getSupabaseAdmin } = await import('@/lib/supabase');
  const { getCCHealthSummary } = await import('@/lib/data');
  const supabase = getSupabaseAdmin();

  const [ghiRes, ccHealth] = await Promise.all([
    supabase
      .from('ghi_snapshots')
      .select('epoch_no, score, band, components, narrative')
      .order('epoch_no', { ascending: false })
      .limit(1),
    getCCHealthSummary().catch(() => null),
  ]);

  const ghi = ghiRes.data?.[0];
  const lines: string[] = [];

  if (ghi) {
    lines.push(`Governance Health Index: ${Math.round(ghi.score)}/100 (${ghi.band})`);

    const components = (ghi.components as Array<{ name: string; value: number }>) ?? [];
    if (components.length > 0) {
      lines.push(
        'Components: ' + components.map((c) => `${c.name} ${Math.round(c.value)}`).join(', '),
      );
    }

    if (ghi.narrative) {
      lines.push(`Narrative: ${String(ghi.narrative).slice(0, 200)}`);
    }
  } else {
    lines.push('GHI data not available.');
  }

  if (ccHealth) {
    lines.push('');
    lines.push(
      `Constitutional Committee: ${ccHealth.totalMembers} members, avg fidelity ${Math.round(ccHealth.avgFidelity ?? 0)}%, trend: ${ccHealth.trend}`,
    );
  }

  return {
    result: lines.join('\n'),
    globeCommands: [
      { type: 'highlight', alignment: [50, 50, 50, 50, 50, 50], threshold: 250, noZoom: true },
    ],
  };
}
