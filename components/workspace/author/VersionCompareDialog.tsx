'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { GitCompareArrows } from 'lucide-react';
import { VersionDiff } from './VersionDiff';
import { posthog } from '@/lib/posthog';
import type { DraftVersion } from '@/lib/workspace/types';

interface VersionCompareDialogProps {
  versions: DraftVersion[];
}

export function VersionCompareDialog({ versions }: VersionCompareDialogProps) {
  const [open, setOpen] = useState(false);
  const [oldId, setOldId] = useState<string>('');
  const [newId, setNewId] = useState<string>('');

  // Default: compare the two most recent versions
  const defaultOld = versions.length >= 2 ? versions[versions.length - 2].id : '';
  const defaultNew = versions.length >= 1 ? versions[versions.length - 1].id : '';

  const selectedOld = versions.find((v) => v.id === (oldId || defaultOld));
  const selectedNew = versions.find((v) => v.id === (newId || defaultNew));

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setOldId(defaultOld);
      setNewId(defaultNew);
      posthog.capture('author_versions_compared', {
        versionCount: versions.length,
      });
    }
  };

  if (versions.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitCompareArrows className="size-4" />
          Compare Versions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare Draft Versions</DialogTitle>
        </DialogHeader>

        {/* Version Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Compare</span>
            <Select value={oldId || defaultOld} onValueChange={setOldId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.versionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">against</span>
            <Select value={newId || defaultNew} onValueChange={setNewId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.versionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Diff View */}
        {selectedOld && selectedNew ? (
          <VersionDiff oldVersion={selectedOld} newVersion={selectedNew} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Select two versions to compare.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
