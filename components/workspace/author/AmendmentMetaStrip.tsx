'use client';

/**
 * AmendmentMetaStrip — Top metadata strip for the amendment editor page.
 *
 * Shows constitution version, change counts, and amendment status
 * in a compact horizontal strip above the editor.
 */

import { FileText, GitBranch, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AmendmentMetaStripProps {
  constitutionVersion: string;
  changeCount: number;
  status: string;
  acceptedCount: number;
  rejectedCount: number;
}

export function AmendmentMetaStrip({
  constitutionVersion,
  changeCount,
  status,
  acceptedCount,
  rejectedCount,
}: AmendmentMetaStripProps) {
  return (
    <div className="flex items-center gap-3 px-1 py-2 text-xs text-muted-foreground">
      {/* Constitution version */}
      <span className="flex items-center gap-1.5">
        <FileText className="h-3 w-3" />
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
          {constitutionVersion}
        </Badge>
      </span>

      <span className="w-px h-3.5 bg-border" />

      {/* Change count */}
      <span className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3" />
        <span>
          {changeCount} change{changeCount !== 1 ? 's' : ''}
        </span>
      </span>

      {/* Accepted / Rejected counts (only if non-zero) */}
      {acceptedCount > 0 && (
        <span className="flex items-center gap-1 text-emerald-400">
          <Check className="h-3 w-3" />
          {acceptedCount}
        </span>
      )}
      {rejectedCount > 0 && (
        <span className="flex items-center gap-1 text-amber-400">
          <X className="h-3 w-3" />
          {rejectedCount}
        </span>
      )}

      <span className="w-px h-3.5 bg-border" />

      {/* Status */}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
        {status.replace(/_/g, ' ')}
      </Badge>
    </div>
  );
}
