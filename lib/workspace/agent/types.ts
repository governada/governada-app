/**
 * Contract B: Agent Endpoint Request/Response Types
 *
 * Defines the client→server request and the SSE event stream response
 * for the governance workspace AI agent.
 */

import type { EditorContext, ProposedEdit, ProposedComment } from '../editor/types';

/** User's role in the context of this proposal */
export type AgentUserRole = 'proposer' | 'reviewer' | 'cc_member';

/** Client → Server request body */
export interface AgentRequest {
  /** Draft ID or on-chain txHash for the proposal */
  proposalId: string;
  /** Persistent conversation identifier (one per user per proposal) */
  conversationId: string;
  /** User's message to the agent */
  message: string;
  /** Current editor state for context-aware responses */
  editorContext?: EditorContext;
  /** User's role for this proposal */
  userRole: AgentUserRole;
}

/** Server → Client SSE event types */
export type AgentSSEEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call'; toolName: string; status: 'started' | 'completed' }
  | { type: 'edit_proposal'; edit: ProposedEdit }
  | { type: 'draft_comment'; comment: ProposedComment }
  | { type: 'tool_result'; toolName: string; summary: string; data: unknown }
  | { type: 'done' };

/** Stored conversation message */
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Tool calls made during this assistant turn */
  toolCalls?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    result: unknown;
  }>;
  /** Edits proposed during this assistant turn */
  proposedEdits?: ProposedEdit[];
  /** Comments proposed during this assistant turn */
  proposedComments?: ProposedComment[];
}
