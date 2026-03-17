'use client';

/**
 * WorkspaceToolbar — top bar with mode switcher, version selector, and nav.
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { EditorMode } from '@/lib/workspace/editor/types';

interface WorkspaceToolbarProps {
  title: string;
  proposalType: string;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  versions?: Array<{ versionNumber: number; versionName: string }>;
  selectedVersion?: number;
  onVersionChange?: (version: number) => void;
  compareVersion?: number;
  onCompareVersionChange?: (version: number) => void;
}

const MODE_LABELS: Record<EditorMode, string> = {
  edit: 'Edit',
  review: 'Review',
  diff: 'Diff',
};

export function WorkspaceToolbar({
  title,
  proposalType,
  mode,
  onModeChange,
  versions,
  selectedVersion,
  onVersionChange,
  compareVersion,
  onCompareVersionChange,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {/* Back */}
      <Link href="/workspace/author" className="shrink-0">
        <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
      </Link>

      {/* Title + type */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h1 className="text-sm font-semibold truncate">{title || 'Untitled Proposal'}</h1>
        <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 shrink-0">
          {proposalType}
        </span>
      </div>

      {/* Mode switcher */}
      <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
        {(['edit', 'review', 'diff'] as EditorMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-3 py-1 text-[11px] font-medium rounded-sm transition-colors ${
              mode === m
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Version selector (in diff mode) */}
      {mode === 'diff' && versions && versions.length > 1 && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <select
            value={compareVersion ?? versions[versions.length - 2]?.versionNumber}
            onChange={(e) => onCompareVersionChange?.(Number(e.target.value))}
            className="h-7 rounded border border-border bg-background px-2 text-[11px]"
          >
            {versions.map((v) => (
              <option key={v.versionNumber} value={v.versionNumber}>
                {v.versionName}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">→</span>
          <select
            value={selectedVersion ?? versions[versions.length - 1]?.versionNumber}
            onChange={(e) => onVersionChange?.(Number(e.target.value))}
            className="h-7 rounded border border-border bg-background px-2 text-[11px]"
          >
            {versions.map((v) => (
              <option key={v.versionNumber} value={v.versionNumber}>
                {v.versionName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
