'use client';

import { useMemo } from 'react';
import { computeStructuredDiff } from '@/lib/workspace/diff';
import type { DiffResult, DraftContent } from '@/lib/workspace/types';

interface VersionDiffProps {
  oldVersion: { versionName: string; createdAt: string; content: DraftContent };
  newVersion: { versionName: string; createdAt: string; content: DraftContent };
}

function DiffLine({ result }: { result: DiffResult }) {
  if (result.type === 'added') {
    return (
      <div className="bg-green-500/10 px-3 py-0.5 text-sm text-green-400">
        <span className="select-none text-green-600">+ </span>
        {result.text}
      </div>
    );
  }
  if (result.type === 'removed') {
    return (
      <div className="bg-red-500/10 px-3 py-0.5 text-sm text-red-400">
        <span className="select-none text-red-600">- </span>
        {result.text}
      </div>
    );
  }
  return (
    <div className="px-3 py-0.5 text-sm text-muted-foreground">
      <span className="select-none text-muted-foreground/40">&nbsp; </span>
      {result.text}
    </div>
  );
}

function DiffSection({ title, diffs }: { title: string; diffs: DiffResult[] }) {
  const changeCount = diffs.filter((d) => d.type !== 'unchanged').length;

  if (diffs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold capitalize">{title}</h4>
        {changeCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {changeCount} {changeCount === 1 ? 'change' : 'changes'}
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-border/60 bg-card font-mono text-xs">
        {diffs.map((d, i) => (
          <DiffLine key={`${title}-${i}`} result={d} />
        ))}
      </div>
    </div>
  );
}

export function VersionDiff({ oldVersion, newVersion }: VersionDiffProps) {
  const diff = useMemo(
    () => computeStructuredDiff(oldVersion.content, newVersion.content),
    [oldVersion.content, newVersion.content],
  );

  const sections: { key: keyof typeof diff; title: string }[] = [
    { key: 'title', title: 'Title' },
    { key: 'abstract', title: 'Abstract' },
    { key: 'motivation', title: 'Motivation' },
    { key: 'rationale', title: 'Rationale' },
  ];

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

      {/* Sections */}
      {sections.map(({ key, title }) => {
        const sectionDiffs = diff[key] as DiffResult[];
        return <DiffSection key={key} title={title} diffs={sectionDiffs} />;
      })}

      {/* Summary */}
      {diff.fieldsChanged.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Changed fields: {diff.fieldsChanged.join(', ')}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No differences found.</p>
      )}
    </div>
  );
}
