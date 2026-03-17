'use client';

/**
 * Redirects to the new workspace editor when governance_workspace_v2 flag is on.
 * Renders nothing if the flag is off — the old DraftEditor shows as usual.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFeatureFlag } from '@/components/FeatureGate';

export function WorkspaceV2Redirect() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const v2Enabled = useFeatureFlag('governance_workspace_v2');

  useEffect(() => {
    if (v2Enabled === true && draftId) {
      router.replace(`/workspace/editor/${draftId}`);
    }
  }, [v2Enabled, draftId, router]);

  return null;
}
