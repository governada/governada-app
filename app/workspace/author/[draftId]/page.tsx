import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { DraftEditor } from '@/components/workspace/author/DraftEditor';
import { WorkspaceV2Redirect } from './WorkspaceV2Redirect';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Draft — Governada',
  description: 'Edit your governance proposal draft.',
};

export default function DraftEditorPage() {
  return (
    <>
      <PageViewTracker event="author_draft_viewed" />
      <WorkspaceV2Redirect />
      <DraftEditor />
    </>
  );
}
