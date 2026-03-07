/**
 * Key articles from the Cardano Constitution relevant to governance proposal analysis.
 * Curated for AI constitutional alignment assessment.
 *
 * Source: Cardano Constitution (ratified December 2024)
 * Only includes articles relevant to governance action evaluation.
 */

export interface ConstitutionalArticle {
  id: string;
  title: string;
  text: string;
}

export const CONSTITUTION_ARTICLES: ConstitutionalArticle[] = [
  {
    id: 'Article I',
    title: 'Tenets and Guardrails',
    text: 'Cardano shall not be combative with legislation in order to avoid undue legal issues. All users of the Cardano Blockchain shall be treated equally. The Cardano Blockchain shall not lock up value without the consent of the owner. Total supply of ada shall not exceed 45,000,000,000 (45 billion).',
  },
  {
    id: 'Article II',
    title: 'The Cardano Blockchain Community',
    text: 'The Cardano Blockchain shall operate on the basis of governance by consent. Governance actions shall be consistent with the Cardano Constitution. All ADA holders shall have the right to participate in governance. No governance action shall violate the rights of ADA holders.',
  },
  {
    id: 'Article III Section 1',
    title: 'Governance Actions — General',
    text: 'Governance actions must be consistent with the Constitution and guardrails. Governance actions shall follow the procedures established by CIP-1694. Every governance action must include sufficient rationale and justification.',
  },
  {
    id: 'Article III Section 2',
    title: 'Treasury Withdrawals',
    text: 'Treasury withdrawals must not endanger the long-term sustainability of the Cardano treasury. Any withdrawal from the treasury shall include a clear purpose and measurable deliverables. Treasury funds must be used for the benefit of the Cardano ecosystem.',
  },
  {
    id: 'Article III Section 3',
    title: 'Hard Fork Initiation',
    text: 'Hard fork initiation governance actions must be preceded by sufficient technical review. Hard forks must not compromise the security or functionality of the Cardano network. Adequate time for testing and community review must be provided.',
  },
  {
    id: 'Article III Section 4',
    title: 'Motion of No Confidence',
    text: 'A motion of no confidence expresses a fundamental disagreement with the performance of the Constitutional Committee. The threshold for passing a motion of no confidence must be sufficiently high to prevent abuse.',
  },
  {
    id: 'Article III Section 5',
    title: 'Constitutional Committee Updates',
    text: 'The Constitutional Committee shall ensure governance actions are constitutional. Changes to the committee composition must maintain adequate expertise and representation. Term limits and rotation shall ensure accountability.',
  },
  {
    id: 'Article III Section 6',
    title: 'Protocol Parameter Changes',
    text: 'Protocol parameter changes must be justified by clear technical rationale. Changes must not compromise network security or decentralization. Economic parameters must consider the impact on all stakeholders. Parameters shall be changed incrementally to allow observation of effects.',
  },
  {
    id: 'Article III Section 7',
    title: 'Update Constitution',
    text: 'Updates to the Constitution must maintain the fundamental principles of decentralization, security, and sustainability. Any update must go through a comprehensive community review process.',
  },
  {
    id: 'Article IV',
    title: 'Delegated Representatives (DReps)',
    text: 'DReps represent the interests of ADA holders who have delegated their voting power. DReps are expected to act with integrity, transparency, and in the best interest of their delegators. DReps should provide rationale for their voting decisions.',
  },
  {
    id: 'Article V',
    title: 'Stake Pool Operators',
    text: 'SPOs are essential to network decentralization and security. SPO governance participation should reflect the interests of their delegators. SPO voting power should be proportional to their pledge and delegation.',
  },
  {
    id: 'Article VI',
    title: 'Constitutional Committee',
    text: 'The Constitutional Committee serves as a check on governance actions to ensure constitutional compliance. The committee must act in a transparent and accountable manner. Committee members should provide clear rationale for their votes.',
  },
  {
    id: 'Guardrail — Treasury',
    title: 'Treasury Guardrails',
    text: 'Net change to treasury per epoch must not exceed a defined threshold. Treasury withdrawals must not exceed a defined percentage of the total treasury balance. Multiple treasury withdrawals in the same epoch must be evaluated collectively.',
  },
  {
    id: 'Guardrail — Economic',
    title: 'Economic Guardrails',
    text: 'Transaction fees must remain reasonable for network usage. Monetary expansion rate must be within defined bounds. Staking rewards parameters must balance incentives with sustainability.',
  },
  {
    id: 'Guardrail — Network',
    title: 'Network Guardrails',
    text: 'Block size, memory limits, and execution costs must maintain network performance. Changes to network parameters must be tested and validated. Security-critical parameters require higher approval thresholds.',
  },
  {
    id: 'Guardrail — Governance',
    title: 'Governance Guardrails',
    text: 'Governance thresholds must balance efficiency with broad consensus. DRep voting thresholds vary by governance action type. Constitutional amendments require the highest level of consensus.',
  },
];

/**
 * Get constitutional articles relevant to a given proposal type.
 */
export function getRelevantArticles(proposalType: string): ConstitutionalArticle[] {
  const always = CONSTITUTION_ARTICLES.filter(
    (a) =>
      a.id === 'Article I' ||
      a.id === 'Article II' ||
      a.id === 'Article III Section 1' ||
      a.id === 'Guardrail — Governance',
  );

  const typeSpecific: ConstitutionalArticle[] = [];
  switch (proposalType) {
    case 'TreasuryWithdrawals':
      typeSpecific.push(
        ...CONSTITUTION_ARTICLES.filter(
          (a) => a.id === 'Article III Section 2' || a.id === 'Guardrail — Treasury',
        ),
      );
      break;
    case 'HardForkInitiation':
      typeSpecific.push(
        ...CONSTITUTION_ARTICLES.filter(
          (a) => a.id === 'Article III Section 3' || a.id === 'Guardrail — Network',
        ),
      );
      break;
    case 'NoConfidence':
      typeSpecific.push(...CONSTITUTION_ARTICLES.filter((a) => a.id === 'Article III Section 4'));
      break;
    case 'NewConstitutionalCommittee':
      typeSpecific.push(
        ...CONSTITUTION_ARTICLES.filter(
          (a) => a.id === 'Article III Section 5' || a.id === 'Article VI',
        ),
      );
      break;
    case 'ParameterChange':
      typeSpecific.push(
        ...CONSTITUTION_ARTICLES.filter(
          (a) =>
            a.id === 'Article III Section 6' ||
            a.id === 'Guardrail — Economic' ||
            a.id === 'Guardrail — Network',
        ),
      );
      break;
    case 'UpdateConstitution':
    case 'NewConstitution':
      typeSpecific.push(...CONSTITUTION_ARTICLES.filter((a) => a.id === 'Article III Section 7'));
      break;
    default:
      break;
  }

  const ids = new Set<string>();
  const result: ConstitutionalArticle[] = [];
  for (const a of [...always, ...typeSpecific]) {
    if (!ids.has(a.id)) {
      ids.add(a.id);
      result.push(a);
    }
  }
  return result;
}
