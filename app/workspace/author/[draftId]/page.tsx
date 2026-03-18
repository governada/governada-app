'use client';

export const dynamic = 'force-dynamic';

/**
 * Draft Editor Page — routes to the appropriate editor based on proposal type.
 *
 * NewConstitution drafts are redirected to the amendment editor when the
 * `author_constitution_editor` feature flag is enabled.
 * All other types render the standard Tiptap workspace.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDraft } from '@/hooks/useDrafts';
import { useFeatureFlag } from '@/components/FeatureGate';
import WorkspaceEditorRoute from '@/app/workspace/editor/[draftId]/page';

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const { data, isLoading } = useDraft(draftId);
  const constitutionEditorFlag = useFeatureFlag('author_constitution_editor');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading || constitutionEditorFlag === null) return;

    const draft = data?.draft;
    if (draft?.proposalType === 'NewConstitution' && constitutionEditorFlag) {
      router.replace(`/workspace/amendment/${draftId}`);
      return;
    }

    setChecked(true);
  }, [data, isLoading, constitutionEditorFlag, draftId, router]);

  // While checking, show nothing (avoids flash)
  if (!checked) return null;

  return <WorkspaceEditorRoute />;
}
