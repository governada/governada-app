import type { ConcernFlagType, PriorityArea } from '@/lib/api/schemas/engagement';

export const CONCERN_FLAG_LABELS: Record<ConcernFlagType, { label: string; emoji: string }> = {
  too_expensive: { label: 'Too Expensive', emoji: '💰' },
  team_unproven: { label: 'Team Unproven', emoji: '👤' },
  duplicates_existing: { label: 'Duplicates Existing', emoji: '🔄' },
  constitutional_concern: { label: 'Constitutional Concern', emoji: '📜' },
  insufficient_detail: { label: 'Insufficient Detail', emoji: '📝' },
  unrealistic_timeline: { label: 'Unrealistic Timeline', emoji: '⏰' },
  conflict_of_interest: { label: 'Conflict of Interest', emoji: '⚖️' },
  scope_too_broad: { label: 'Scope Too Broad', emoji: '🔭' },
};

export const PRIORITY_LABELS: Record<PriorityArea, { label: string; icon: string }> = {
  infrastructure: { label: 'Infrastructure', icon: '🏗️' },
  education: { label: 'Education', icon: '📚' },
  defi: { label: 'DeFi', icon: '💱' },
  marketing: { label: 'Marketing', icon: '📣' },
  developer_tooling: { label: 'Developer Tooling', icon: '🛠️' },
  governance_tooling: { label: 'Governance Tooling', icon: '🏛️' },
  identity_dids: { label: 'Identity & DIDs', icon: '🪪' },
  interoperability: { label: 'Interoperability', icon: '🔗' },
  security_auditing: { label: 'Security & Auditing', icon: '🔒' },
  community_hubs: { label: 'Community Hubs', icon: '🤝' },
  research: { label: 'Research', icon: '🔬' },
  media_content: { label: 'Media & Content', icon: '📰' },
};

// Simple string-only lookup for components that only need labels (not icons/emojis)
export const CONCERN_LABEL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CONCERN_FLAG_LABELS).map(([k, v]) => [k, v.label]),
);

export const PRIORITY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_LABELS).map(([k, v]) => [k, v.label]),
);
