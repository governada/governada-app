'use client';

import { useWallet } from '@/utils/wallet';
import { PoolProfileEditor } from './PoolProfileEditor';

interface PoolProfileEditorGateProps {
  poolId: string;
  claimedBy: string | null;
  governanceStatement: string | null;
  socialLinks: Array<{ uri: string; label?: string }>;
}

/**
 * Client-side gate that only renders the profile editor
 * when the connected wallet matches the pool claimer.
 */
export function PoolProfileEditorGate({
  poolId,
  claimedBy,
  governanceStatement,
  socialLinks,
}: PoolProfileEditorGateProps) {
  const { connected, address } = useWallet();

  if (!claimedBy || !connected || address !== claimedBy) return null;

  return (
    <PoolProfileEditor
      poolId={poolId}
      walletAddress={address}
      initialStatement={governanceStatement}
      initialSocialLinks={socialLinks}
    />
  );
}
