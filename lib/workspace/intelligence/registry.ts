/**
 * Intelligence Brief — section registry.
 *
 * Maps each draft status to an ordered list of section configs.
 * Adding a section to a stage is a one-line change.
 */

import type { SectionConfig, BriefStage } from './types';

// ---------------------------------------------------------------------------
// Section definitions (reusable across stages)
// ---------------------------------------------------------------------------

const CONSTITUTIONAL: SectionConfig = {
  id: 'constitutional',
  title: 'Constitutional Compliance',
  priority: 10,
  defaultExpanded: false,
  lazyAI: true,
  icon: 'Shield',
};

const READINESS: SectionConfig = {
  id: 'readiness',
  title: 'Readiness Score',
  priority: 20,
  defaultExpanded: true,
  icon: 'Target',
};

const SIMILAR_PROPOSALS: SectionConfig = {
  id: 'similar-proposals',
  title: 'Similar Proposals',
  priority: 30,
  defaultExpanded: false,
  lazyAI: true,
  icon: 'Search',
};

const RISK_REGISTER: SectionConfig = {
  id: 'risk-register',
  title: 'Risk Register',
  priority: 40,
  defaultExpanded: false,
  icon: 'AlertTriangle',
};

const REVIEW_SUMMARY: SectionConfig = {
  id: 'review-summary',
  title: 'Review Summary',
  priority: 5,
  defaultExpanded: true,
  icon: 'MessageSquareText',
};

const FEEDBACK_TRIAGE: SectionConfig = {
  id: 'feedback-triage',
  title: 'Feedback Triage',
  priority: 5,
  defaultExpanded: true,
  icon: 'ListChecks',
};

const SUBMISSION_CHECKLIST: SectionConfig = {
  id: 'submission-checklist',
  title: 'Submission Readiness',
  priority: 5,
  defaultExpanded: true,
  icon: 'ShieldCheck',
};

const MONITOR_EMBED: SectionConfig = {
  id: 'monitor-embed',
  title: 'Live Monitoring',
  priority: 5,
  defaultExpanded: true,
  icon: 'Activity',
};

// Review-side sections
const EXECUTIVE_SUMMARY: SectionConfig = {
  id: 'executive-summary',
  title: 'Executive Summary',
  priority: 5,
  defaultExpanded: true,
  icon: 'FileText',
};

const QUICK_ASSESSMENT: SectionConfig = {
  id: 'quick-assessment',
  title: 'Quick Assessment',
  priority: 10,
  defaultExpanded: true,
  icon: 'Zap',
};

const STAKEHOLDER_LANDSCAPE: SectionConfig = {
  id: 'stakeholder-landscape',
  title: 'Stakeholder Landscape',
  priority: 25,
  defaultExpanded: true,
  icon: 'Users',
};

const PROPOSER_PROFILE: SectionConfig = {
  id: 'proposer-profile',
  title: 'Proposer Profile',
  priority: 35,
  defaultExpanded: false,
  icon: 'UserCheck',
};

const KEY_QUESTIONS: SectionConfig = {
  id: 'key-questions',
  title: 'Key Questions',
  priority: 45,
  defaultExpanded: false,
  icon: 'HelpCircle',
};

// ---------------------------------------------------------------------------
// Author brief registry
// ---------------------------------------------------------------------------

export const AUTHOR_BRIEF_REGISTRY: Record<BriefStage, SectionConfig[]> = {
  draft: [CONSTITUTIONAL, READINESS, SIMILAR_PROPOSALS, RISK_REGISTER],
  community_review: [REVIEW_SUMMARY, CONSTITUTIONAL, READINESS, SIMILAR_PROPOSALS, RISK_REGISTER],
  response_revision: [FEEDBACK_TRIAGE, CONSTITUTIONAL, READINESS],
  final_comment: [SUBMISSION_CHECKLIST, CONSTITUTIONAL, READINESS],
  submitted: [MONITOR_EMBED],
  archived: [CONSTITUTIONAL, READINESS],
};

// ---------------------------------------------------------------------------
// Review brief registry
// ---------------------------------------------------------------------------

export const REVIEW_BRIEF_SECTIONS: SectionConfig[] = [
  EXECUTIVE_SUMMARY,
  QUICK_ASSESSMENT,
  CONSTITUTIONAL,
  STAKEHOLDER_LANDSCAPE,
  SIMILAR_PROPOSALS,
  PROPOSER_PROFILE,
  KEY_QUESTIONS,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get ordered sections for an author brief stage. */
export function getAuthorSections(stage: BriefStage): SectionConfig[] {
  const sections = AUTHOR_BRIEF_REGISTRY[stage] ?? AUTHOR_BRIEF_REGISTRY.draft;
  return [...sections].sort((a, b) => a.priority - b.priority);
}

/** Get ordered sections for a review brief, optionally adjusted for role. */
export function getReviewSections(voterRole?: string): SectionConfig[] {
  const sections = [...REVIEW_BRIEF_SECTIONS];
  // CC members: constitutional expanded by default
  if (voterRole === 'cc_member' || voterRole === 'CC') {
    const constIdx = sections.findIndex((s) => s.id === 'constitutional');
    if (constIdx >= 0) sections[constIdx] = { ...sections[constIdx], defaultExpanded: true };
  }
  // SPO: stakeholder landscape expanded
  if (voterRole === 'SPO' || voterRole === 'spo') {
    const stakeIdx = sections.findIndex((s) => s.id === 'stakeholder-landscape');
    if (stakeIdx >= 0) sections[stakeIdx] = { ...sections[stakeIdx], defaultExpanded: true };
  }
  return sections.sort((a, b) => a.priority - b.priority);
}
