import { getSupabaseAdmin } from '@/lib/supabase';
import { isPreviewAddress } from '@/lib/preview';
import { detectUserSegment, type UserSegment } from '@/lib/walletDetection';
import type { SessionPayload } from '@/lib/supabaseAuth';

export function getWorkspaceDestinationForSegment(
  segment: UserSegment,
): '/workspace/review' | '/workspace/author' {
  switch (segment) {
    case 'drep':
    case 'spo':
      return '/workspace/review';
    case 'anonymous':
    case 'citizen':
    case 'cc':
    default:
      return '/workspace/author';
  }
}

function getPreviewSegment(snapshot: unknown): UserSegment {
  if (!snapshot || typeof snapshot !== 'object') return 'citizen';
  const segment = (snapshot as { segment?: unknown }).segment;
  switch (segment) {
    case 'anonymous':
    case 'citizen':
    case 'spo':
    case 'drep':
    case 'cc':
      return segment;
    default:
      return 'citizen';
  }
}

async function resolveStakeAddress(walletAddress: string): Promise<string | null> {
  if (walletAddress.startsWith('stake')) return walletAddress;

  try {
    // Lazy-load Mesh to avoid bringing its heavier startup path into every route eagerly.
    const { resolveRewardAddress } = await import('@meshsdk/core');
    return resolveRewardAddress(walletAddress);
  } catch {
    return null;
  }
}

async function getPreviewDestination(
  userId: string,
): Promise<'/workspace/review' | '/workspace/author'> {
  const admin = getSupabaseAdmin();
  const { data: session } = await admin
    .from('preview_sessions')
    .select('persona_snapshot')
    .eq('user_id', userId)
    .eq('revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return getWorkspaceDestinationForSegment(getPreviewSegment(session?.persona_snapshot));
}

export async function resolveWorkspaceDestinationForSession(
  session: SessionPayload | null,
): Promise<string> {
  if (!session) return '/?connect=1&returnTo=/workspace';

  if (isPreviewAddress(session.walletAddress)) {
    return getPreviewDestination(session.userId);
  }

  const stakeAddress = await resolveStakeAddress(session.walletAddress);
  if (!stakeAddress) {
    return '/workspace/author';
  }

  const { segment } = await detectUserSegment(stakeAddress);
  return getWorkspaceDestinationForSegment(segment);
}
