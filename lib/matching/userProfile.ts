/**
 * Progressive user governance profile.
 * Recomputes the user's PCA position, alignment scores, and personality
 * after every vote. Lightweight: poll_responses fetch + matrix multiply.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { loadActivePCA } from '@/lib/alignment/pca';
import { projectUserVector } from '@/lib/representationMatch';
import { getPersonalityLabel } from '@/lib/drepIdentity';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { deriveUserAlignments } from './dimensionAgreement';
import { calculateMatchConfidence } from './confidence';

const DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

export interface UserGovernanceProfile {
  walletAddress: string;
  pcaCoordinates: number[] | null;
  alignmentScores: AlignmentScores;
  personalityLabel: string;
  votesUsed: number;
  confidence: number;
}

export async function updateUserProfile(walletAddress: string): Promise<UserGovernanceProfile | null> {
  const supabase = getSupabaseAdmin();

  const { data: pollVotes } = await supabase
    .from('poll_responses')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('wallet_address', walletAddress);

  if (!pollVotes?.length) return null;

  // Load PCA for projection
  const pca = await loadActivePCA();
  let pcaCoordinates: number[] | null = null;

  if (pca) {
    const userVoteMap = new Map<string, number>();
    for (const pv of pollVotes) {
      const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
      const v = pv.vote.toLowerCase();
      userVoteMap.set(key, v === 'yes' ? 1 : v === 'no' ? -1 : 0);
    }
    pcaCoordinates = projectUserVector(userVoteMap, pca.loadings, pca.proposalIds);
  }

  // Load proposal classifications for alignment derivation
  const proposalTxHashes = [...new Set(pollVotes.map((v) => v.proposal_tx_hash))];
  const { data: classifications } = await supabase
    .from('proposal_classifications')
    .select(
      'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
    )
    .in('proposal_tx_hash', proposalTxHashes);

  const classMap = new Map<string, Record<AlignmentDimension, number>>();
  if (classifications) {
    for (const c of classifications) {
      const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
      classMap.set(key, {
        treasuryConservative: Number(c.dim_treasury_conservative) || 0,
        treasuryGrowth: Number(c.dim_treasury_growth) || 0,
        decentralization: Number(c.dim_decentralization) || 0,
        security: Number(c.dim_security) || 0,
        innovation: Number(c.dim_innovation) || 0,
        transparency: Number(c.dim_transparency) || 0,
      });
    }
  }

  const alignmentScores =
    classMap.size > 0
      ? deriveUserAlignments(pollVotes, classMap)
      : ({
          treasuryConservative: null,
          treasuryGrowth: null,
          decentralization: null,
          security: null,
          innovation: null,
          transparency: null,
        } satisfies AlignmentScores);

  const personalityLabel = getPersonalityLabel(alignmentScores);
  const confidence = calculateMatchConfidence(pollVotes.length) / 100;

  // Upsert to DB
  await supabase.from('user_governance_profiles').upsert(
    {
      wallet_address: walletAddress,
      pca_coordinates: pcaCoordinates,
      alignment_scores: alignmentScores,
      personality_label: personalityLabel,
      votes_used: pollVotes.length,
      confidence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'wallet_address' },
  );

  return {
    walletAddress,
    pcaCoordinates,
    alignmentScores,
    personalityLabel,
    votesUsed: pollVotes.length,
    confidence: Math.round(confidence * 100),
  };
}
