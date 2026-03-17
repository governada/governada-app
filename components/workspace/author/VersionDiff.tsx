'use client';

import { useMemo } from 'react';
import { computeWordDiff } from '@/lib/workspace/wordDiff';
import type { DraftContent } from '@/lib/workspace/types';

interface VersionDiffProps {
  oldVersion: { versionName: string; createdAt: string; content: DraftContent };
  newVersion: { versionName: string; createdAt: string; content: DraftContent };
}

/** Renders a word-level diff as natural prose with inline highlights. */
export function WordDiffField({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);

  if (oldText === newText) {
    return <p className="text-xs text-muted-foreground italic">No changes</p>;
  }

  return (
    <div className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'unchanged') return <span key={i}>{seg.text}</span>;
        if (seg.type === 'removed') {
          return (
            <span key={i} className="line-through text-rose-500 dark:text-rose-400">
              {seg.text}
            </span>
          );
        }
        return (
          <span
            key={i}
            className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-sm px-0.5"
          >
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

function DiffFieldSection({
  title,
  oldText,
  newText,
}: {
  title: string;
  oldText: string;
  newText: string;
}) {
  const segments = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);
  const changeCount = segments.filter((s) => s.type !== 'unchanged').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold capitalize">{title}</h4>
        {changeCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {changeCount} {changeCount === 1 ? 'change' : 'changes'}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">unchanged</span>
        )}
      </div>
      <WordDiffField oldText={oldText} newText={newText} />
    </div>
  );
}

export function VersionDiff({ oldVersion, newVersion }: VersionDiffProps) {
  const fields: { key: keyof DraftContent; title: string }[] = [
    { key: 'title', title: 'Title' },
    { key: 'abstract', title: 'Abstract' },
    { key: 'motivation', title: 'Motivation' },
    { key: 'rationale', title: 'Rationale' },
  ];

  const fieldsChanged = fields.filter(
    ({ key }) => (oldVersion.content[key] || '') !== (newVersion.content[key] || ''),
  );

  return (
    <div className="space-y-6">
      {/* Header: version names and dates */}
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
            {oldVersion.versionName}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(oldVersion.createdAt).toLocaleDateString()}
          </span>
        </div>
        <span className="text-muted-foreground">vs</span>
        <div className="flex items-center gap-2">
          <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
            {newVersion.versionName}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(newVersion.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Sections — word-level diffs */}
      {fields.map(({ key, title }) => (
        <DiffFieldSection
          key={key}
          title={title}
          oldText={String(oldVersion.content[key] || '')}
          newText={String(newVersion.content[key] || '')}
        />
      ))}

      {/* Summary */}
      {fieldsChanged.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Changed fields: {fieldsChanged.map((f) => f.title).join(', ')}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No differences found.</p>
      )}
    </div>
  );
}
