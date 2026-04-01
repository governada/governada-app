import { describe, it, expect } from 'vitest';
import { getToolThinkingGlobeCommands, getDisplayStatus } from '@/lib/intelligence/advisor-tools';

// ---------------------------------------------------------------------------
// getToolThinkingGlobeCommands
// ---------------------------------------------------------------------------

describe('getToolThinkingGlobeCommands', () => {
  it('returns sequence for search_dreps', () => {
    const cmds = getToolThinkingGlobeCommands('search_dreps', { query: 'treasury' });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe('sequence');
  });

  it('returns sequence with dim+pulse+flyTo for get_drep_profile', () => {
    const cmds = getToolThinkingGlobeCommands('get_drep_profile', { drep_id: 'drep1abc' });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe('sequence');
    const steps = (cmds[0] as any).steps;
    expect(steps).toHaveLength(3);
    expect(steps[0].command.type).toBe('dim');
    expect(steps[1].command.type).toBe('pulse');
    expect(steps[1].command.nodeId).toBe('drep_drep1abc');
    expect(steps[2].command.type).toBe('flyTo');
    expect(steps[2].command.nodeId).toBe('drep_drep1abc');
  });

  it('returns empty array for get_drep_profile without drep_id', () => {
    const cmds = getToolThinkingGlobeCommands('get_drep_profile', {});
    expect(cmds).toEqual([]);
  });

  it('returns sequence for get_drep_votes with drep_id', () => {
    const cmds = getToolThinkingGlobeCommands('get_drep_votes', { drep_id: 'drep1xyz' });
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].command.type).toBe('flyTo');
    expect(steps[1].command.type).toBe('pulse');
  });

  it('returns empty array for get_drep_votes without drep_id', () => {
    const cmds = getToolThinkingGlobeCommands('get_drep_votes', {});
    expect(cmds).toEqual([]);
  });

  it('returns sequence for get_leaderboard', () => {
    const cmds = getToolThinkingGlobeCommands('get_leaderboard', {});
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe('sequence');
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('dim');
    expect(steps[1].command.type).toBe('scan');
  });

  it('returns sequence for get_proposal with tx_hash', () => {
    const cmds = getToolThinkingGlobeCommands('get_proposal', {
      tx_hash: 'abc123',
      proposal_index: 2,
    });
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps).toHaveLength(3);
    expect(steps[1].command.nodeId).toBe('proposal_abc123_2');
  });

  it('defaults proposal index to 0 when not provided', () => {
    const cmds = getToolThinkingGlobeCommands('get_proposal', { tx_hash: 'xyz789' });
    const steps = (cmds[0] as any).steps;
    expect(steps[1].command.nodeId).toBe('proposal_xyz789_0');
  });

  it('returns empty array for get_proposal without tx_hash', () => {
    const cmds = getToolThinkingGlobeCommands('get_proposal', {});
    expect(cmds).toEqual([]);
  });

  it('returns sequence for list_proposals', () => {
    const cmds = getToolThinkingGlobeCommands('list_proposals', {});
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('warmTopic');
    expect(steps[0].command.topic).toBe('proposals');
  });

  it('returns sequence for get_treasury_status', () => {
    const cmds = getToolThinkingGlobeCommands('get_treasury_status', {});
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('warmTopic');
    expect(steps[0].command.topic).toBe('treasury');
  });

  it('returns sequence for get_governance_health', () => {
    const cmds = getToolThinkingGlobeCommands('get_governance_health', {});
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('warmTopic');
    expect(steps[0].command.topic).toBe('participation');
  });

  it('returns sequence for highlight_cluster', () => {
    const cmds = getToolThinkingGlobeCommands('highlight_cluster', {
      cluster_name: 'Treasury Conservatives',
    });
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('dim');
    expect(steps[1].command.type).toBe('scan');
  });

  it('returns sequence for show_neighborhood with entity_id', () => {
    const cmds = getToolThinkingGlobeCommands('show_neighborhood', { entity_id: 'drep1abc' });
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('dim');
    expect(steps[1].command.type).toBe('pulse');
    expect(steps[1].command.nodeId).toBe('drep_drep1abc');
  });

  it('returns empty array for show_neighborhood without entity_id', () => {
    const cmds = getToolThinkingGlobeCommands('show_neighborhood', {});
    expect(cmds).toEqual([]);
  });

  it('returns sequence for show_controversy', () => {
    const cmds = getToolThinkingGlobeCommands('show_controversy', {});
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('dim');
    expect(steps[1].command.type).toBe('scan');
  });

  it('returns sequence for show_active_entities', () => {
    const cmds = getToolThinkingGlobeCommands('show_active_entities', {});
    expect(cmds).toHaveLength(1);
    const steps = (cmds[0] as any).steps;
    expect(steps[0].command.type).toBe('dim');
    expect(steps[1].command.type).toBe('scan');
  });

  it('returns empty array for unknown tool', () => {
    const cmds = getToolThinkingGlobeCommands('nonexistent_tool', {});
    expect(cmds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDisplayStatus
// ---------------------------------------------------------------------------

describe('getDisplayStatus', () => {
  it('returns correct status for search_dreps', () => {
    expect(getDisplayStatus('search_dreps')).toBe('Searching representatives...');
  });

  it('returns correct status for get_drep_profile', () => {
    expect(getDisplayStatus('get_drep_profile')).toBe('Looking up representative profile...');
  });

  it('returns correct status for get_drep_votes', () => {
    expect(getDisplayStatus('get_drep_votes')).toBe('Checking voting history...');
  });

  it('returns correct status for get_leaderboard', () => {
    expect(getDisplayStatus('get_leaderboard')).toBe('Ranking representatives...');
  });

  it('returns correct status for get_proposal', () => {
    expect(getDisplayStatus('get_proposal')).toBe('Examining proposal details...');
  });

  it('returns correct status for list_proposals', () => {
    expect(getDisplayStatus('list_proposals')).toBe('Scanning proposals...');
  });

  it('returns correct status for get_treasury_status', () => {
    expect(getDisplayStatus('get_treasury_status')).toBe('Checking treasury...');
  });

  it('returns correct status for get_governance_health', () => {
    expect(getDisplayStatus('get_governance_health')).toBe('Assessing governance health...');
  });

  it('returns correct status for highlight_cluster', () => {
    expect(getDisplayStatus('highlight_cluster')).toBe('Exploring governance factions...');
  });

  it('returns correct status for show_neighborhood', () => {
    expect(getDisplayStatus('show_neighborhood')).toBe('Finding nearby entities...');
  });

  it('returns correct status for show_controversy', () => {
    expect(getDisplayStatus('show_controversy')).toBe('Analyzing voting divisions...');
  });

  it('returns correct status for show_active_entities', () => {
    expect(getDisplayStatus('show_active_entities')).toBe('Scanning recent activity...');
  });

  it('returns default status for unknown tool', () => {
    expect(getDisplayStatus('unknown_tool')).toBe('Looking up data...');
  });
});
