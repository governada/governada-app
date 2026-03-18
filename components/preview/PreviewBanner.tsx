'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { SEGMENT_PRESETS } from '@/lib/admin/viewAsRegistry';

export function PreviewBanner() {
  const { isPreviewMode } = useSegment();
  const [personaLabel, setPersonaLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isPreviewMode) return;
    try {
      const raw = sessionStorage.getItem('governada_preview');
      if (raw) {
        const meta = JSON.parse(raw);
        const presetId = meta.personaPresetId;
        if (presetId) {
          const preset = SEGMENT_PRESETS.find((p) => p.id === presetId);
          setPersonaLabel(preset?.label ?? presetId);
        }
      }
    } catch {
      /* ignore */
    }
  }, [isPreviewMode]);

  if (!isPreviewMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-2 bg-amber-900/80 border-b border-amber-700/50 py-1.5 px-4 text-sm text-amber-200">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="font-medium">Preview Mode</span>
      {personaLabel && (
        <span className="text-amber-300/80">
          &middot; Viewing as <span className="font-medium text-amber-100">{personaLabel}</span>
        </span>
      )}
      <a href="/preview" className="text-amber-300 hover:text-amber-100 underline text-xs ml-2">
        Switch
      </a>
    </div>
  );
}
