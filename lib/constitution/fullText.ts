// Auto-generated from the Cardano Blockchain Ecosystem Constitution v2
// Source: constitution-2.md (ratified epoch 609)

export interface ConstitutionNode {
  id: string;
  articleNumber: number | null;
  sectionNumber: number | null;
  title: string;
  text: string;
}

export const CONSTITUTION_VERSION = 'v2-epoch-609';

export const CONSTITUTION_NODES: ConstitutionNode[] = [
  // ─── PREAMBLE ───────────────────────────────────────────────────────
  {
    id: 'preamble',
    articleNumber: null,
    sectionNumber: null,
    title: 'Preamble',
    text:
      'Cardano is a decentralized ecosystem of blockchain technology, smart contracts, and community governance, committed to improving economic, political, and social systems for everyone, everywhere. By offering this foundational infrastructure, Cardano empowers individuals and communities to manage their identity, value, and governance, fostering the emergence of decentralized applications, businesses, and network states.\n\n' +
      'Through unbiased processing of immutable data, we, the participants of the Cardano Community, consisting of individuals, organizations, contributors, and others, choose to follow in the footsteps of the early Internet and cryptocurrency pioneers, who first forged bonds of community through digital technologies. We are guided by our shared principles and tenets as we exercise our self-governance by balancing decentralized decision-making with accountability and safeguarding the security of the Cardano Blockchain.\n\n' +
      'Recognizing the need for a more robust and dynamic governance framework, that neither relies nor depends upon traditional nation-state governance systems, but instead relies on self-governance by the Cardano Community, utilizing, wherever possible and beneficial, blockchain technology in the governance process, we hereby establish this Cardano Constitution to govern the Cardano Blockchain ecosystem, ensure the continuity of the Cardano Blockchain, and guard the rights of those who utilize it and the rights of ada owners.\n\n' +
      'With these purposes in mind, we, the Cardano Community, affirm our intention to abide by this Constitution in order to participate in the governance of the Cardano Blockchain ecosystem. We invite all who share our values to join us for as long as they wish, while honoring the freedom to take another path.',
  },

  // ─── DEFINED TERMS ──────────────────────────────────────────────────
  {
    id: 'defined-terms',
    articleNumber: null,
    sectionNumber: null,
    title: 'Defined Terms',
    text:
      '1. Active Voting Stake. The total amount of lovelace that is delegated to active DReps or SPOs. This stake is used as the basis for calculating voting thresholds and adjudicating proposed Governance action outcomes. It excludes stake delegated to inactive DReps, the predefined abstain voting option, unregistered stake, and registered undelegated stake.\n\n' +
      '2. Cardano Community. The collective group of all individuals and organizations that, in embracing the shared principles and objectives set forth in the Cardano Blockchain Ecosystem Constitution, own ada, develop, build on, support, maintain, contribute to, and use the Cardano Blockchain.\n\n' +
      '3. Cardano Community Member. Any participant, individual or organization in the Cardano Community, including the CC.\n\n' +
      '4. Constitutional Committee (CC). The governing body and its component elected seats charged with ensuring that applicable governance actions take effect on the Cardano Blockchain only if in alignment with the principles and provisions set forth in the Cardano Blockchain Ecosystem Constitution.\n\n' +
      '5. Constitutional Committee member (CC member). A person, whether an individual or organization, that serves as a member of the Constitutional Committee.\n\n' +
      '6. Delegated Representative (DRep). The individual or entity registered to vote with respect to on-chain governance actions on its own behalf or on behalf of other ada owners.\n\n' +
      '7. Net Change Limit. The maximum allowed amount or percentage of lovelace that may be removed from the Cardano Treasury in a given period.\n\n' +
      '8. Stake Pool Operator (SPO). An individual or entity that controls cold key(s) of a block-producing node of a Stake Pool.\n\n' +
      "9. Stake Pool. A Stake Pool Operator's block producing node, identified by a unique Stake Pool ID, which aggregates applicable Delegator stake, forges and validates Blocks, and facilitates contributions of the SPO to the Cardano Blockchain's security, decentralization, consensus mechanism, and governance process.\n\n" +
      '10. Treasury Withdrawal Recipient. A person or entity who is indicated as the recipient of ada from the Cardano Treasury in the relevant "Treasury Withdrawals" action.',
  },

  // ─── ARTICLE I ──────────────────────────────────────────────────────
  {
    id: 'article-1-s1',
    articleNumber: 1,
    sectionNumber: 1,
    title: 'Article I Section 1 \u2014 Guiding Tenets',
    text:
      'The following Tenets shall guide all Cardano Community members and proposed governance actions shall be evaluated in accordance with these Tenets. The order in which the Tenets below appears is not intended to represent a priority among Tenets.\n\n' +
      'TENET 1 Transactions on the Cardano Blockchain shall not be slowed down or censored and shall be expediently served for their intended purpose.\n\n' +
      'TENET 2 The cost of transactions on the Cardano Blockchain shall be predictable and not unreasonable.\n\n' +
      'TENET 3 Anyone desiring to develop and deploy applications on the Cardano Blockchain shall not be unreasonably prevented from developing and deploying such applications as intended.\n\n' +
      'TENET 4 Contributions by the Cardano Community on the Cardano Blockchain shall be recognized, recorded, and assessed fairly through reward sharing with SPOs, potential compensation to DReps and CC members, and appropriate tokenomics.\n\n' +
      "TENET 5 The Cardano Blockchain shall not lock in an ada owner's value or data without the ada owner's consent.\n\n" +
      'TENET 6 The Cardano Blockchain shall not unreasonably impede interoperability.\n\n' +
      'TENET 7 The Cardano Blockchain shall preserve in a safe manner any value and information stored on the Cardano Blockchain.\n\n' +
      'TENET 8 The Cardano Blockchain shall not unreasonably spend resources.\n\n' +
      'TENET 9 All users of the Cardano Blockchain shall be treated fairly and impartially, taking into account the collective desires of the Cardano Community, consistent with the long-term sustainability and viability of the Cardano Blockchain.\n\n' +
      "TENET 10 The Cardano Blockchain's monetary system shall promote financial stability. This shall include seeking to preserve the value and utility of ada as a medium of exchange, store of value, and unit of account. The total supply of ada shall not exceed 45,000,000,000 (45,000,000,000,000,000 lovelace).",
  },
  {
    id: 'article-1-s2',
    articleNumber: 1,
    sectionNumber: 2,
    title: 'Article I Section 2 \u2014 Implementation of Guardrails',
    text:
      '1. The Cardano Blockchain shall operate in accordance with the Cardano Blockchain Guardrails Appendix to this Constitution. The Cardano Community may digitally codify certain Guardrails such that the Guardrails are directly programmed and implemented on the Cardano Blockchain using on-chain Guardrails Script or built-in ledger rules.\n\n' +
      '2. In the event there are inconsistencies between a Guardrail as set forth in the Cardano Blockchain Guardrails Appendix and any such Guardrail that has been programmed and implemented on the Cardano Blockchain, the version of such Guardrail that has been deployed directly on the Cardano Blockchain shall prevail unless and until replaced or revised pursuant to an on-chain governance action. The CC shall seek to reconcile such inconsistencies through the encouragement of an appropriate on-chain governance action.',
  },

  // ─── ARTICLE II ─────────────────────────────────────────────────────
  {
    id: 'article-2-s1',
    articleNumber: 2,
    sectionNumber: 1,
    title: 'Article II Section 1 \u2014 The Cardano Community',
    text:
      '1. No formal membership shall be required to use, participate in and benefit from the Cardano Blockchain. Cardano Community members are entitled to the rights, privileges, and protections of this Constitution, and are accordingly expected to support and uphold this Constitution, maintain the integrity of the ecosystem, participate in governance, and resolve disputes transparently.\n\n' +
      '2. Cardano Community members are encouraged to collaborate on developing applications and to form organizations that support the Cardano Blockchain and the Cardano Community.',
  },
  {
    id: 'article-2-s2',
    articleNumber: 2,
    sectionNumber: 2,
    title: 'Article II Section 2 \u2014 Participation Rights of ada owners',
    text:
      '1. Ada owners are entitled to access and participate in the on-chain decision-making processes of the Cardano Blockchain ecosystem, including voting, proposing changes to the governance structure in accordance with the Guardrails, and otherwise taking part in on-chain governance actions.\n\n' +
      '2. Ada owners can directly participate in governance actions by registering as DReps themselves or by delegating their voting rights to other registered DReps.\n\n' +
      '3. Any ada owner shall be allowed to register as a DRep. A DRep may act in the interest of one or more ada owners.\n\n' +
      '4. Any ada owner shall be allowed to delegate their voting stake to one or more registered DReps, including themselves.\n\n' +
      '5. Ada owners shall be allowed to change the delegation of their voting stake at any time.\n\n' +
      "6. Ada owners who use third-party custodians or other designees to hold their ada may authorize, or may withhold authorization for, such third-parties to vote on their behalf, and to delegate the voting rights of the ada owner to registered DReps on the owner's behalf.\n\n" +
      '7. Ada owners have the right to a process for participating in, submitting and voting on on-chain governance actions that is open, transparent, and protected from undue influence and manipulation.',
  },
  {
    id: 'article-2-s3',
    articleNumber: 2,
    sectionNumber: 3,
    title: 'Article II Section 3 \u2014 Decentralized Governance Framework',
    text:
      '1. The Cardano Blockchain is governed by a decentralized, on-chain model that, where beneficial, uses smart contracts and other blockchain tools to facilitate decision-making and ensure transparency.\n\n' +
      '2. Three independent voting bodies - DReps, SPOs, and the CC - participate in on-chain voting; anyone holding multiple roles must publicly disclose such overlaps before engaging in any on-chain governance actions.',
  },
  {
    id: 'article-2-s4',
    articleNumber: 2,
    sectionNumber: 4,
    title: 'Article II Section 4 \u2014 Delegated Representatives',
    text:
      '1. DReps have voting power equal to the number of lovelace delegated to them.\n\n' +
      '2. DReps may vote on all types of governance actions.\n\n' +
      '3. DReps shall ensure that any compensation received in connection with their activities as a DRep is publicly disclosed in a timely manner through relevant governance communication channels.\n\n' +
      '4. DReps shall not offer or provide compensation to an ada owner in exchange for being appointed as a DRep or for voting on their behalf.',
  },
  {
    id: 'article-2-s5',
    articleNumber: 2,
    sectionNumber: 5,
    title: 'Article II Section 5 \u2014 Stake Pool Operators',
    text: '1. SPOs shall vote on the following governance actions: "No Confidence", "Update Committee", "Hard Fork Initiation", "Parameter Update" that affect security-relevant parameters, and "Info" actions.',
  },
  {
    id: 'article-2-s6',
    articleNumber: 2,
    sectionNumber: 6,
    title: 'Article II Section 6 \u2014 Governance Action Standards',
    text:
      '1. To ensure transparency in on-chain governance, proposed governance actions shall follow a standardized and legible format before being recorded or enacted on-chain. This format shall include a URL hosting a document that outlines additional context for the proposed governance action, and the hash of this document. The document hosted by such a URL shall be immutable and incapable of being altered after submission, and the content of every on-chain Governance Action must be identical to the final off-chain version of the proposed action.\n\n' +
      '2. Each proposal shall provide sufficient rationale, including at minimum: a title, abstract, justification, and relevant supporting materials.\n\n' +
      '3. "Hard Fork Initiation" and "Parameter Update" actions shall undergo sufficient technical review and scrutiny as mandated by the Guardrails to ensure that the governance action does not endanger the security, functionality, performance, or long-term sustainability of the Cardano Blockchain.',
  },
  {
    id: 'article-2-s7',
    articleNumber: 2,
    sectionNumber: 7,
    title: 'Article II Section 7 \u2014 "Treasury Withdrawals" Action Standards',
    text:
      'A "Treasury Withdrawals" action must, in addition to the requirements at Section 6, meet all of the following requirements:\n\n' +
      '1. "Treasury Withdrawals" actions must specify the terms of the withdrawal. This shall include: the purpose of the withdrawal, the period for delivery of proposed activities which the withdrawal shall be used for, the relevant costs and expenses of the proposed activities, circumstances under which the withdrawal might be refunded to the Cardano Treasury.\n\n' +
      '2. "Treasury Withdrawals" actions shall disclose whether the prospective recipient of the "Treasury Withdrawals" action has received ada from the Cardano Treasury within the last 24 months.\n\n' +
      '3. A Net Change Limit must be set. "Treasury Withdrawals" actions must not exceed the Net Change Limit for that period.\n\n' +
      '4. "Treasury Withdrawals" actions shall require an allocation of ada as a part of such funding request to cover the cost of periodic independent audits and the implementation of oversight metrics as to the use of such ada.\n\n' +
      '5. "Treasury Withdrawals" actions shall designate one or more administrators responsible for monitoring how the funds are used, and ensuring the deliverables are achieved.\n\n' +
      '6. Any ada received from a Cardano Blockchain treasury withdrawal, so long as such ada is being held by an administrator prior to further disbursement to the Treasury Withdrawal Recipient, must be kept in one or more separate accounts that can be audited by the Cardano Community, and such accounts shall not be delegated to an SPO but must be delegated to the predefined abstain voting option.',
  },

  // ─── ARTICLE III ────────────────────────────────────────────────────
  {
    id: 'article-3-s1',
    articleNumber: 3,
    sectionNumber: 1,
    title: 'Article III Section 1 \u2014 Role and Scope',
    text:
      "1. A CC shall be established as the branch of Cardano's on-chain governance process that ensures governance actions to be enacted on-chain are consistent with this Constitution.\n\n" +
      '2. Each CC member shall have one vote.\n\n' +
      '3. No governance action - other than a "No Confidence" or "Update Committee" action - may be implemented on-chain without affirmation by a requisite percentage of CC members.\n\n' +
      '4. The CC shall be limited to voting on the constitutionality of governance actions, including any proposed or contemplated actions contained within "Info" actions.',
  },
  {
    id: 'article-3-s2',
    articleNumber: 3,
    sectionNumber: 2,
    title: 'Article III Section 2 \u2014 Composition and Terms',
    text:
      '1. The CC shall be composed of such number of members and serve such term lengths as are sufficient to assure the ongoing integrity of the Cardano Blockchain, as determined from time to time by Ada owners.\n\n' +
      '2. To assure continuity in the operation of the CC, the terms for CC members shall be staggered.',
  },
  {
    id: 'article-3-s3',
    articleNumber: 3,
    sectionNumber: 3,
    title: 'Article III Section 3 \u2014 Election Process, No Confidence and Removal',
    text:
      '1. The CC shall be considered to be in one of the following two states at all times: a state of confidence or a state of no confidence. In a state of no confidence, members of the then-standing CC must be reinstated or replaced using the "Update Committee" action before any other on-chain governance action, other than "Info" actions, may go forward.\n\n' +
      '2. The Cardano Community shall establish and make public a process from time to time for election of members of the CC consistent with the requirements of the Guardrails.\n\n' +
      '3. In the event of a vote of no confidence or the removal of some CC members by "Update Committee" action, an election shall be held as soon as practical.',
  },
  {
    id: 'article-3-s4',
    articleNumber: 3,
    sectionNumber: 4,
    title: 'Article III Section 4 \u2014 Transparency and Conduct',
    text:
      '1. CC processes shall be transparent, and the CC shall publish each decision.\n\n' +
      '2. When voting that a governance action proposed to be executed on-chain is unconstitutional, each CC member casting such a vote shall set forth the basis for its decision with reference to specific Articles of this Constitution or provisions of the Cardano Blockchain Guardrails Appendix that are in conflict with a given proposal.\n\n' +
      '3. CC members may be compensated for their efforts as members and shall ensure that any compensation received in connection with such activities is disclosed in a timely manner through relevant governance communication channels.',
  },

  // ─── ARTICLE IV ─────────────────────────────────────────────────────
  {
    id: 'article-4-s1',
    articleNumber: 4,
    sectionNumber: 1,
    title: 'Article IV Section 1 \u2014 Amendment Rules',
    text: 'Amendments to this Constitution, including the Cardano Blockchain Guardrails Appendix, shall require approval via an on-chain governance action supported by at least 65% of the active voting stake at that time, unless a different threshold is expressly provided in the Cardano Blockchain Guardrails Appendix for the amendment of a particular Guardrail, in which case that threshold shall apply.',
  },

  // ─── APPENDIX I ─────────────────────────────────────────────────────
  {
    id: 'appendix-1-s1',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 1 \u2014 Introduction',
    text:
      'To implement Cardano Blockchain on-chain governance, it is necessary to establish sensible Guardrails that will enable the Cardano Blockchain to continue to operate in a secure and sustainable way.\n\n' +
      'This Appendix sets forth Guardrails that must be applied to Cardano Blockchain on-chain governance actions, including changes to the protocol parameters and limits on treasury withdrawals. These Guardrails cover both essential, intrinsic limits on settings, and recommendations that are based on experience, research, measurement, and governance objectives.\n\n' +
      'These Guardrails are designed to avoid both unexpected and foreseeable problems with the operation of the Cardano Blockchain. They are intended to guide the choice of sensible parameter settings and avoid potential problems with security, performance, functionality, or long-term sustainability. As described below, some of these Guardrails are automatable and will be enforced via an on-chain Guardrails Script or built-in ledger rules.\n\n' +
      'These Guardrails apply only to the Cardano Blockchain Layer 1 mainnet environment. They are not intended to apply to test environments or to other blockchains that use Cardano Blockchain software.\n\n' +
      'Not all parameters for the Cardano Blockchain can be considered independently. Some parameters interact with other settings in an intrinsic way. Where known, these interactions are addressed in this Appendix.\n\n' +
      'While the Guardrails in this Appendix presently reflect the current state of technical insight, this Appendix should be treated as a living document. Implementation improvements, new simulations or performance evaluation results for the Cardano Blockchain may allow some of the restrictions contained in these Guardrails to be relaxed or tightened in due course.\n\n' +
      'Additional Guardrails may also be needed where, for example, new protocol parameters are introduced or existing ones are removed.\n\n' +
      'Amending, Adding or Deprecating Guardrails\n\n' +
      'The Guardrails set forth in this Appendix may be amended from time to time pursuant to an on-chain governance action that satisfies the applicable voting threshold as set forth in this Appendix. Any such amendment to any Guardrails shall require and be deemed to be an amendment to the Constitution itself, including any new Guardrails. Each Guardrail has a unique label. If the text of a Guardrail is amended, the existing Guardrail will be deprecated and a new label will be used in this Appendix. Similarly, if a Guardrail is deprecated, its label will never be reused in the future. In all cases, the Guardrails that apply to a governance action will be those in force at the time that the governance action is submitted on-chain, regardless of any later amendments.\n\n' +
      'Terminology and Guidance\n\n' +
      'This section provides supplementary definitions and interpretive guidance for terms used throughout this Constitution and the Guardrails Appendix.\n\n' +
      'Cardano Blockchain. The decentralized, public, peer-to-peer, proof-of-stake distributed ledger system, designed to securely record, verify, and synchronize transactions and data across the network while enabling the execution of smart contracts and decentralized applications. This system, powered by ada, is the longest chain of blocks with sufficient confirmations to be considered finalized starting from block Hash 5f20df933584822601f9e3f8c024eb5eb252fe8cefb24d1317dc3d432e940ebb, as forged on 2017-09-23 21:44:51 UTC on the Cardano Network.\n\n' +
      'Block. A container of data produced by a Stake Pool that includes, at minimum, a header. Block production and block forging are used interchangeably.\n\n' +
      'Protocol. The algorithms, rules, and procedures that govern the exchange of information on the Cardano Blockchain.\n\n' +
      'Protocol Parameters. Protocol settings that define how the Cardano Blockchain functions; modifiable through applicable governance processes.\n\n' +
      'Slot. The smallest denomination of time nested within an Epoch.\n\n' +
      "Epoch. A Protocol-determined interval characterized by a fixed number of Slots. Each Slot's duration and sequence are governed by the blockchain's consensus mechanisms and are associated with a universal timestamp defined in UTC. It is used for operations including governance voting, Block production leadership determination, rewards calculation, and Hard Forks.\n\n" +
      "lovelace. The smallest unit of value for the native cryptocurrency of the Cardano Blockchain, utilized for the network's security and governance. It is distinguished from other native tokens by its lack of a policy ID and policy name.\n\n" +
      'ada. A superunit of lovelace, with 1 ada equal to 1,000,000 lovelace.\n\n' +
      'Delegator. A private key holder that delegates stake to a Stake Pool for block production and network security, to a DRep for participation in on-chain governance, or both. In doing so, the delegator contributes to the operation and governance of the Cardano Blockchain.\n\n' +
      'Active Block Production Stake. The cumulative amount of stake, measured in lovelace, that is actively delegated to Stake Pools and utilized for block forging during the current Epoch. This amount is determined by a snapshot of stake distribution taken at the beginning of the previous Epoch, ensuring that it accurately represents the effective stake available for securing and maintaining the Cardano Blockchain through block forging.\n\n' +
      "On-chain. A classification for actions, transactions, or governance activities that are executed, recorded, or implemented directly on the Cardano Blockchain. These actions, transactions, or governance activities are permanently validated and stored through the blockchain's consensus mechanism, ensuring their immutability and transparency.\n\n" +
      'Off-Chain. A classification for activities, proposals, or governance decisions that are either not yet implemented on the Cardano Blockchain, or not intended to be directly recorded on the blockchain. These may include discussions, proposals, or agreements that exist outside the blockchain and do not involve direct consensus or on-chain validation.\n\n' +
      'Governance Action. An on-chain proposal enabling participation in shaping the future of the Cardano Blockchain Ecosystem through voting transactions.\n\n' +
      'Hard Fork. A Protocol upgrade for the Cardano Blockchain that results in a new Protocol version and necessitates coordinated adoption by network participants.\n\n' +
      'Guardrails. A set of restrictions on Governance Actions to prevent undesirable outcomes and assist voters in deciding whether the proposed action complies with the Cardano Blockchain Ecosystem Constitution. Some guardrails are enforced using the Guardrails Script or ledger rules to prevent submission of the action, while others necessitate further adjudication to determine if they violate the Constitution in ways the Guardrails Script or ledger cannot check. Guardrails may be either mandatory ("must"/"must not") or advisory ("should"/"should not"). The latter allows for interpretive flexibility where necessary.\n\n' +
      'Guardrails Script. A smart contract script that checks specific proposed Governance Actions, "Hard Fork Initiation" and "Parameter Update" actions, against automatically checkable Guardrails. The check is applied when the Governance Action is proposed on-chain.\n\n' +
      'Motion of no confidence governance action ("No Confidence" action). A motion to create a state of no confidence in the current constitutional committee.\n\n' +
      'Update committee and/or threshold and/or terms governance action ("Update Committee" action). Changes to the members of the Constitutional Committee and/or to its signature threshold and/or terms.\n\n' +
      'New Constitution or Guardrails Script governance action ("New Constitution" action). A modification to the Constitution or Guardrails Script, recorded as on-chain hashes.\n\n' +
      'Hard Fork Initiation governance action ("Hard Fork Initiation" action). Triggers a non-backwards compatible upgrade of the network; requires a prior software upgrade.\n\n' +
      'Protocol Parameter Changes governance action ("Parameter Changes" action or "Parameter Update" action). Any change to one or more updatable protocol parameters, excluding changes to major protocol versions ("hard forks").\n\n' +
      'Treasury Withdrawals governance action ("Treasury Withdrawals" action). Withdrawals from the treasury.\n\n' +
      'Info action ("Info" action). An action that has no effect on-chain, other than an on-chain record.\n\n' +
      'Cardano Blockchain Treasury, Cardano Treasury, or Treasury. A supply of ada controlled by the Protocol of the Cardano Blockchain; collected from transaction fees, reserves, and other designated sources. Withdrawals from this supply of ada are subject to the processes and restrictions set forth in the Cardano Blockchain Ecosystem Constitution.\n\n' +
      'Cardano Blockchain Ecosystem. The collective ecosystem comprising the Cardano Blockchain, the Cardano Community, and the tooling and infrastructure utilized by the Cardano Community to support the Cardano Blockchain in alignment with the shared principles and objectives set forth in the Cardano Blockchain Ecosystem Constitution.\n\n' +
      'Expected. A reasonable presumption that the identified action, although not mandatory, will occur.\n\n' +
      'Should/Should not. Where this Appendix says that a value "should not" be set below or above some value, this means that the Guardrail is a recommendation or guideline, and the specific value could be open to discussion or alteration by a suitably expert group recognized by the Cardano Community in light of experience with the Cardano Blockchain governance system or the operation of the Cardano Blockchain.\n\n' +
      'Must/Must not. Where this Appendix says that a value "must" or "must not" be set below or above some value, this means that the Guardrail is a requirement that will be enforced by Cardano Blockchain ledger rules, types or other built-in mechanisms where possible, and that if not followed could cause a protocol failure, security breach or other undesirable outcome.\n\n' +
      'Benchmarking. Benchmarking refers to careful system level performance evaluation that is designed to show a priori that, for example, 95% of blocks will be diffused across a global network of Cardano Blockchain nodes within the required 5s time interval in all cases. This may require construction of specific test workflows and execution on a large test network of Cardano Blockchain nodes, simulating a global Cardano Blockchain network.\n\n' +
      'Performance analysis. Performance analysis refers to projecting theoretical performance, empirical benchmarking or simulation results to predict actual system behavior. For example, performance results obtained from tests in a controlled test environment (such as a collection of data centers with known networking properties) may be extrapolated to inform likely performance behavior in a real Cardano Blockchain network environment.\n\n' +
      'Simulation. Simulation refers to synthetic execution that is designed to inform performance/functionality decisions in a repeatable way. For example, the IOSim Cardano Blockchain module allows the operation of the networking stack to be simulated in a controlled and repeatable way, allowing issues to be detected before code deployment.\n\n' +
      'Performance Monitoring. Performance monitoring involves measuring the actual behavior of the Cardano Blockchain network, for example, by using timing probes to evaluate round-trip times, or test blocks to assess overall network health. It complements benchmarking and performance analysis by providing information about actual system behavior that cannot be obtained using simulated workloads or theoretical analysis.\n\n' +
      'Reverting Changes. Where performance monitoring shows that actual network behavior following a change is inconsistent with the performance requirements for the Cardano Blockchain, then the change must be reverted to its previous state if that is possible. For example, if the block size is increased from 100KB to 120KB and 95% of blocks are no longer diffused within 5s, then a change must be made to revert the block size to 100KB. If this is not possible, then one or more alternative changes must be made that will ensure that the performance requirements are met.\n\n' +
      'Severity Levels. Issues that affect the Cardano Blockchain network are classified by severity level, where:\n\n' +
      'Severity 1 is a critical incident or issue with very high impact to the security, performance, functionality or sustainability of the Cardano Blockchain network\n\n' +
      'Severity 2 is a major incident or issue with significant impact to the security, performance, functionality or sustainability of the Cardano Blockchain network\n\n' +
      'Severity 3 is a minor incident or issue with low impact to the security, performance, functionality or sustainability of the Cardano Blockchain network\n\n' +
      'Future Performance Requirements. Planned development such as new mechanisms for out of memory storage may impact block diffusion or other times. When changing parameters, it is necessary to consider these future performance requirements as well as the current operation of the Cardano Blockchain. Until development is complete, the requirements will be conservative but may then be relaxed to account for actual timing behavior.\n\n' +
      'Automated Checking ("Guardrails Script")\n\n' +
      'A script hash is associated with the Constitution hash when a New Constitution or Guardrails Script governance action is enacted. It acts as an additional safeguard to the ledger rules and types, filtering non-compliant governance actions.\n\n' +
      'The Guardrails Script only affects two types of governance actions:\n\n' +
      '"Parameter Update" actions, and\n\n' +
      '"Treasury Withdrawals" action.\n\n' +
      'The Guardrails Script is executed when either of these types of governance action is submitted on-chain. This avoids scenarios where, for example, an erroneous script could prevent the Cardano Blockchain from ever enacting a Hard Fork action, resulting in deadlock. There are three different situations that apply to Guardrail Script usage.\n\n' +
      'Symbol and Explanation\n\n' +
      '(y) The Guardrail Script can be used to enforce the Guardrail\n\n' +
      '(x) The Guardrail Script cannot be used to enforce the Guardrail\n\n' +
      '(~ - reason) The Guardrail Script cannot be used to enforce the Guardrail for the reason given, but future ledger changes could enable this.\n\n' +
      'Guardrails may overlap: in this case, the most restrictive set of Guardrails will apply.\n\n' +
      'Where a parameter is not explicitly listed in this document, then the Guardrail Script must not permit any changes to the parameter.\n\n' +
      'Conversely, where a parameter is explicitly listed in this document but no checkable Guardrails are specified, the Guardrail Script must not impose any constraints on changes to the parameter.',
  },
  {
    id: 'appendix-1-s2',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2 \u2014 Guardrails and Guidelines on "Parameter Update" Actions',
    text:
      'Below are Guardrails and guidelines for changing updatable protocol parameter settings via the "Parameter Update" action such that the Cardano Blockchain is never in an unrecoverable state as a result of such changes.\n\n' +
      'Note that, to avoid ambiguity, this Appendix uses the parameter name that is used in "Parameter Update" actions rather than any other convention.\n\n' +
      'GUARDRAILS\n\n' +
      'PARAM-01 (y) Any protocol parameter that is not explicitly named in this document must not be changed by a "Parameter Update" action\n\n' +
      'PARAM-02a (y) Where a protocol parameter is explicitly listed in this document but no checkable Guardrails are specified, the Guardrails Script must not impose any constraints on changes to the parameter. Checkable Guardrails are shown by a (y)',
  },
  {
    id: 'appendix-1-s2-1',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.1 \u2014 Critical Protocol Parameters',
    text:
      'The below protocol parameters are critical from a security point of view.\n\n' +
      'Parameters that are Critical to the Operation of the Blockchain\n\n' +
      'maximum block body size (maxBlockBodySize)\n' +
      'maximum transaction size (maxTxSize)\n' +
      'maximum block header size (maxBlockHeaderSize)\n' +
      'maximum size of a serialized asset value (maxValueSize)\n' +
      'maximum script execution/memory units in a single block (maxBlockExecutionUnits[steps/memory])\n' +
      'minimum fee coefficient (txFeePerByte)\n' +
      'minimum fee constant (txFeeFixed)\n' +
      'minimum fee per byte for reference scripts (minFeeRefScriptCoinsPerByte)\n' +
      'minimum lovelace deposit per byte of serialized UTxO (utxoCostPerByte)\n' +
      'governance action deposit (govDeposit)\n\n' +
      'GUARDRAILS\n\n' +
      'PARAM-03a (y) A parameter that is critical to the operation of the blockchain requires an SPO vote in addition to a DRep vote: SPOs must say "yes" with a collective support of more than 50% of all active block production stake. This is enforced by the Guardrails on the stake pool voting threshold.\n\n' +
      'PARAM-04a (x) At least 90 days should normally pass between the publication of an off-chain proposal to change a parameter that is critical to the operation of the blockchain and the submission of the corresponding on-chain governance action. This Guardrail may be relaxed in the event of a Severity 1 or Severity 2 network issue following careful technical discussion and evaluation.\n\n' +
      'Parameters that are Critical to the Governance System\n\n' +
      'delegation key lovelace deposit (stakeAddressDeposit)\n' +
      'pool registration lovelace deposit (stakePoolDeposit)\n' +
      'minimum fixed rewards cut for pools (minPoolCost)\n' +
      'DRep deposit amount (dRepDeposit)\n' +
      'minimal Constitutional Committee size (committeeMinSize)\n' +
      'maximum term length (in epochs) for the Constitutional Committee members (committeeMaxTermLength)\n\n' +
      'GUARDRAILS\n\n' +
      'PARAM-05a (y) DReps must vote "yes" with a collective support of more than 50% of all active voting stake. This is enforced by the Guardrails on the DRep voting thresholds.\n\n' +
      'PARAM-06a (x) At least 90 days should normally pass between the publication of an off-chain proposal to change a parameter that is critical to the governance system and the submission of the corresponding on-chain governance action. This Guardrail may be relaxed in the event of a Severity 1 or Severity 2 network issue following careful technical discussion and evaluation.',
  },
  {
    id: 'appendix-1-s2-2',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.2 \u2014 Economic Parameters',
    text:
      'The overall goals when managing economic parameters are to:\n\n' +
      '1. Enable long-term economic sustainability for the Cardano Blockchain;\n\n' +
      '2. Ensure that stake pools are adequately rewarded for maintaining the Cardano Blockchain;\n\n' +
      '3. Ensure that ada owners are adequately rewarded for using stake in constructive ways, including when delegating ada for block production; and\n\n' +
      '4. Balance economic incentives for different Cardano Blockchain ecosystem stakeholders, including but not limited to Stake Pool Operators, ada owners, DeFi users, infrastructure users, developers (e.g. DApps) and financial intermediaries (e.g. exchanges)\n\n' +
      'Triggers for Change\n\n' +
      '1. Significant changes in the fiat value of ada resulting in potential problems with security, performance, functionality, or long-term sustainability\n\n' +
      '2. Changes in transaction volumes or types\n\n' +
      '3. Community requests or suggestions\n\n' +
      '4. Emergency situations that require changes to economic parameters\n\n' +
      'Counter-indicators\n\n' +
      'Changes to the economic parameters should not be made in isolation. They need to account for:\n\n' +
      'External economic factors\n\n' +
      'Network security concerns\n\n' +
      'Core Metrics\n\n' +
      'Fiat value of ada resulting in potential problems with security, performance, functionality, or long-term sustainability\n\n' +
      'Transaction volumes and types\n\n' +
      'Number and health of stake pools\n\n' +
      'External economic factors\n\n' +
      'Changes to Specific Economic Parameters\n\n' +
      'Transaction fee per byte (txFeePerByte) and fixed transaction fee (txFeeFixed)\n\n' +
      'Defines the cost for basic transactions in lovelace:\n\n' +
      'fee(tx) = txFeeFixed + txFeePerByte x nBytes(tx)\n\n' +
      'GUARDRAILS\n\n' +
      'TFPB-01 (y) txFeePerByte must not be lower than 30 (0.000030 ada) This protects against low-cost denial of service attacks\n\n' +
      'TFPB-02 (y) txFeePerByte must not exceed 1,000 (0.001 ada) This ensures that transactions can be paid for\n\n' +
      'TFPB-03 (y) txFeePerByte must not be negative\n\n' +
      'TFF-01 (y) txFeeFixed must not be lower than 100,000 (0.1 ada) This protects against low-cost denial of service attacks\n\n' +
      'TFF-02 (y) txFeeFixed must not exceed 10,000,000 (10 ada) This ensures that transactions can be paid for\n\n' +
      'TFF-03 (y) txFeeFixed must not be negative\n\n' +
      'TFGEN-01 (x - "should") To maintain a consistent level of protection against denial-of-service attacks, txFeeFixed and txFeePerByte should be adjusted whenever Plutus Execution prices are adjusted (executionUnitPrices[steps/memory])\n\n' +
      'TFGEN-02 (x - "unquantifiable") Any changes to txFeeFixed or txFeePerByte must consider the implications of reducing the cost of a denial-of-service attack or increasing the maximum transaction fee so that it becomes impossible to construct a transaction.\n\n' +
      'UTxO cost per byte (utxoCostPerByte)\n\n' +
      'Defines the deposit (in lovelace) that is charged for each byte of storage that is held in a UTxO. This deposit is returned when the UTxO is no longer active.\n\n' +
      'Sets a minimum threshold on ada that is held within a single UTxO\n\n' +
      'Provides protection against low-cost denial of service attack on UTxO storage. DoS protection decreases in line with the free node memory (proportional to UTxO growth)\n\n' +
      'Helps reduce long-term storage costs for node users by providing an incentive to return UTxOs when no longer needed, or to merge UTxOs.\n\n' +
      'GUARDRAILS\n\n' +
      'UCPB-01 (y) utxoCostPerByte must not be lower than 3,000 (0.003 ada)\n\n' +
      'UCPB-02 (y) utxoCostPerByte must not exceed 6,500 (0.0065 ada)\n\n' +
      'UCPB-03 (y) utxoCostPerByte must not be zero\n\n' +
      'UCPB-04 (y) utxoCostPerByte must not be negative\n\n' +
      'UCPB-05a (x - "should") Changes should account for\n\n' +
      '1. The acceptable cost of attack\n\n' +
      '2. The acceptable time for an attack\n\n' +
      '3. The acceptable memory configuration for full node users\n\n' +
      '4. The sizes of UTxOs and\n\n' +
      '5. The current total node memory usage\n\n' +
      'Stake address deposit (stakeAddressDeposit)\n\n' +
      'Ensures that stake addresses are retired when no longer needed\n\n' +
      'Helps reduce long-term storage costs\n\n' +
      'Helps limit CPU and memory costs in the ledger\n\n' +
      'The rationale for the deposit is to incentivize that scarce memory resources are returned when they are no longer required. Reducing the number of active stake addresses also reduces processing and memory costs at the epoch boundary when calculating stake snapshots.\n\n' +
      'GUARDRAILS\n\n' +
      'SAD-01 (y) stakeAddressDeposit must not be lower than 1,000,000 (1 ada)\n\n' +
      'SAD-02 (y) stakeAddressDeposit must not exceed 5,000,000 (5 ada)\n\n' +
      'SAD-03 (y) stakeAddressDeposit must not be negative\n\n' +
      'Stake pool deposit (stakePoolDeposit)\n\n' +
      'Ensures that stake pools are retired by the stake pool operator when no longer needed by them\n\n' +
      'Helps reduce long-term storage costs\n\n' +
      'The rationale for the deposit is to incentivize that scarce memory resources are returned when they are no longer required. Rewards and stake snapshot calculations are also impacted by the number of active stake pools.\n\n' +
      'GUARDRAILS\n\n' +
      'SPD-01 (y) stakePoolDeposit must not be lower than 250,000,000 (250 ada)\n\n' +
      'SPD-02 (y) stakePoolDeposit must not exceed 500,000,000 (500 ada)\n\n' +
      'SPD-03 (y) stakePoolDeposit must not be negative\n\n' +
      'Minimum Pool Cost (minPoolCost)\n\n' +
      'Part of the rewards mechanism\n\n' +
      'The minimum pool cost is transferred to the pool rewards address before any delegator rewards are paid\n\n' +
      'GUARDRAILS\n\n' +
      'MPC-01 (y) minPoolCost must not be negative\n\n' +
      'MPC-02 (y) minPoolCost must not exceed 500,000,000 (500 ada)\n\n' +
      'MPC-03 (x - "should") minPoolCost should be set in line with the economic cost for operating a pool\n\n' +
      'Treasury Cut (treasuryCut)\n\n' +
      'Part of the rewards mechanism\n\n' +
      'The treasury cut portion of the monetary expansion is transferred to the treasury before any pool rewards are paid\n\n' +
      'Can be set in the range 0.0-1.0 (0%-100%)\n\n' +
      'GUARDRAILS\n\n' +
      'TC-01 (y) treasuryCut must not be lower than 0.1 (10%)\n\n' +
      'TC-02 (y) treasuryCut must not exceed 0.3 (30%)\n\n' +
      'TC-03 (y) treasuryCut must not be negative\n\n' +
      'TC-04 (y) treasuryCut must not exceed 1.0 (100%)\n\n' +
      'TC-05 (~ - no access to change history) treasuryCut must not be changed more than once in any 36 epoch period (approximately 6 months)\n\n' +
      'Monetary Expansion Rate (monetaryExpansion)\n\n' +
      'Part of the rewards mechanism\n\n' +
      'The monetary expansion controls the amount of reserves that is used for rewards each epoch\n\n' +
      'Governs the long-term sustainability of the Cardano Blockchain\n\n' +
      'The reserves are gradually depleted until no rewards are supplied\n\n' +
      'GUARDRAILS\n\n' +
      'ME-01 (y) monetaryExpansion must not exceed 0.005\n\n' +
      'ME-02 (y) monetaryExpansion must not be lower than 0.001\n\n' +
      'ME-03 (y) monetaryExpansion must not be negative\n\n' +
      'ME-04 (x - "should") monetaryExpansion should not be varied by more than +/- 10% in any 73-epoch period (approximately 12 months)\n\n' +
      'ME-05 (x - "should") monetaryExpansion should not be changed more than once in any 36-epoch period (approximately 6 months)\n\n' +
      'Plutus Script Execution Prices (executionUnitPrices[priceSteps/priceMemory])\n\n' +
      'Define the fees for executing Plutus scripts\n\n' +
      'Gives an economic return for Plutus script execution\n\n' +
      'Provides security against low-cost DoS attacks\n\n' +
      'GUARDRAILS\n\n' +
      'EIUP-PS-01 (y) executionUnitPrices[priceSteps] must not exceed 2,000 / 10,000,000\n\n' +
      'EIUP-PS-02 (y) executionUnitPrices[priceSteps] must not be lower than 500 / 10,000,000\n\n' +
      'EIUP-PM-01 (y) executionUnitPrices[priceMemory] must not exceed 2,000 / 10,000\n\n' +
      'EIUP-PM-02 (y) executionUnitPrices[priceMemory] must not be lower than 400 / 10,000\n\n' +
      'EIUP-GEN-01 (x - "similar to") The execution prices must be set so that\n\n' +
      '1. the cost of executing a transaction with maximum CPU steps is similar to the cost of a maximum sized non-script transaction and\n\n' +
      '2. the cost of executing a transaction with maximum memory units is similar to the cost of a maximum sized non-script transaction\n\n' +
      'EIUP-GEN-02 (x - "should") The execution prices should be adjusted whenever transaction fees are adjusted (txFeeFixed/txFeePerByte). The goal is to ensure that the processing delay is similar for "full" transactions, regardless of their type.\n\n' +
      'This helps ensure that the requirements on block diffusion/propagation times are met.\n\n' +
      'Transaction fee per byte for a reference script (minFeeRefScriptCoinsPerByte)\n\n' +
      'Defines the cost for using Plutus reference scripts in lovelace\n\n' +
      'GUARDRAILS\n\n' +
      'MFRS-01 (y) minFeeRefScriptCoinsPerByte must not exceed 1,000 (0.001 ada)\n\n' +
      'This ensures that transactions can be paid for\n\n' +
      'MFRS-02 (y) minFeeRefScriptCoinsPerByte must not be negative\n\n' +
      'MFRS-03 (x - "should") To maintain a consistent level of protection against denial-of-service attacks, minFeeRefScriptCoinsPerByte should be adjusted whenever Plutus Execution prices are adjusted (executionUnitPrices[steps/memory]) and whenever txFeeFixed is adjusted\n\n' +
      'MFRS-04 (x - "unquantifiable") Any changes to minFeeRefScriptCoinsPerByte must consider the implications of reducing the cost of a denial-of-service attack or increasing the maximum transaction fee',
  },
  {
    id: 'appendix-1-s2-3',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.3 \u2014 Network Parameters',
    text:
      'The overall goals when managing the Cardano Blockchain network parameters are to:\n\n' +
      '1. Match the available Cardano Blockchain Layer 1 network capacity to current or future traffic demands, including payment transactions, layer 1 DApps, sidechain management and governance needs\n\n' +
      '2. Balance traffic demands for different user groups, including payment transactions, minters of Fungible/Non-Fungible Tokens, Plutus scripts, DeFi developers, Stake Pool Operators and voting transactions\n\n' +
      'Triggers for Change\n\n' +
      'Changes to network parameters may be triggered by:\n\n' +
      '1. Measured changes in traffic demands over a 2-epoch period (10 days)\n\n' +
      '2. Anticipated changes in traffic demands\n\n' +
      '3. Cardano Community requests\n\n' +
      'Counter-indicators\n\n' +
      'Changes may need to be reversed and/or should not be enacted in the event of:\n\n' +
      'Excessive block propagation delays\n\n' +
      'Stake pools being unable to handle traffic volume\n\n' +
      'Scripts being unable to complete execution\n\n' +
      'Core Metrics\n\n' +
      'All decisions on parameter changes should be informed by:\n\n' +
      'Block propagation delay profile\n\n' +
      'Traffic volume (block size over time)\n\n' +
      'Script volume (size of scripts and execution units)\n\n' +
      'Script execution cost benchmarks\n\n' +
      'Block propagation delay/diffusion benchmarks\n\n' +
      'Detailed benchmarking results are required to confirm the effect of any changes on mainnet performance or behavior prior to enactment. The effects of different transaction mixes must be analyzed, including normal transactions, Plutus scripts, and governance actions.\n\n' +
      'GUARDRAILS\n\n' +
      'NETWORK-01 (x - "should") No individual network parameter should change more than once per two epochs\n\n' +
      'NETWORK-02 (x - "should") Only one network parameter should be changed per epoch unless they are directly correlated, e.g., per-transaction and per-block memory unit limits\n\n' +
      'Changes to Specific Network Parameters\n\n' +
      'Block Size (maxBlockBodySize)\n\n' +
      'The maximum size of a block, in bytes.\n\n' +
      'GUARDRAILS\n\n' +
      'MBBS-01 (y) maxBlockBodySize must not exceed 122,880 bytes (120KB)\n\n' +
      'MBBS-02 (y) maxBlockBodySize must not be lower than 24,576 bytes (24KB)\n\n' +
      'MBBS-03a (x - exceptional circumstances) maxBlockBodySize must not be decreased, other than in exceptional circumstances where there are potential problems with security, performance, functionality or long-term sustainability\n\n' +
      'MBBS-04 (~ - no access to existing parameter values) maxBlockBodySize must be large enough to include at least one transaction (that is, maxBlockBodySize must be at least maxTxSize)\n\n' +
      'MBBS-05 (x - "should") maxBlockBodySize should be changed by at most 10,240 bytes (10KB) per epoch (5 days), and preferably by 8,192 bytes (8KB) or less per epoch\n\n' +
      'MBBS-06 (x - "should") The block size should not induce an additional Transmission Control Protocol (TCP) round trip. Any increase beyond this must be backed by performance analysis, simulation and benchmarking\n\n' +
      'MBBS-07 (x - "unquantifiable") The impact of any change to maxBlockBodySize must be confirmed by detailed benchmarking/simulation and not exceed the requirements of the block diffusion/propagation time budgets, as described below. Any increase to maxBlockBodySize must also consider future requirements for Plutus script execution (maxBlockExecutionUnits[steps]) against the total block diffusion target of 3s with 95% block propagation within 5s. The limit on maximum block size may be increased in the future if this is supported by benchmarking and monitoring results\n\n' +
      'Transaction Size (maxTxSize)\n\n' +
      'The maximum size of a transaction, in bytes.\n\n' +
      'GUARDRAILS\n\n' +
      'MTS-01 (y) maxTxSize must not exceed 32,768 bytes (32KB)\n\n' +
      'MTS-02 (y) maxTxSize must not be negative\n\n' +
      'MTS-03 (~ - no access to existing parameter values) maxTxSize must not be decreased\n\n' +
      'MTS-04 (~ - no access to existing parameter values) maxTxSize must not exceed maxBlockBodySize\n\n' +
      'MTS-05 (x - "should") maxTxSize should not be increased by more than 2,560 bytes (2.5KB) in any epoch, and preferably should be increased by 2,048 bytes (2KB) or less per epoch\n\n' +
      'MTS-06 (x - "should") maxTxSize should not exceed 1/4 of the block size\n\n' +
      'Memory Unit Limits (maxBlockExecutionUnits[memory], maxTxExecutionUnits[memory])\n\n' +
      'The limit on the maximum number of memory units that can be used by Plutus scripts, either per-transaction or per-block.\n\n' +
      'GUARDRAILS\n\n' +
      'MTEU-M-01 (y) maxTxExecutionUnits[memory] must not exceed 40,000,000 units\n\n' +
      'MTEU-M-02 (y) maxTxExecutionUnits[memory] must not be negative\n\n' +
      'MTEU-M-03 (~ - no access to existing parameter values) maxTxExecutionUnits[memory] must not be decreased\n\n' +
      'MTEU-M-04 (x - "should") maxTxExecutionUnits[memory] should not be increased by more than 2,500,000 units in any epoch\n\n' +
      'MBEU-M-01 (y) maxBlockExecutionUnits[memory] must not exceed 120,000,000 units\n\n' +
      'MBEU-M-02 (y) maxBlockExecutionUnits[memory] must not be negative\n\n' +
      'MBEU-M-03 (x - "should") maxBlockExecutionUnits[memory] should not be changed (increased or decreased) by more than 10,000,000 units in ANY epoch\n\n' +
      'MBEU-M-04a (x - "unquantifiable") The impact of any change to maxBlockExecutionUnits[memory] must be confirmed by detailed benchmarking/simulation and not exceed the requirements of the block diffusion/propagation time budgets, as also impacted by maxBlockExecutionUnits[steps] and maxBlockBodySize. Any increase must also consider previously agreed future requirements for the total block size (maxBlockBodySize) measured against the total block diffusion target of 3s with 95% block propagation within 5s. Future Plutus performance improvements may allow the per-block memory limit to be increased, but must be balanced against the overall diffusion limits as specified in the previous sentence, and future requirements\n\n' +
      'MEU-M-01 (~ - no access to existing parameter values) maxBlockExecutionUnits[memory] must not be less than maxTxExecutionUnits[memory]\n\n' +
      'CPU Unit Limits (maxBlockExecutionUnits[steps], maxTxExecutionUnits[steps])\n\n' +
      'The limit on the maximum number of CPU steps that can be used by Plutus scripts, either per transaction or per-block.\n\n' +
      'GUARDRAILS\n\n' +
      'MTEU-S-01 (y) maxTxExecutionUnits[steps] must not exceed 15,000,000,000 (15Bn) units\n\n' +
      'MTEU-S-02 (y) maxTxExecutionUnits[steps] must not be negative\n\n' +
      'MTEU-S-03 (~ - no access to existing parameter values) maxTxExecutionUnits[steps] must not be decreased\n\n' +
      'MTEU-S-04 (x - "should") maxTxExecutionUnits[steps] should not be increased by more than 500,000,000 (500M) units in any epoch (5 days)\n\n' +
      'MBEU-S-01 (y) maxBlockExecutionUnits[steps] must not exceed 40,000,000,000 (40Bn) units\n\n' +
      'MBEU-S-02 (y) maxBlockExecutionUnits[steps] must not be negative\n\n' +
      'MBEU-S-03 (x - "should") maxBlockExecutionUnits[steps] should not be changed (increased or decreased) by more than 2,000,000,000 (2Bn) units in any epoch (5 days)\n\n' +
      'MBEU-S-04a (x - "unquantifiable") The impact of the change to maxBlockExecutionUnits[steps] must be confirmed by detailed benchmarking/simulation and not exceed the requirements of the block diffusion/propagation time budgets, as also impacted by maxBlockExecutionUnits[memory] and maxBlockBodySize. Any increase must also consider previously identified future requirements for the total block size (maxBlockBodySize) measured against the total block diffusion target of 3s with 95% block propagation within 5s. Future Plutus performance improvements may allow the per-block step limit to be increased, but must be balanced against the overall diffusion limits as specified in the previous sentence, and future requirements\n\n' +
      'MEU-S-01 (~ - no access to existing parameter values) maxBlockExecutionUnits[steps] must not be less than maxTxExecutionUnits[steps]\n\n' +
      'Block Header Size (maxBlockHeaderSize)\n\n' +
      'The size of the block header.\n\n' +
      'GUARDRAILS\n\n' +
      'MBHS-01 (y) maxBlockHeaderSize must not exceed 5,000 bytes\n\n' +
      'MBHS-02 (y) maxBlockHeaderSize must not be negative\n\n' +
      'MBHS-03 (x - largest valid header is subject to change) maxBlockHeaderSize must be large enough for the largest valid header\n\n' +
      'MBHS-04 (x - "should") maxBlockHeaderSize should only normally be increased if the protocol changes\n\n' +
      'MBHS-05 (x - "should") maxBlockHeaderSize should be within TCP\'s initial congestion window (3 or 10 MTUs)',
  },
  {
    id: 'appendix-1-s2-4',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.4 \u2014 Technical/Security Parameters',
    text:
      'The overall goals when managing the technical/security parameters are:\n\n' +
      '1. Ensure the security of the Cardano Blockchain network in terms of decentralization and protection against adversarial actions\n\n' +
      '2. Enable changes to the Plutus language\n\n' +
      'Triggers for Change\n\n' +
      '1. Changes in the number of active SPOs\n\n' +
      '2. Changes to the Plutus language\n\n' +
      '3. Security threats\n\n' +
      '4. Cardano Community requests\n\n' +
      'Counter-indicators\n\n' +
      'Economic concerns, e.g. when changing the number of stake pools\n\n' +
      'Core Metrics\n\n' +
      'Number of stake pools\n\n' +
      'Level of decentralization\n\n' +
      'Changes to Specific Technical/Security Parameters\n\n' +
      'Target Number of Stake Pools (stakePoolTargetNum)\n\n' +
      'Sets the target number of stake pools\n\n' +
      'The expected number of stake pools when the network is in the equilibrium state\n\n' +
      'Primarily a security parameter, ensuring decentralization by stake pool division/replication\n\n' +
      'Has an economic effect as well as a security effect - economic advice based on analysis is also required when changing this parameter\n\n' +
      'Large changes in this parameter will trigger mass redelegation events\n\n' +
      'GUARDRAILS\n\n' +
      'SPTN-01 (y) stakePoolTargetNum must not be lower than 250\n\n' +
      'SPTN-02 (y) stakePoolTargetNum must not exceed 2,000\n\n' +
      'SPTN-03 (y) stakePoolTargetNum must not be negative\n\n' +
      'SPTN-04 (y) stakePoolTargetNum must not be zero\n\n' +
      'Pledge Influence Factor (poolPledgeInfluence)\n\n' +
      'Enables the pledge protection mechanism\n\n' +
      'Provides protection against Sybil attack\n\n' +
      'Higher values reward pools that have more pledge and penalize pools that have less pledge\n\n' +
      'Has an economic effect as well as technical effect - economic advice based on analysis is also required\n\n' +
      'GUARDRAILS\n\n' +
      'PPI-01 (y) poolPledgeInfluence must not be lower than 0.1\n\n' +
      'PPI-02 (y) poolPledgeInfluence must not exceed 1.0\n\n' +
      'PPI-03 (y) poolPledgeInfluence must not be negative\n\n' +
      'PPI-04 (x - "should") poolPledgeInfluence should not vary by more than +/- 10% in any 18-epoch period (approximately 3 months)\n\n' +
      'Pool Retirement Window (poolRetireMaxEpoch)\n\n' +
      'Defines the maximum number of epochs notice that a pool can give when planning to retire\n\n' +
      'GUARDRAILS\n\n' +
      'PRME-01 (y) poolRetireMaxEpoch must not be negative\n\n' +
      'PRME-02 (x - "should") poolRetireMaxEpoch should not be lower than 1\n\n' +
      'Collateral Percentage (collateralPercentage)\n\n' +
      'Defines how much collateral must be provided when executing a Plutus script as a percentage of the normal execution cost\n\n' +
      'Collateral is additional to fee payments\n\n' +
      'If a script fails to execute, then the collateral is lost\n\n' +
      'The collateral is never lost if a script executes successfully\n\n' +
      'Provides security against low-cost attacks by making it more expensive rather than less expensive to execute failed scripts\n\n' +
      'GUARDRAILS\n\n' +
      'CP-01 (y) collateralPercentage must not be lower than 100\n\n' +
      'CP-02 (y) collateralPercentage must not exceed 200\n\n' +
      'CP-03 (y) collateralPercentage must not be negative\n\n' +
      'CP-04 (y) collateralPercentage must not be zero\n\n' +
      'Maximum number of collateral inputs (maxCollateralInputs)\n\n' +
      'Defines the maximum number of inputs that can be used for collateral when executing a Plutus script\n\n' +
      'GUARDRAILS\n\n' +
      'MCI-01 (y) maxCollateralInputs must not be lower than 1\n\n' +
      'Maximum Value Size (maxValueSize)\n\n' +
      'The limit on the serialized size of the Value in each output.\n\n' +
      'GUARDRAILS\n\n' +
      'MVS-01 (y) maxValueSize must not exceed 12,288 bytes (12KB)\n\n' +
      'MVS-02 (y) maxValueSize must not be negative\n\n' +
      'MVS-03 (~ - no access to existing parameter values) maxValueSize must be less than maxTxSize\n\n' +
      'MVS-04 (~ - no access to existing parameter values) maxValueSize must not be reduced\n\n' +
      'MVS-05 (x - sensible output is subject to interpretation) maxValueSize must be large enough to allow sensible outputs (e.g. any existing on-chain output or anticipated outputs that could be produced by new ledger rules)\n\n' +
      'Plutus Cost Models (costModels)\n\n' +
      'Define the base costs for each Plutus primitive in terms of CPU and memory units\n\n' +
      'A different cost model is required for each Plutus version. Each cost model comprises many distinct cost model values. Cost models are defined for each Plutus language version. A new language version may introduce additional cost model values or remove existing cost model values.\n\n' +
      'GUARDRAILS\n\n' +
      'PCM-01 (x - "unquantifiable") Cost model values must be set by benchmarking on a reference architecture\n\n' +
      "PCM-02 (x - primitives and language versions aren't introduced in transactions) The cost model must be updated if new primitives are introduced or a new Plutus language version is added\n\n" +
      'PCM-03a (~ - no access to Plutus cost model parameters) Cost model values should not normally be negative. Negative values must be justified against the underlying cost model for the associated primitives\n\n' +
      'PCM-04 (~ - no access to Plutus cost model parameters) A cost model must be supplied for each Plutus language version that the protocol supports',
  },
  {
    id: 'appendix-1-s2-5',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.5 \u2014 Governance Parameters',
    text:
      'The overall goals when managing the governance parameters are to:\n\n' +
      '1. Ensure governance stability\n\n' +
      '2. Maintain a representative form of governance\n\n' +
      'Triggers for Change\n\n' +
      'Changes to governance parameters may be triggered by:\n\n' +
      '1. Cardano Community requests\n\n' +
      '2. Regulatory requirements\n\n' +
      '3. Unexpected or unwanted governance outcomes\n\n' +
      '4. Entering a state of no confidence\n\n' +
      'Counter-indicators\n\n' +
      'Changes may need to be reversed and/or should not be enacted in the event of:\n\n' +
      'Unexpected effects on governance\n\n' +
      'Excessive Layer 1 load due to on-chain voting or excessive numbers of governance actions\n\n' +
      'Core Metrics\n\n' +
      'All decisions on parameter changes should be informed by:\n\n' +
      'Governance participation levels\n\n' +
      'Governance behaviors and patterns\n\n' +
      'Regulatory considerations\n\n' +
      'Confidence in the governance system\n\n' +
      'The effectiveness of the governance system in managing necessary change\n\n' +
      'Changes to Specific Governance Parameters\n\n' +
      'Deposit for Governance Actions (govDeposit)\n\n' +
      'The deposit that is charged when submitting a governance action.\n\n' +
      'Helps to limit the number of actions that are submitted\n\n' +
      'GUARDRAILS\n\n' +
      'GD-01 (y) govDeposit must not be negative\n\n' +
      'GD-02 (y) govDeposit must not be lower than 1,000,000 (1 ada)\n\n' +
      'GD-03a (y) govDeposit must not exceed 10,000,000,000,000 (10 million ada)\n\n' +
      'GD-04 (x - "should") govDeposit should be adjusted in line with fiat changes\n\n' +
      'Deposit for DReps (dRepDeposit)\n\n' +
      'The deposit that is charged when registering a DRep.\n\n' +
      'Helps to limit the number of active DReps\n\n' +
      'GUARDRAILS\n\n' +
      'DRD-01 (y) dRepDeposit must not be negative\n\n' +
      'DRD-02 (y) dRepDeposit must not be lower than 1,000,000 (1 ada)\n\n' +
      'DRD-03 (y) dRepDeposit must not exceed 100,000,000,000 (100,000 ada)\n\n' +
      'DRD-04 (x - "should") dRepDeposit should be adjusted in line with fiat changes\n\n' +
      'DRep Activity Period (dRepActivity)\n\n' +
      'The period (as a whole number of epochs) after which a DRep is considered to be inactive for vote calculation purposes, if they do not vote on any proposal.\n\n' +
      'GUARDRAILS\n\n' +
      'DRA-01 (y) dRepActivity must not be lower than 13 epochs (65 days)\n\n' +
      'DRA-02 (y) dRepActivity must not exceed 37 epochs (185 days)\n\n' +
      'DRA-03 (y) dRepActivity must not be negative\n\n' +
      'DRA-04 (~ - no access to existing parameter values) dRepActivity must be greater than govActionLifetime\n\n' +
      'DRA-05 (x - "should") dRepActivity should be calculated in human terms (60 days, etc.)\n\n' +
      'DRep and SPO Governance Action Thresholds (dRepVotingThresholds[...], poolVotingThresholds[...])\n\n' +
      'Thresholds on the active voting stake that is required to ratify a specific type of governance action by either DReps or SPOs.\n\n' +
      'Ensures legitimacy of the action\n\n' +
      'The threshold parameters are listed below:\n\n' +
      'dRepVotingThresholds:\n' +
      'dvtCommitteeNoConfidence\n' +
      'dvtCommitteeNormal\n' +
      'dvtHardForkInitiation\n' +
      'dvtMotionNoConfidence\n' +
      'dvtPPEconomicGroup\n' +
      'dvtPPGovGroup\n' +
      'dvtPPNetworkGroup\n' +
      'dvtPPTechnicalGroup\n' +
      'dvtTreasuryWithdrawal\n' +
      'dvtUpdateToConstitution\n\n' +
      'poolVotingThresholds:\n' +
      'pvtCommitteeNoConfidence\n' +
      'pvtCommitteeNormal\n' +
      'pvtHardForkInitiation\n' +
      'pvtMotionNoConfidence\n' +
      'pvtPPSecurityGroup\n\n' +
      'GUARDRAILS\n\n' +
      'VT-GEN-01 (y) All thresholds must be greater than 50% and less than or equal to 100%\n\n' +
      'VT-GEN-02a (y) Economic, network and technical/security parameter thresholds must be in the range 51%-75%\n\n' +
      'VT-GEN-03 (y) Governance parameter thresholds must be in the range 75%-90%\n\n' +
      'VT-HF-01 (y) "Hard Fork Initiation" action thresholds must be in the range 51%-80%\n\n' +
      'VT-CON-01 (y) "New Constitution" action thresholds must be in the range 65%-90%\n\n' +
      'VT-CC-01 (y) "Update Committee" action thresholds must be in the range 51%-90%\n\n' +
      'VT-NC-01 (y) "No Confidence" action thresholds must be in the range 51%-75%\n\n' +
      'Governance Action Lifetime (govActionLifetime)\n\n' +
      'The period after which a governance action will expire if it is not enacted - as a whole number of epochs\n\n' +
      'GUARDRAILS\n\n' +
      'GAL-01 (y) govActionLifetime must not be lower than 1 epoch (5 days)\n\n' +
      'GAL-03 (x - "should") govActionLifetime should not be lower than 2 epochs (10 days)\n\n' +
      'GAL-02 (y) govActionLifetime must not exceed 15 epochs (75 days)\n\n' +
      'GAL-04 (x - "should") govActionLifetime should be calibrated in human terms (e.g., 30 days, two weeks), to allow sufficient time for voting etc. to take place\n\n' +
      'GAL-05 (~ - no access to existing parameter values) govActionLifetime must be less than dRepActivity\n\n' +
      'Maximum Constitutional Committee Term (committeeMaxTermLength)\n\n' +
      'The limit on the maximum term length that a committee member may serve\n\n' +
      'GUARDRAILS\n\n' +
      'CMTL-01a (y) committeeMaxTermLength must not be zero\n\n' +
      'CMTL-02a (y) committeeMaxTermLength must not be negative\n\n' +
      'CMTL-03a (y) committeeMaxTermLength must not be lower than 18 epochs (90 days, or approximately 3 months)\n\n' +
      'CMTL-04a (y) committeeMaxTermLength must not exceed 293 epochs (approximately 4 years)\n\n' +
      'CMTL-05a (x - "should") committeeMaxTermLength should not exceed 220 epochs (approximately 3 years)\n\n' +
      'The minimum size of the Constitutional Committee (committeeMinSize)\n\n' +
      'The least number of members that can be included in a Constitutional Committee following a governance action to change the Constitutional Committee.\n\n' +
      'GUARDRAILS\n\n' +
      'CMS-01 (y) committeeMinSize must not be negative\n\n' +
      'CMS-02 (y) committeeMinSize must not be lower than 3\n\n' +
      'CMS-03 (y) committeeMinSize must not exceed 10',
  },
  {
    id: 'appendix-1-s2-6',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.6 \u2014 Monitoring and Reversion of Parameter Changes',
    text:
      'All network parameter changes must be monitored carefully for no less than 2 epochs (10 days)\n\n' +
      'Changes must be reverted as soon as possible if block propagation delays exceed 4.5s for more than 5% of blocks over any 6 hour rolling window\n\n' +
      'All other parameter changes should be monitored\n\n' +
      'The reversion plan should be implemented if the overall effect on performance, security, functionality, or long-term sustainability is unacceptable.\n\n' +
      'A specific reversion/recovery plan must be produced for each parameter change. This plan must include:\n\n' +
      'Which parameters need to change and in which ways in order to return to the previous state (or a similar state)\n\n' +
      'How to recover the network in the event of disastrous failure\n\n' +
      'This plan should be followed if problems are observed following the parameter change. Note that not all changes can be reverted. Additional care must be taken when making changes to these parameters.',
  },
  {
    id: 'appendix-1-s2-7',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 2.7 \u2014 Non-Updatable Protocol Parameters',
    text: 'Some fundamental protocol parameters cannot be changed by the "Parameter Update" action. These parameters can only be changed in a new Genesis file as part of a hard fork. It is not necessary to provide specific guardrails on updating these parameters.',
  },
  {
    id: 'appendix-1-s3',
    articleNumber: null,
    sectionNumber: null,
    title:
      'Appendix I Section 3 \u2014 Guardrails and Guidelines on "Treasury Withdrawals" Actions',
    text:
      '"Treasury Withdrawals" actions specify the destination and amount of a number of withdrawals from the Cardano Treasury.\n\n' +
      'GUARDRAILS\n\n' +
      "TREASURY-01a (x) A Net Change Limit for the Cardano Treasury's balance per period of time must be agreed by the DReps via an on-chain governance action with a threshold of greater than 50% of the active voting stake\n\n" +
      "TREASURY-02a (x) Withdrawals from the Cardano Blockchain treasury must not exceed the Net Change Limit for the Cardano Treasury's balance per period of time\n\n" +
      'TREASURY-03a (x) Withdrawals from the Cardano Blockchain treasury must be denominated in ada',
  },
  {
    id: 'appendix-1-s4',
    articleNumber: null,
    sectionNumber: null,
    title:
      'Appendix I Section 4 \u2014 Guardrails and Guidelines on "Hard Fork Initiation" Actions',
    text:
      'The "Hard Fork Initiation" action requires both a new major and a new minor protocol version to be specified.\n\n' +
      'As positive integers\n\n' +
      'As the result of a hard fork, new updatable protocol parameters may be introduced. Guardrails may be defined for these parameters, which will take effect following the hard fork. Existing updatable protocol parameters may also be deprecated by the hard fork, in which case the guardrails become obsolete for all future changes.\n\n' +
      'GUARDRAILS\n\n' +
      'HARDFORK-01 (~ - no access to existing parameter values) The major protocol version must be the same as or one greater than the major version that will be enacted immediately prior to this change. If the major protocol version is one greater, then the minor protocol version must be zero\n\n' +
      'HARDFORK-02a (~ - no access to existing parameter values) Unless the major protocol version is also changed, the minor protocol version must be greater than the minor version that will be enacted immediately prior to this change\n\n' +
      'HARDFORK-03 (~ - no access to existing parameter values) At least one of the protocol versions (major or minor or both) must change\n\n' +
      'HARDFORK-04a (x) At least 85% of stake pools by active stake should have upgraded to a Cardano Blockchain node version that is capable of processing the rules associated with the new protocol version\n\n' +
      'HARDFORK-05 (x) Any new updatable protocol parameters that are introduced with a hard fork must be included in this Appendix and suitable guardrails defined for those parameters\n\n' +
      'HARDFORK-06 (x) Settings for any new protocol parameters that are introduced with a hard fork must be included in the appropriate Genesis file\n\n' +
      'HARDFORK-07 (x) Any deprecated protocol parameters must be indicated in this Appendix\n\n' +
      'HARDFORK-08 (~ - no access to Plutus cost model parameters) New Plutus versions must be supported by a version-specific Plutus cost model that covers each primitive that is available in the new Plutus version',
  },
  {
    id: 'appendix-1-s5',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 5 \u2014 Guardrails and Guidelines on "Update Committee" Actions',
    text:
      '"Update Committee" actions may change the size, composition or required voting thresholds for the Constitutional Committee.\n\n' +
      'GUARDRAILS\n\n' +
      'UPDATE-CC-01a (x) "Update Committee" actions must not be ratified until ada owners have ratified through an on-chain governance action this Constitution',
  },
  {
    id: 'appendix-1-s6',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 6 \u2014 Guardrails and Guidelines on "New Constitution" Actions',
    text:
      '"New Constitution" actions change the hash of the on-chain Constitution and the associated Guardrails Script.\n\n' +
      'GUARDRAILS\n\n' +
      'NEW-CONSTITUTION-01a (x) A New Constitution or Guardrails Script governance action must be submitted to define any required guardrails for new parameters that are introduced via a Hard Fork governance action\n\n' +
      'NEW-CONSTITUTION-02 (x) If specified, the new Guardrails Script must be consistent with this Constitution',
  },
  {
    id: 'appendix-1-s7',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 7 \u2014 Guardrails and Guidelines on "No Confidence" Actions',
    text:
      '"No Confidence" actions signal a state of no confidence in the governance system. No guardrails are imposed on "No Confidence" actions.\n\n' +
      'GUARDRAILS\n\n' +
      'None',
  },
  {
    id: 'appendix-1-s8',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 8 \u2014 Guardrails and Guidelines on "Info" Actions',
    text:
      '"Info" actions are not enacted on-chain. No guardrails are imposed on "Info" actions.\n\n' +
      'GUARDRAILS\n\n' +
      'None',
  },
  {
    id: 'appendix-1-s9',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix I Section 9 \u2014 List of Protocol Parameter Groups',
    text:
      'The protocol parameters are grouped by type, allowing different thresholds to be set for each group.\n\n' +
      'The network parameter group consists of:\n\n' +
      'maximum block body size (maxBlockBodySize)\n' +
      'maximum transaction size (maxTxSize)\n' +
      'maximum block header size (maxBlockHeaderSize)\n' +
      'maximum size of a serialized asset value (maxValueSize)\n' +
      'maximum script execution units in a single transaction (maxTxExecutionUnits[steps])\n' +
      'maximum script execution units in a single block (maxBlockExecutionUnits[steps])\n' +
      'maximum number of collateral inputs (maxCollateralInputs)\n\n' +
      'The economic parameter group consists of:\n\n' +
      'minimum fee coefficient (txFeePerByte)\n' +
      'minimum fee constant (txFeeFixed)\n' +
      'minimum fee per byte for reference scripts (minFeeRefScriptCoinsPerByte)\n' +
      'delegation key lovelace deposit (stakeAddressDeposit)\n' +
      'pool registration lovelace deposit (stakePoolDeposit)\n' +
      'monetary expansion (monetaryExpansion)\n' +
      'treasury expansion (treasuryCut)\n' +
      'minimum fixed rewards cut for pools (minPoolCost)\n' +
      'minimum lovelace deposit per byte of serialized UTxO (coinsPerUTxOByte)\n' +
      'prices of Plutus execution units (executionUnitPrices[priceSteps/priceMemory])\n\n' +
      'The technical/security parameter group consists of:\n\n' +
      'pool pledge influence (poolPledgeInfluence)\n' +
      'pool retirement maximum epoch (poolRetireMaxEpoch)\n' +
      'desired number of pools (stakePoolTargetNum)\n' +
      'Plutus execution cost models (costModels)\n' +
      'proportion of collateral needed for scripts (collateralPercentage)\n\n' +
      'The governance parameter group consists of:\n\n' +
      'governance voting thresholds (dRepVotingThresholds[...], poolVotingThresholds[...])\n' +
      'governance action maximum lifetime in epochs (govActionLifetime)\n' +
      'governance action deposit (govDeposit)\n' +
      'DRep deposit amount (dRepDeposit)\n' +
      'DRep activity period in epochs (dRepActivity)\n' +
      'minimal Constitutional Committee size (committeeMinSize)\n' +
      'maximum term length (in epochs) for the Constitutional Committee members (committeeMaxTermLength)',
  },

  // ─── APPENDIX II ────────────────────────────────────────────────────
  {
    id: 'appendix-2-s1',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix II Section 1 \u2014 Framing Notes',
    text:
      'This Appendix II is intended to provide guidance in interpreting the Constitution and the Constitutional Committee shall consider this Appendix II as it deems relevant and useful in carrying out its constitutional duties.\n\n' +
      'The Cardano Blockchain was established in 2017. In July 2020 the Cardano Blockchain was expanded to include independent block validators and in September 2024 an on-chain governance system was introduced. This Constitution outlines the rights and responsibilities of governance actors in the decentralized system who represent the ada owners; ada is the governance token of the Cardano Blockchain. The Cardano Blockchain is a decentralized ecosystem of blockchain technology, smart contracts, and community governance.\n\n' +
      'In approaching this Constitution, the Cardano Community recognizes that this is not a constitution for only a blockchain but rather a constitution for a blockchain ecosystem. Accordingly, how governance actions are approved, while extremely important, is not the sole focus of this Constitution. Rather, this Constitution provides the basis and fundamental framework through which all participants in the Cardano Community can come together to govern themselves and form new approaches to human interaction and collaboration.\n\n' +
      'By necessity, this Constitution recognizes the role of and empowers the Constitutional Committee, confirms the right of the Cardano Community to participate in collective bodies for collaboration, gives effect to on-chain governance, and empowers DReps - including ada owners acting directly as DReps - to act as the voice of ada owners for on-chain voting.\n\n' +
      'The Constitution also recognizes the necessity of safeguarding access to and the use of funds of the Cardano Blockchain treasury through the inclusion of the Cardano Blockchain Guardrails in this Constitution.',
  },
  {
    id: 'appendix-2-s2',
    articleNumber: null,
    sectionNumber: null,
    title: 'Appendix II Section 2 \u2014 Other Guidance',
    text: 'The drafters of the Constitution, together with other participants from the Cardano Community, have published and in the future may publish guidance for interpreting the Constitution, including, without limitation, a definition booklet that has been released contemporaneously with the on-chain ratification of the Constitution. So long as any such published guidance has been hashed to the Cardano Blockchain pursuant to an "Info" action, the Constitutional Committee shall not be precluded from considering and utilizing such guidance as it deems appropriate.',
  },
];

// ─── Helper Functions ───────────────────────────────────────────────

export function getConstitutionNode(id: string): ConstitutionNode | undefined {
  return CONSTITUTION_NODES.find((n) => n.id === id);
}

export function getConstitutionText(): string {
  return CONSTITUTION_NODES.map((n) => `${n.title}\n\n${n.text}`).join('\n\n---\n\n');
}
