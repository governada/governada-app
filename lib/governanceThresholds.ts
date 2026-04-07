import { createClient } from './supabase';

export type GovernanceThresholdKey =
  | 'dvt_motion_no_confidence'
  | 'dvt_committee_normal'
  | 'dvt_committee_no_confidence'
  | 'dvt_update_to_constitution'
  | 'dvt_hard_fork_initiation'
  | 'dvt_p_p_network_group'
  | 'dvt_p_p_economic_group'
  | 'dvt_p_p_technical_group'
  | 'dvt_p_p_gov_group'
  | 'dvt_treasury_withdrawal';

type GovernanceThresholdMap = Partial<Record<GovernanceThresholdKey, number>>;
export type ParameterGroup = 'network' | 'economic' | 'technical' | 'governance';

export interface GovernanceThresholdResolution {
  threshold: number | null;
  thresholdKey: GovernanceThresholdKey | null;
  thresholdKeys: GovernanceThresholdKey[];
}

interface GovernanceThresholdProposalInput {
  proposalType: string;
  paramChanges?: Record<string, unknown> | null;
}

const GOVERNANCE_THRESHOLD_COLUMNS = [
  'dvt_motion_no_confidence',
  'dvt_committee_normal',
  'dvt_committee_no_confidence',
  'dvt_update_to_constitution',
  'dvt_hard_fork_initiation',
  'dvt_p_p_network_group',
  'dvt_p_p_economic_group',
  'dvt_p_p_technical_group',
  'dvt_p_p_gov_group',
  'dvt_treasury_withdrawal',
] as const satisfies readonly GovernanceThresholdKey[];

const THRESHOLD_CACHE_MS = 24 * 60 * 60 * 1000;

const PROPOSAL_TYPE_THRESHOLD_KEY_MAP: Record<string, GovernanceThresholdKey> = {
  TreasuryWithdrawals: 'dvt_treasury_withdrawal',
  HardForkInitiation: 'dvt_hard_fork_initiation',
  NewConstitution: 'dvt_update_to_constitution',
  UpdateConstitution: 'dvt_update_to_constitution',
  NoConfidence: 'dvt_motion_no_confidence',
  NewCommittee: 'dvt_committee_normal',
  NewConstitutionalCommittee: 'dvt_committee_normal',
};

const PARAMETER_GROUP_THRESHOLD_KEY_MAP: Record<ParameterGroup, GovernanceThresholdKey> = {
  network: 'dvt_p_p_network_group',
  economic: 'dvt_p_p_economic_group',
  technical: 'dvt_p_p_technical_group',
  governance: 'dvt_p_p_gov_group',
};

const PARAMETER_GROUP_ALIASES: Record<ParameterGroup, readonly string[]> = {
  network: [
    'maxBlockBodySize',
    'maxTxSize',
    'maxBlockHeaderSize',
    'maxValueSize',
    'maxValSize',
    'maxTxExecutionUnits',
    'maxBlockExecutionUnits',
    'maxCollateralInputs',
  ],
  economic: [
    'txFeePerByte',
    'txFeeFixed',
    'minFeeRefScriptCoinsPerByte',
    'minFeeRefScriptCostPerByte',
    'stakeAddressDeposit',
    'keyDeposit',
    'stakePoolDeposit',
    'poolDeposit',
    'monetaryExpansion',
    'rho',
    'treasuryCut',
    'tau',
    'minPoolCost',
    'utxoCostPerByte',
    'coinsPerUTxOByte',
    'executionUnitPrices',
  ],
  technical: [
    'poolPledgeInfluence',
    'a0',
    'poolRetireMaxEpoch',
    'eMax',
    'stakePoolTargetNum',
    'nOpt',
    'costModels',
    'collateralPercentage',
  ],
  governance: [
    'dRepVotingThresholds',
    'poolVotingThresholds',
    'govActionLifetime',
    'govActionDeposit',
    'govDeposit',
    'dRepDeposit',
    'dRepActivity',
    'committeeMinSize',
    'committeeMaxTermLength',
  ],
};

const NORMALIZED_PARAMETER_GROUP_ALIASES = Object.entries(PARAMETER_GROUP_ALIASES).map(
  ([group, aliases]) => ({
    group: group as ParameterGroup,
    aliases: aliases.map(normalizeParamKey),
  }),
);

const SPO_SECURITY_PARAMETER_ALIASES = [
  'maxBlockBodySize',
  'maxTxSize',
  'maxBlockHeaderSize',
  'maxValueSize',
  'maxValSize',
  'maxBlockExecutionUnits',
  'txFeePerByte',
  'txFeeFixed',
  'utxoCostPerByte',
  'coinsPerUTxOByte',
  'govActionDeposit',
  'govDeposit',
  'minFeeRefScriptCostPerByte',
  'minFeeRefScriptCoinsPerByte',
].map(normalizeParamKey);

let cachedThresholds: { data: GovernanceThresholdMap; fetchedAt: number } | null = null;

function normalizeParamKey(paramKey: string): string {
  return paramKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function collectObjectKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return keys;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    keys.add(key);
    collectObjectKeys(nestedValue, keys);
  }

  return keys;
}

function inferThresholdKeyForProtocolParam(paramKey: string): GovernanceThresholdKey | null {
  const normalizedParamKey = normalizeParamKey(paramKey);
  if (!normalizedParamKey) {
    return null;
  }

  if (normalizedParamKey.startsWith('dvt') || normalizedParamKey.startsWith('pvt')) {
    return PARAMETER_GROUP_THRESHOLD_KEY_MAP.governance;
  }

  for (const { group, aliases } of NORMALIZED_PARAMETER_GROUP_ALIASES) {
    if (
      aliases.some((alias) => normalizedParamKey === alias || normalizedParamKey.startsWith(alias))
    ) {
      return PARAMETER_GROUP_THRESHOLD_KEY_MAP[group];
    }
  }

  return null;
}

export function resolveProtocolParameterGroups(
  paramChanges?: Record<string, unknown> | null,
): ParameterGroup[] {
  if (!paramChanges) {
    return [];
  }

  const groups = new Set<ParameterGroup>();
  for (const paramKey of collectObjectKeys(paramChanges)) {
    const thresholdKey = inferThresholdKeyForProtocolParam(paramKey);
    if (!thresholdKey) {
      continue;
    }

    const group = Object.entries(PARAMETER_GROUP_THRESHOLD_KEY_MAP).find(
      ([, key]) => key === thresholdKey,
    )?.[0] as ParameterGroup | undefined;

    if (group) {
      groups.add(group);
    }
  }

  return [...groups];
}

export function isSecurityRelevantParameterUpdate(
  paramChanges?: Record<string, unknown> | null,
): boolean {
  if (!paramChanges) {
    return false;
  }

  for (const paramKey of collectObjectKeys(paramChanges)) {
    const normalizedParamKey = normalizeParamKey(paramKey);
    if (
      SPO_SECURITY_PARAMETER_ALIASES.some(
        (alias) => normalizedParamKey === alias || normalizedParamKey.startsWith(alias),
      )
    ) {
      return true;
    }
  }

  return false;
}

export function resolveGovernanceThresholdKeys(
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): GovernanceThresholdKey[] {
  if (proposalType === 'ParameterChange') {
    const thresholdKeys = new Set<GovernanceThresholdKey>(
      resolveProtocolParameterGroups(paramChanges).map(
        (group) => PARAMETER_GROUP_THRESHOLD_KEY_MAP[group],
      ),
    );
    return [...thresholdKeys];
  }

  const thresholdKey = PROPOSAL_TYPE_THRESHOLD_KEY_MAP[proposalType];
  return thresholdKey ? [thresholdKey] : [];
}

async function loadThresholdsFromSupabase(): Promise<GovernanceThresholdMap | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('epoch_params')
    .select(`epoch_no,${GOVERNANCE_THRESHOLD_COLUMNS.join(',')}`)
    .order('epoch_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const thresholds: GovernanceThresholdMap = {};
  const thresholdRow = data as unknown as Record<string, unknown>;
  for (const key of GOVERNANCE_THRESHOLD_COLUMNS) {
    const value = Number(thresholdRow[key]);
    if (Number.isFinite(value)) {
      thresholds[key] = value;
    }
  }

  return Object.keys(thresholds).length > 0 ? thresholds : null;
}

async function loadGovernanceThresholds(): Promise<GovernanceThresholdMap | null> {
  if (cachedThresholds && Date.now() - cachedThresholds.fetchedAt < THRESHOLD_CACHE_MS) {
    return cachedThresholds.data;
  }

  const supabaseThresholds = await loadThresholdsFromSupabase().catch(() => null);
  if (supabaseThresholds) {
    cachedThresholds = { data: supabaseThresholds, fetchedAt: Date.now() };
    return supabaseThresholds;
  }

  const { fetchGovernanceThresholds } = await import('@/utils/koios');
  const koiosThresholds = await fetchGovernanceThresholds();
  if (koiosThresholds) {
    cachedThresholds = { data: koiosThresholds, fetchedAt: Date.now() };
    return koiosThresholds;
  }

  return null;
}

export async function getGovernanceThresholdForProposal(
  proposal: GovernanceThresholdProposalInput,
): Promise<GovernanceThresholdResolution> {
  const thresholdKeys = resolveGovernanceThresholdKeys(
    proposal.proposalType,
    proposal.paramChanges,
  );
  if (thresholdKeys.length === 0) {
    return {
      threshold: null,
      thresholdKey: null,
      thresholdKeys,
    };
  }

  const thresholds = await loadGovernanceThresholds();
  if (!thresholds) {
    return {
      threshold: null,
      thresholdKey: thresholdKeys[0] ?? null,
      thresholdKeys,
    };
  }

  let bestMatch: { threshold: number; thresholdKey: GovernanceThresholdKey } | null = null;

  for (const thresholdKey of thresholdKeys) {
    const threshold = thresholds[thresholdKey];
    if (threshold == null) {
      continue;
    }

    if (!bestMatch || threshold > bestMatch.threshold) {
      bestMatch = { threshold, thresholdKey };
    }
  }

  return {
    threshold: bestMatch?.threshold ?? null,
    thresholdKey: bestMatch?.thresholdKey ?? null,
    thresholdKeys,
  };
}

export function __resetGovernanceThresholdCacheForTests() {
  cachedThresholds = null;
}
