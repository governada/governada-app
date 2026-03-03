/**
 * User governance profile API.
 * Returns the user's alignment scores, personality label, confidence, and votes used.
 * Creates/updates the profile on first access if it doesn't exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { createClient } from '@/lib/supabase';
import { updateUserProfile } from '@/lib/matching/userProfile';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  if (!session?.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // Try to load existing profile
  const { data: existing } = await supabase
    .from('user_governance_profiles')
    .select('alignment_scores, personality_label, votes_used, confidence, updated_at')
    .eq('wallet_address', session.walletAddress)
    .single();

  if (existing) {
    return NextResponse.json({
      alignmentScores: existing.alignment_scores,
      personalityLabel: existing.personality_label,
      votesUsed: existing.votes_used,
      confidence: Math.round((existing.confidence ?? 0) * 100),
      updatedAt: existing.updated_at,
    });
  }

  // No profile yet — compute and store
  const profile = await updateUserProfile(session.walletAddress);
  if (!profile) {
    return NextResponse.json({
      alignmentScores: null,
      personalityLabel: null,
      votesUsed: 0,
      confidence: 0,
      updatedAt: null,
    });
  }

  return NextResponse.json({
    alignmentScores: profile.alignmentScores,
    personalityLabel: profile.personalityLabel,
    votesUsed: profile.votesUsed,
    confidence: profile.confidence,
    updatedAt: new Date().toISOString(),
  });
}
