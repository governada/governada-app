/**
 * Entity Detector — Phase 5 of Inhabited Constellation
 *
 * Lightweight regex-based detection of governance entities mentioned in
 * Seneca AI response text, mapped to globe visualization commands.
 * Runs on each SSE text chunk in the streaming pipeline — no AI calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeLookup {
  nodesByName: Map<string, string>; // name -> nodeId
  nodesById: Map<string, string>; // fullId -> nodeId
  proposalsByTitle: Map<string, string>; // title fragment -> nodeId
}

export type GlobeCommand =
  | { cmd: 'flyTo'; target: string }
  | { cmd: 'pulse'; target: string }
  | { cmd: 'highlight'; alignment: number[]; threshold: number }
  | { cmd: 'reset' }
  | { cmd: 'clear' };

// ---------------------------------------------------------------------------
// Concept alignments — fixed vectors for governance themes
// ---------------------------------------------------------------------------

const CONCEPT_COMMANDS: Record<string, GlobeCommand> = {
  treasury: {
    cmd: 'highlight',
    alignment: [80, 80, 50, 50, 50, 50],
    threshold: 120,
  },
  decentralization: {
    cmd: 'highlight',
    alignment: [50, 50, 80, 50, 50, 50],
    threshold: 120,
  },
  innovation: {
    cmd: 'highlight',
    alignment: [50, 50, 50, 50, 80, 50],
    threshold: 120,
  },
};

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const DREP_ID_PATTERN = /\bdrep1[a-z0-9]{5,}\b/gi;
const PROPOSAL_REF_PATTERN = /\b(?:proposal|GA-)\s*[#:]?\s*([A-Za-z0-9_-]+)/gi;

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

/**
 * Detect globe commands from a block of AI-generated text.
 *
 * Returns all commands found — caller is responsible for deduplication
 * if needed (or use `EntityDetectorSession` for streaming).
 */
export function detectGlobeCommands(text: string, constellationData: NodeLookup): GlobeCommand[] {
  const commands: GlobeCommand[] = [];

  // 1. DRep names — case-insensitive match against nodesByName keys
  for (const [name, nodeId] of constellationData.nodesByName) {
    // Only match names of 3+ chars to avoid false positives
    if (name.length < 3) continue;

    const escaped = escapeRegex(name);
    const namePattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (namePattern.test(text)) {
      commands.push({ cmd: 'flyTo', target: nodeId });
      commands.push({ cmd: 'pulse', target: nodeId });
    }
  }

  // 2. DRep IDs — match drep1... patterns
  let idMatch: RegExpExecArray | null;
  DREP_ID_PATTERN.lastIndex = 0;
  while ((idMatch = DREP_ID_PATTERN.exec(text)) !== null) {
    const fullId = idMatch[0].toLowerCase();
    const nodeId = constellationData.nodesById.get(fullId);
    if (nodeId) {
      commands.push({ cmd: 'flyTo', target: nodeId });
      commands.push({ cmd: 'pulse', target: nodeId });
    }
  }

  // 3. Proposal references — match "proposal X" or "GA-X" patterns
  PROPOSAL_REF_PATTERN.lastIndex = 0;
  let proposalMatch: RegExpExecArray | null;
  while ((proposalMatch = PROPOSAL_REF_PATTERN.exec(text)) !== null) {
    const ref = proposalMatch[1];
    // Try exact match first, then substring match against title fragments
    const directId = constellationData.proposalsByTitle.get(ref);
    if (directId) {
      commands.push({ cmd: 'flyTo', target: directId });
      commands.push({ cmd: 'pulse', target: directId });
    } else {
      // Substring search through proposal titles
      const refLower = ref.toLowerCase();
      for (const [titleFragment, nodeId] of constellationData.proposalsByTitle) {
        if (titleFragment.toLowerCase().includes(refLower)) {
          commands.push({ cmd: 'flyTo', target: nodeId });
          commands.push({ cmd: 'pulse', target: nodeId });
          break; // Take first match only
        }
      }
    }
  }

  // 4. Governance concepts — keyword matching
  const textLower = text.toLowerCase();
  for (const [concept, command] of Object.entries(CONCEPT_COMMANDS)) {
    if (textLower.includes(concept)) {
      commands.push(command);
    }
  }

  return commands;
}

// ---------------------------------------------------------------------------
// Streaming session — deduplication across chunks
// ---------------------------------------------------------------------------

/**
 * Maintains state across streaming SSE chunks to avoid emitting
 * duplicate globe commands for the same entity.
 */
export class EntityDetectorSession {
  private emittedTargets = new Set<string>();
  private emittedConcepts = new Set<string>();
  private lookup: NodeLookup;

  constructor(lookup: NodeLookup) {
    this.lookup = lookup;
  }

  /**
   * Process a new text chunk, return any NEW commands not previously emitted.
   *
   * @param _newText - The latest chunk (unused, kept for API symmetry)
   * @param accumulatedText - Full text so far (used for detection)
   * @returns Array of new globe commands to dispatch
   */
  processChunk(_newText: string, accumulatedText: string): GlobeCommand[] {
    const allCommands = detectGlobeCommands(accumulatedText, this.lookup);
    const newCommands: GlobeCommand[] = [];

    for (const command of allCommands) {
      if (command.cmd === 'flyTo' || command.cmd === 'pulse') {
        const key = `${command.cmd}:${command.target}`;
        if (!this.emittedTargets.has(key)) {
          this.emittedTargets.add(key);
          newCommands.push(command);
        }
      } else if (command.cmd === 'highlight') {
        // Deduplicate highlight commands by their alignment vector
        const key = `highlight:${command.alignment.join(',')}`;
        if (!this.emittedConcepts.has(key)) {
          this.emittedConcepts.add(key);
          newCommands.push(command);
        }
      } else {
        // reset / clear — always pass through
        newCommands.push(command);
      }
    }

    return newCommands;
  }
}

// ---------------------------------------------------------------------------
// Helper — build NodeLookup from constellation API data
// ---------------------------------------------------------------------------

/**
 * Build a NodeLookup from raw constellation node data.
 * Typically called once when the constellation loads.
 */
export function buildNodeLookup(
  nodes: Array<{ id: string; fullId: string; name: string | null }>,
): NodeLookup {
  const nodesByName = new Map<string, string>();
  const nodesById = new Map<string, string>();
  const proposalsByTitle = new Map<string, string>();

  for (const node of nodes) {
    // Map full IDs (e.g. drep1abc...) to node IDs
    if (node.fullId) {
      nodesById.set(node.fullId.toLowerCase(), node.id);
    }

    // Map names to node IDs
    if (node.name) {
      nodesByName.set(node.name, node.id);
    }
  }

  return { nodesByName, nodesById, proposalsByTitle };
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
