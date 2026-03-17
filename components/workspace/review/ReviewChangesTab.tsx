'use client';

/**
 * ReviewChangesTab — sidebar tab showing word-level diffs between draft versions.
 *
 * Available for pre-submission drafts that have version history.
 * Allows reviewers to see exactly what changed between revisions.
 */

import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText } from 'lucide-react';
import { useDraft } from '@/hooks/useDrafts';
import { WordDiffField } from '../author/VersionDiff';

interface ReviewChangesTabProps {
  draftId: string;
}

const FIELDS = [
  { key: 'title' as const, label: 'Title' },
  { key: 'abstract' as const, label: 'Abstract' },
  { key: 'motivation' as const, label: 'Motivation' },
  { key: 'rationale' as const, label: 'Rationale' },
];

export function ReviewChangesTab({ draftId }: ReviewChangesTabProps) {
  const { data } = useDraft(draftId);
  const versions = data?.versions ?? [];

  const [oldId, setOldId] = useState<string>('');
  const [newId, setNewId] = useState<string>('');

  const defaultOld = versions.length >= 2 ? versions[versions.length - 2].id : '';
  const defaultNew = versions.length >= 1 ? versions[versions.length - 1].id : '';

  const selectedOld = versions.find((v) => v.id === (oldId || defaultOld));
  const selectedNew = versions.find((v) => v.id === (newId || defaultNew));

  const fieldsChanged = useMemo(() => {
    if (!selectedOld || !selectedNew) return [];
    return FIELDS.filter(
      ({ key }) => (selectedOld.content[key] || '') !== (selectedNew.content[key] || ''),
    );
  }, [selectedOld, selectedNew]);

  if (versions.length < 2) {
    return (
      <div className="p-3 text-center">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">
          No version history yet. Changes will appear here after the author saves named versions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {/* Compact version selectors */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12 shrink-0">From</span>
          <Select value={oldId || defaultOld} onValueChange={setOldId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.versionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12 shrink-0">To</span>
          <Select value={newId || defaultNew} onValueChange={setNewId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.versionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      {fieldsChanged.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Changed: {fieldsChanged.map((f) => f.label).join(', ')}
        </p>
      ) : (
        selectedOld &&
        selectedNew && <p className="text-[10px] text-muted-foreground">No differences</p>
      )}

      {/* Per-field word-level diffs */}
      {selectedOld && selectedNew && (
        <div className="space-y-3">
          {FIELDS.map(({ key, label }) => {
            const oldText = String(selectedOld.content[key] || '');
            const newText = String(selectedNew.content[key] || '');
            if (oldText === newText) return null;
            return (
              <div key={key} className="space-y-1">
                <h4 className="text-[11px] font-semibold">{label}</h4>
                <WordDiffField oldText={oldText} newText={newText} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
