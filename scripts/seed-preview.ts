/**
 * Seed Preview — deterministic synthetic data for per-PR Supabase branches.
 *
 * Run in CI after the Supabase Preview check succeeds:
 *   SUPABASE_PREVIEW_BRANCH=1 NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run seed:preview
 *
 * This script intentionally refuses to run against the known production project
 * and requires sandbox delegation mode before writing anything.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, TablesInsert } from '../types/database';

config({ path: resolve(process.cwd(), '.env.preview'), quiet: true });

const PRODUCTION_SUPABASE_PROJECT_REF = 'pbfprhbaayvcrxokgicr';
const SEED_MARKER = 'homepage-phase-0-5-preview-seed-v1';
const SEEDED_AT = '2026-05-03T00:00:00.000Z';
const CURRENT_EPOCH = 560;
const FIXTURE_STAKE_ADDRESS = 'stake1upreviewfixture0000000000000000000000000000000000000000000000';
const PREVIEW_AUTH_USER_COUNT = 10;

type SeedEnv = Record<string, string | undefined>;
type TypedSupabase = SupabaseClient<Database>;

type AlignmentDimension =
  | 'treasuryConservative'
  | 'treasuryGrowth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

interface PreviewSeedConfig {
  supabaseSecretKey: string;
  supabaseUrl: string;
}

const DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

const DIMENSION_META: Record<
  AlignmentDimension,
  { column: keyof DRepAlignmentColumns; label: string }
> = {
  treasuryConservative: {
    column: 'alignment_treasury_conservative',
    label: 'Treasury Conservative',
  },
  treasuryGrowth: { column: 'alignment_treasury_growth', label: 'Treasury Growth' },
  decentralization: { column: 'alignment_decentralization', label: 'Decentralization' },
  security: { column: 'alignment_security', label: 'Security' },
  innovation: { column: 'alignment_innovation', label: 'Innovation' },
  transparency: { column: 'alignment_transparency', label: 'Transparency' },
};

type DRepAlignmentColumns = Pick<
  TablesInsert<'dreps'>,
  | 'alignment_decentralization'
  | 'alignment_innovation'
  | 'alignment_security'
  | 'alignment_transparency'
  | 'alignment_treasury_conservative'
  | 'alignment_treasury_growth'
>;

const PROPOSALS: TablesInsert<'proposals'>[] = [
  {
    tx_hash: previewTxHash(1),
    proposal_index: 0,
    proposal_id: 'preview-hardfork-001',
    proposal_type: 'HardForkInitiation',
    title: 'Preview Hard Fork: Protocol 11 Readiness',
    abstract:
      'Synthetic Tier 0 hard fork proposal for preview testing of critical-governance homepage states.',
    ai_summary:
      'Tests how Governada highlights hard fork urgency, voting readiness, and DRep positioning.',
    proposed_epoch: CURRENT_EPOCH - 1,
    expiration_epoch: CURRENT_EPOCH + 3,
    block_time: 1_779_000_000,
    relevant_prefs: ['security', 'innovation'],
    meta_json: previewMeta('hardfork') as Json,
  },
  {
    tx_hash: previewTxHash(2),
    proposal_index: 0,
    proposal_id: 'preview-no-confidence-001',
    proposal_type: 'NoConfidence',
    title: 'Preview No Confidence Motion: Interim Governance Reset',
    abstract: 'Synthetic Tier 0 no-confidence proposal for high-impact funnel and alert testing.',
    ai_summary: 'Tests critical motion treatment and citizen sentiment contrast in preview.',
    proposed_epoch: CURRENT_EPOCH - 1,
    expiration_epoch: CURRENT_EPOCH + 2,
    block_time: 1_779_003_600,
    relevant_prefs: ['transparency', 'decentralization'],
    meta_json: previewMeta('no-confidence') as Json,
  },
  {
    tx_hash: previewTxHash(3),
    proposal_index: 0,
    proposal_id: 'preview-treasury-001',
    proposal_type: 'TreasuryWithdrawals',
    title: 'Preview Treasury Withdrawal: Open Civic Infrastructure Fund',
    abstract: 'Synthetic large treasury withdrawal for amber-tint and budget-pressure testing.',
    ai_summary: 'Exercises treasury magnitude visuals and fiscal caution copy in preview.',
    proposed_epoch: CURRENT_EPOCH - 2,
    expiration_epoch: CURRENT_EPOCH + 4,
    block_time: 1_778_910_000,
    relevant_prefs: ['treasuryConservative', 'treasuryGrowth', 'transparency'],
    treasury_tier: 'large',
    withdrawal_amount: 18_500_000,
    meta_json: previewMeta('treasury') as Json,
  },
  {
    tx_hash: previewTxHash(4),
    proposal_index: 0,
    proposal_id: 'preview-parameter-001',
    proposal_type: 'ParameterChange',
    title: 'Preview Parameter Change: DRep Activity Window',
    abstract: 'Synthetic parameter change proposal for testing moderate-impact proposal cards.',
    ai_summary: 'Changes the activity window used for DRep participation expectations.',
    proposed_epoch: CURRENT_EPOCH - 3,
    expiration_epoch: CURRENT_EPOCH + 5,
    block_time: 1_778_820_000,
    relevant_prefs: ['security', 'decentralization'],
    param_changes: { drepActivity: 24 } as Json,
    meta_json: previewMeta('parameter') as Json,
  },
  {
    tx_hash: previewTxHash(5),
    proposal_index: 0,
    proposal_id: 'preview-info-001',
    proposal_type: 'InfoAction',
    title: 'Preview Info Action: Civic Education Working Group',
    abstract:
      'Synthetic info action proposal for low-risk informational states and list density testing.',
    ai_summary: 'Captures community coordination without treasury or protocol changes.',
    proposed_epoch: CURRENT_EPOCH - 4,
    expiration_epoch: CURRENT_EPOCH + 6,
    block_time: 1_778_730_000,
    relevant_prefs: ['transparency', 'innovation'],
    meta_json: previewMeta('info') as Json,
  },
];

function previewMeta(kind: string): Record<string, unknown> {
  return {
    seed: SEED_MARKER,
    kind,
    synthetic: true,
    generatedFor: 'homepage-redesign-preview',
  };
}

function previewTxHash(index: number): string {
  return `50${index.toString(16).padStart(2, '0')}`.padEnd(64, '0');
}

function previewDRepId(index: number): string {
  return `drep1preview${index.toString().padStart(2, '0')}`;
}

function previewVoteHash(index: number): string {
  return `70${index.toString(16).padStart(2, '0')}`.padEnd(64, '0');
}

function previewAuthEmail(index: number): string {
  return `preview-seed-${index.toString().padStart(2, '0')}@preview.governada.local`;
}

function deterministicUuid(index: number): string {
  const tail = index.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

function pickEnv(env: SeedEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value) return stripOuterQuotes(value);
  }
  return undefined;
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function resolvePreviewSeedConfig(env: SeedEnv = process.env): PreviewSeedConfig {
  const supabaseUrl = pickEnv(env, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'API_URL',
    'SUPABASE_API_URL',
  ]);
  const supabaseSecretKey = pickEnv(env, [
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SERVICE_ROLE_KEY',
  ]);

  if (!supabaseUrl) {
    throw new Error('Missing preview Supabase URL');
  }
  if (!supabaseSecretKey) {
    throw new Error('Missing preview Supabase secret key');
  }

  assertPreviewSeedTarget(supabaseUrl, env);
  return { supabaseSecretKey, supabaseUrl };
}

export function assertPreviewSeedTarget(supabaseUrl: string, env: SeedEnv = process.env): void {
  const parsed = new URL(supabaseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const projectRef = hostname.split('.')[0];

  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error('Refusing to seed the known production Supabase project');
  }

  if (!hostname.endsWith('.supabase.co')) {
    throw new Error('Preview seed target must be a hosted Supabase project URL');
  }

  if (env.SUPABASE_PREVIEW_BRANCH !== '1') {
    throw new Error('Preview seed requires SUPABASE_PREVIEW_BRANCH=1');
  }

  const mode = env.GOVERNADA_DELEGATION_MODE ?? env.NEXT_PUBLIC_GOVERNADA_DELEGATION_MODE;
  if (mode !== 'sandbox') {
    throw new Error('Preview seed requires GOVERNADA_DELEGATION_MODE=sandbox');
  }
}

export function buildPreviewDReps(): TablesInsert<'dreps'>[] {
  const rows: TablesInsert<'dreps'>[] = [];
  let index = 1;

  for (const dimension of DIMENSIONS) {
    const meta = DIMENSION_META[dimension];
    for (let clusterIndex = 1; clusterIndex <= 4; clusterIndex += 1) {
      const id = previewDRepId(index);
      const alignments = buildAlignmentProfile(dimension, clusterIndex);
      const name = `Preview ${meta.label} ${clusterIndex}`;
      const votingPower = (18_000_000 + index * 1_250_000).toString();

      rows.push({
        id,
        ...alignments,
        alignment_decentralization_raw: alignments.alignment_decentralization,
        alignment_innovation_raw: alignments.alignment_innovation,
        alignment_security_raw: alignments.alignment_security,
        alignment_transparency_raw: alignments.alignment_transparency,
        alignment_treasury_conservative_raw: alignments.alignment_treasury_conservative,
        alignment_treasury_growth_raw: alignments.alignment_treasury_growth,
        confidence: 72 + clusterIndex * 3,
        current_tier: clusterIndex === 1 ? 'A' : clusterIndex === 2 ? 'B' : 'C',
        deliberation_modifier: 1,
        effective_participation: 68 + clusterIndex * 4,
        effective_participation_v3: 68 + clusterIndex * 4,
        engagement_quality: 65 + clusterIndex * 3,
        governance_identity: 70 + clusterIndex * 2,
        info: {
          name,
          givenName: name,
          handle: `preview-${dimension}-${clusterIndex}`,
          ticker: `P${index.toString().padStart(2, '0')}`,
          delegatorCount: 40 + index * 3,
          votingPowerLovelace: votingPower,
          objectives: `Synthetic ${meta.label.toLowerCase()} preview DRep for homepage testing.`,
          motivations: 'Preview-only fixture data. No production identity or PII.',
          qualifications: 'Generated by Governada Phase 0.5 preview seed.',
        } as Json,
        last_personality_label: meta.label,
        last_vote_time: 1_778_700_000 + index * 3600,
        metadata: {
          seed: SEED_MARKER,
          dominantDimension: dimension,
          synthetic: true,
        } as Json,
        metadata_hash_verified: true,
        participation_rate: 70 + clusterIndex * 3,
        profile_completeness: 85 + clusterIndex,
        rationale_rate: 52 + clusterIndex * 5,
        reliability_score: 74 + clusterIndex * 3,
        score: 58 + index,
        score_momentum: clusterIndex % 2 === 0 ? 2.5 : -1.2,
        score_version: 'preview-seed',
        size_tier: clusterIndex <= 2 ? 'medium' : 'small',
        spotlight_narrative: `${name} is synthetic preview data for alignment-cluster cinema testing.`,
        spotlight_narrative_generated_at: SEEDED_AT,
        updated_at: SEEDED_AT,
        votes: [],
      });
      index += 1;
    }
  }

  for (let neutralIndex = 1; neutralIndex <= 2; neutralIndex += 1) {
    const id = previewDRepId(index);
    rows.push({
      id,
      alignment_decentralization: 50 + neutralIndex,
      alignment_innovation: 49 + neutralIndex,
      alignment_security: 51 - neutralIndex,
      alignment_transparency: 50,
      alignment_treasury_conservative: 48 + neutralIndex,
      alignment_treasury_growth: 52 - neutralIndex,
      confidence: 68,
      current_tier: 'B',
      effective_participation: 66,
      governance_identity: 64,
      info: {
        name: `Preview Neutral ${neutralIndex}`,
        givenName: `Preview Neutral ${neutralIndex}`,
        handle: `preview-neutral-${neutralIndex}`,
        ticker: `PN${neutralIndex}`,
        delegatorCount: 22 + neutralIndex,
        votingPowerLovelace: (10_000_000 + neutralIndex * 1_000_000).toString(),
        objectives: 'Synthetic neutral preview DRep for balanced-match testing.',
      } as Json,
      metadata: {
        seed: SEED_MARKER,
        dominantDimension: 'neutral',
        synthetic: true,
      } as Json,
      participation_rate: 65,
      profile_completeness: 78,
      rationale_rate: 48,
      reliability_score: 67,
      score: 60 + neutralIndex,
      score_version: 'preview-seed',
      size_tier: 'small',
      updated_at: SEEDED_AT,
      votes: [],
    });
    index += 1;
  }

  return rows;
}

function buildAlignmentProfile(
  dominant: AlignmentDimension,
  clusterIndex: number,
): DRepAlignmentColumns {
  const base: DRepAlignmentColumns = {
    alignment_decentralization: 46 + clusterIndex,
    alignment_innovation: 48 + clusterIndex,
    alignment_security: 47 + clusterIndex,
    alignment_transparency: 49 + clusterIndex,
    alignment_treasury_conservative: 45 + clusterIndex,
    alignment_treasury_growth: 50 - clusterIndex,
  };
  base[DIMENSION_META[dominant].column] = 76 + clusterIndex * 4;
  return base;
}

export function buildPreviewAuthUserIds(count = PREVIEW_AUTH_USER_COUNT): string[] {
  return Array.from({ length: count }, (_, i) => deterministicUuid(1_000 + i + 1));
}

export function buildPreviewSentimentRows(
  userIds = buildPreviewAuthUserIds(),
): TablesInsert<'citizen_sentiment'>[] {
  if (userIds.length === 0) {
    throw new Error('Preview sentiment seed requires at least one auth user id');
  }

  return Array.from({ length: 50 }, (_, i) => {
    const proposal = PROPOSALS[i % PROPOSALS.length];
    const drepId = previewDRepId((i % 24) + 1);
    const sentiment = i % 5 === 0 ? 'oppose' : i % 3 === 0 ? 'unsure' : 'support';

    return {
      id: deterministicUuid(i + 1),
      created_at: SEEDED_AT,
      updated_at: SEEDED_AT,
      delegated_drep_id: drepId,
      initial_sentiment: sentiment,
      proposal_index: proposal.proposal_index,
      proposal_tx_hash: proposal.tx_hash,
      sentiment,
      stake_address: `${FIXTURE_STAKE_ADDRESS}${i.toString().padStart(2, '0')}`,
      user_id: userIds[Math.floor(i / PROPOSALS.length) % userIds.length],
      wallet_address: `preview-wallet-${(i + 1).toString().padStart(2, '0')}`,
    };
  });
}

export function buildPreviewVotes(): TablesInsert<'drep_votes'>[] {
  const votes: TablesInsert<'drep_votes'>[] = [];
  const choices = ['Yes', 'No', 'Abstain'] as const;

  for (let i = 0; i < 10; i += 1) {
    const proposal = PROPOSALS[i % PROPOSALS.length];
    votes.push({
      block_time: 1_779_010_000 + i * 7200,
      created_at: SEEDED_AT,
      drep_id: previewDRepId((i % 12) + 1),
      epoch_no: CURRENT_EPOCH,
      has_rationale: i % 2 === 0,
      meta_hash: `preview-meta-${i + 1}`,
      meta_url: `https://preview.governada.local/rationale/${i + 1}`,
      power_source: i % 2 === 0 ? 'exact' : 'nearest',
      proposal_index: proposal.proposal_index,
      proposal_tx_hash: proposal.tx_hash,
      rationale_ai_summary:
        i % 2 === 0 ? 'Synthetic rationale summary for preview vote replay testing.' : null,
      rationale_quality: i % 2 === 0 ? 78 : null,
      vote: choices[i % choices.length],
      vote_tx_hash: previewVoteHash(i + 1),
      voting_power_lovelace: 5_000_000 + i * 250_000,
    });
  }

  return votes;
}

function buildFeatureFlags(): TablesInsert<'feature_flags'>[] {
  return [
    {
      key: 'globe_alignment_layout',
      enabled: true,
      category: 'Preview',
      description: 'Enabled by synthetic preview seed for homepage constellation verification.',
      targeting: { seed: SEED_MARKER } as Json,
      updated_at: SEEDED_AT,
    },
    {
      key: 'globe_homepage_v2',
      enabled: true,
      category: 'Preview',
      description: 'Enabled by synthetic preview seed for homepage redesign verification.',
      targeting: { seed: SEED_MARKER } as Json,
      updated_at: SEEDED_AT,
    },
  ];
}

function buildGovernanceStats(): TablesInsert<'governance_stats'> {
  return {
    id: 1,
    circulating_supply_lovelace: 36_000_000_000_000_000,
    current_epoch: CURRENT_EPOCH,
    epoch_end_time: '2026-05-08T00:00:00.000Z',
    treasury_balance_lovelace: 1_400_000_000_000_000,
    treasury_balance_updated_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  };
}

function buildSandboxDelegation(): TablesInsert<'sandbox_delegations'> {
  return {
    id: deterministicUuid(999),
    created_at: SEEDED_AT,
    simulated_tx_hash: `sandbox-${deterministicUuid(999)}`,
    stake_address: FIXTURE_STAKE_ADDRESS,
    target_drep_id: previewDRepId(1),
  };
}

function buildDelegatorSnapshots(): TablesInsert<'drep_delegator_snapshots'>[] {
  return [
    {
      drep_id: previewDRepId(1),
      epoch_no: CURRENT_EPOCH,
      stake_address: FIXTURE_STAKE_ADDRESS,
      amount_lovelace: 42_000_000,
      snapshot_at: SEEDED_AT,
    },
  ];
}

async function runWrite(
  label: string,
  query: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`Failed to seed ${label}: ${error.message}`);
}

async function listPreviewAuthUsers(supabase: TypedSupabase): Promise<Map<string, string>> {
  const expectedEmails = new Set(
    Array.from({ length: PREVIEW_AUTH_USER_COUNT }, (_, i) => previewAuthEmail(i + 1)),
  );
  const usersByEmail = new Map<string, string>();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Failed to list preview auth users: ${error.message}`);

    for (const user of data.users) {
      const email = user.email?.toLowerCase();
      if (email && expectedEmails.has(email)) {
        usersByEmail.set(email, user.id);
      }
    }

    if (data.users.length < 100 || usersByEmail.size === expectedEmails.size) break;
  }

  return usersByEmail;
}

export async function ensurePreviewAuthUsers(supabase: TypedSupabase): Promise<string[]> {
  const emails = Array.from({ length: PREVIEW_AUTH_USER_COUNT }, (_, i) => previewAuthEmail(i + 1));
  const usersByEmail = await listPreviewAuthUsers(supabase);

  for (const email of emails) {
    if (usersByEmail.has(email)) continue;

    const { data, error } = await supabase.auth.admin.createUser({
      app_metadata: { preview_seed: SEED_MARKER },
      ban_duration: '876000h',
      email,
      email_confirm: true,
      password: `PreviewSeedOnly-${SEED_MARKER}`,
      user_metadata: { preview_seed: SEED_MARKER },
    });

    if (error) throw new Error(`Failed to create preview auth user ${email}: ${error.message}`);
    if (!data.user?.id) throw new Error(`Preview auth user ${email} was created without an id`);
    usersByEmail.set(email, data.user.id);
  }

  return emails.map((email) => {
    const userId = usersByEmail.get(email);
    if (!userId) throw new Error(`Preview auth user ${email} was not resolved`);
    return userId;
  });
}

export async function seedPreviewSupabase(
  supabase: TypedSupabase,
): Promise<Record<string, number>> {
  const dreps = buildPreviewDReps();
  const proposals = PROPOSALS;
  const authUserIds = await ensurePreviewAuthUsers(supabase);
  const sentiment = buildPreviewSentimentRows(authUserIds);
  const votes = buildPreviewVotes();
  const sandboxDelegation = buildSandboxDelegation();
  const delegatorSnapshots = buildDelegatorSnapshots();
  const featureFlags = buildFeatureFlags();

  await runWrite(
    'preview drep_delegator_snapshots',
    supabase.from('drep_delegator_snapshots').delete().eq('stake_address', FIXTURE_STAKE_ADDRESS),
  );

  await runWrite('dreps', supabase.from('dreps').upsert(dreps, { onConflict: 'id' }));
  await runWrite(
    'proposals',
    supabase.from('proposals').upsert(proposals, { onConflict: 'tx_hash,proposal_index' }),
  );
  await runWrite(
    'citizen_sentiment',
    supabase.from('citizen_sentiment').upsert(sentiment, { onConflict: 'id' }),
  );
  await runWrite(
    'drep_votes',
    supabase.from('drep_votes').upsert(votes, { onConflict: 'vote_tx_hash' }),
  );
  await runWrite(
    'sandbox_delegations',
    supabase.from('sandbox_delegations').upsert([sandboxDelegation], { onConflict: 'id' }),
  );
  await runWrite(
    'drep_delegator_snapshots',
    supabase.from('drep_delegator_snapshots').insert(delegatorSnapshots),
  );
  await runWrite(
    'feature_flags',
    supabase.from('feature_flags').upsert(featureFlags, { onConflict: 'key' }),
  );
  await runWrite(
    'governance_stats',
    supabase.from('governance_stats').upsert([buildGovernanceStats()], { onConflict: 'id' }),
  );

  return {
    dreps: dreps.length,
    proposals: proposals.length,
    auth_users: authUserIds.length,
    citizen_sentiment: sentiment.length,
    drep_votes: votes.length,
    sandbox_delegations: 1,
    drep_delegator_snapshots: delegatorSnapshots.length,
    feature_flags: featureFlags.length,
    governance_stats: 1,
  };
}

async function main(): Promise<void> {
  const config = resolvePreviewSeedConfig();
  const supabase = createClient<Database>(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Preview seed target: ${new URL(config.supabaseUrl).hostname}`);
  const counts = await seedPreviewSupabase(supabase);

  console.log('Preview seed complete:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
