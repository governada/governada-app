export interface DelegationMilestone {
  key: string;
  days: number;
  label: string;
  description: string;
  icon: string;
}

export const DELEGATION_MILESTONES: DelegationMilestone[] = [
  {
    key: '1_month',
    days: 30,
    label: '1 Month Together',
    description: "1 month with {drepName}. Together you've shaped {proposalCount} proposals.",
    icon: 'Trophy',
  },
  {
    key: '3_months',
    days: 90,
    label: 'Quarter Milestone',
    description: '3 months of governance partnership with {drepName}.',
    icon: 'Medal',
  },
  {
    key: '6_months',
    days: 180,
    label: 'Half-Year Partner',
    description: "Half-year governance partner. You're among the most committed delegators.",
    icon: 'Star',
  },
  {
    key: '1_year',
    days: 365,
    label: 'Governance Anniversary',
    description: 'A full year of active representation with {drepName}.',
    icon: 'Crown',
  },
];

/**
 * Returns milestones the user has newly reached but not yet achieved.
 * `achievedMilestones` is an array of milestone keys already recorded.
 */
export function checkDelegationMilestones(
  delegationStartDate: Date,
  achievedMilestones: string[],
): DelegationMilestone[] {
  const now = new Date();
  const daysDelegated = Math.floor(
    (now.getTime() - delegationStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const achieved = new Set(achievedMilestones);

  return DELEGATION_MILESTONES.filter((m) => daysDelegated >= m.days && !achieved.has(m.key));
}

export function fillMilestoneDescription(
  template: string,
  vars: { drepName?: string; proposalCount?: number; adaAmount?: number },
): string {
  let result = template;
  if (vars.drepName !== undefined) result = result.replace(/{drepName}/g, vars.drepName);
  if (vars.proposalCount !== undefined)
    result = result.replace(/{proposalCount}/g, String(vars.proposalCount));
  if (vars.adaAmount !== undefined)
    result = result.replace(/{adaAmount}/g, vars.adaAmount.toLocaleString());
  return result;
}
