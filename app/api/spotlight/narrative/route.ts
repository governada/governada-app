export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getCachedNarrative,
  cacheNarrative,
  generateDRepNarrative,
  generateSPONarrative,
} from '@/lib/spotlight/narratives';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import {
  extractAlignments,
  getDominantDimension,
  getCompoundArchetype,
  getDimensionLabel,
} from '@/lib/drepIdentity';
import { computeTier } from '@/lib/scoring/tiers';
import { getPoolStrengths } from '@/components/governada/cards/GovernadaSPOCard';

// Rate limit: 5/min/IP (bounded in-memory counter)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;
const RATE_MAP_MAX = 5_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    // Evict expired entries when map grows too large
    if (rateLimitMap.size >= RATE_MAP_MAX) {
      for (const [key, val] of rateLimitMap) {
        if (now > val.resetAt) rateLimitMap.delete(key);
      }
      // If still over limit after eviction, drop oldest entries
      if (rateLimitMap.size >= RATE_MAP_MAX) {
        const keysToDelete = [...rateLimitMap.keys()].slice(0, 1000);
        for (const k of keysToDelete) rateLimitMap.delete(k);
      }
    }
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const enabled = await getFeatureFlag('spotlight_narratives');
    if (!enabled) {
      return NextResponse.json({ narrative: null, source: 'disabled' });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { entityType, entityId } = await req.json();
    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 });
    }

    // Check cache first
    const cached = await getCachedNarrative(entityType, entityId);
    if (cached) {
      return NextResponse.json({ narrative: cached, source: 'cache' });
    }

    // Generate based on entity type
    let narrative: string | null = null;

    const supabase = getSupabaseAdmin();

    if (entityType === 'drep') {
      const { data: drep } = await supabase
        .from('dreps')
        .select('*')
        .eq('drep_id', entityId)
        .single();

      if (!drep) return NextResponse.json({ narrative: null, source: 'not_found' });

      const info = drep.info as Record<string, unknown> | null;
      const alignments = extractAlignments(drep);
      const dominant = getDominantDimension(alignments);
      const archetype = getCompoundArchetype(alignments);
      const score = drep.score ?? 0;

      // Get pillar strengths
      const pillars: [string, number][] = [
        ['Explains votes', (drep.engagement_quality as number) ?? 0],
        ['Active voter', (drep.effective_participation_v3 as number) ?? 0],
        ['Reliable', (drep.reliability_v3 as number) ?? 0],
        ['Clear identity', (drep.governance_identity as number) ?? 0],
      ];
      const strengths = pillars
        .filter(([, v]) => v >= 65)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([label]) => label);

      narrative = await generateDRepNarrative({
        name: (info?.name as string) ?? (info?.ticker as string) ?? entityId.slice(0, 16),
        score,
        tier: computeTier(score),
        archetype,
        participationRate: (drep.participation_rate as number) ?? 0,
        totalVotes: (drep.total_votes as number) ?? 0,
        delegatorCount: (drep.delegator_count as number) ?? 0,
        strengths,
        alignmentSummary: `Dominant: ${getDimensionLabel(dominant)}`,
        momentum: (drep.score_momentum as number) ?? 0,
      });
    } else if (entityType === 'spo') {
      const { data: pool } = await supabase
        .from('pools')
        .select('*')
        .eq('pool_id', entityId)
        .single();

      if (!pool) return NextResponse.json({ narrative: null, source: 'not_found' });

      narrative = await generateSPONarrative({
        name: (pool.ticker as string) ?? (pool.pool_name as string) ?? entityId.slice(0, 16),
        score: (pool.governance_score as number) ?? 0,
        tier: computeTier((pool.governance_score as number) ?? 0),
        participationPct: (pool.participation_pct as number) ?? 0,
        voteCount: (pool.vote_count as number) ?? 0,
        delegatorCount: (pool.delegator_count as number) ?? 0,
        liveStakeAda: (pool.live_stake_ada as number) ?? 0,
        strengths: [],
        governanceStatement: (pool.governance_statement as string) ?? null,
      });
    }

    // Cache the generated narrative
    if (narrative) {
      await cacheNarrative(entityType, entityId, narrative);
    }

    return NextResponse.json({
      narrative,
      source: narrative ? 'generated' : 'unavailable',
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[Spotlight Narrative] Error', { error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
