'use client';

export const dynamic = 'force-dynamic';

/**
 * Draft Editor Page — now renders the Tiptap workspace directly.
 * The old form-based DraftEditor has been replaced.
 */

import WorkspaceEditorRoute from '@/app/workspace/editor/[draftId]/page';

export default function DraftEditorPage() {
  return <WorkspaceEditorRoute />;
}
