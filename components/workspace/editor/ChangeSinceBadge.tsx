'use client';

/**
 * ChangeSinceBadge — indicates which proposal sections changed since
 * the reviewer's last review. Renders as a compact left-border accent
 * with "Modified" badge above the editor for each changed field.
 */

import { useMemo } from 'react';
import { PenLine } from 'lucide-react';

export type ChangedField = 'title' | 'abstract' | 'motivation' | 'rationale';

interface ChangeSinceBadgeProps {
  changedFields: ChangedField[];
  reviewedAtVersion: number;
  currentVersion: number;
}

export function ChangeSinceBadge({
  changedFields,
  reviewedAtVersion,
  currentVersion,
}: ChangeSinceBadgeProps) {
  const label = useMemo(() => {
    if (changedFields.length === 0) return null;
    const fieldLabels = changedFields.map((f) => f.charAt(0).toUpperCase() + f.slice(1));
    if (fieldLabels.length === 1) return `${fieldLabels[0]} modified`;
    if (fieldLabels.length <= 3) return `${fieldLabels.join(', ')} modified`;
    return `${fieldLabels.length} sections modified`;
  }, [changedFields]);

  if (!label || changedFields.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 mb-3">
      <PenLine className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      <span className="text-xs text-amber-300">
        {label} since your review (v{reviewedAtVersion} {'\u2192'} v{currentVersion})
      </span>
    </div>
  );
}

/**
 * Compute which fields changed between two content snapshots.
 */
export function computeChangedFields(
  previousContent: {
    title?: string;
    abstract?: string;
    motivation?: string;
    rationale?: string;
  } | null,
  currentContent: { title?: string; abstract?: string; motivation?: string; rationale?: string },
): ChangedField[] {
  if (!previousContent) return [];
  const fields: ChangedField[] = ['title', 'abstract', 'motivation', 'rationale'];
  return fields.filter((f) => (previousContent[f] ?? '') !== (currentContent[f] ?? ''));
}
