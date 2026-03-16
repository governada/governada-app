'use client';

import { VersionCompareDialog } from './VersionCompareDialog';
import type { DraftVersion } from '@/lib/workspace/types';

interface DraftActionsProps {
  versions: DraftVersion[];
  onSave?: () => void;
  onPublish?: () => void;
}

/**
 * DraftActions — action bar for the proposal authoring workspace.
 * Includes version history and comparison tools.
 */
export function DraftActions({ versions, onSave, onPublish }: DraftActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Compare Versions — only visible when 2+ versions exist */}
      {versions.length >= 2 && <VersionCompareDialog versions={versions} />}

      {onSave && (
        <button
          onClick={onSave}
          className="rounded-md border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        >
          Save Draft
        </button>
      )}

      {onPublish && (
        <button
          onClick={onPublish}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Publish
        </button>
      )}
    </div>
  );
}
