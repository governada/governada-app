'use client';

import { useEffect, useCallback, useState } from 'react';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface UseGlobeKeyboardNavOptions {
  enabled: boolean;
  onEntityFocus?: (node: ConstellationNode3D) => void;
  onEntityAction?: (node: ConstellationNode3D) => void;
  onEscape?: () => void;
}

export function useGlobeKeyboardNav(options: UseGlobeKeyboardNavOptions): {
  focusedNodeId: string | null;
} {
  const { enabled, onEntityAction, onEscape } = options;
  const [focusedNodeId] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'Escape':
          onEscape?.();
          break;

        case 'b':
        case 'B':
          window.dispatchEvent(new CustomEvent('openSeneca'));
          break;

        case '?':
          // TODO: show keyboard shortcuts overlay
          break;

        case 'Enter':
          if (focusedNodeId) {
            // Tab-cycling will populate focusedNodeId in a future iteration
            onEntityAction?.(undefined as unknown as ConstellationNode3D);
          }
          break;
      }
    },
    [focusedNodeId, onEntityAction, onEscape],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return { focusedNodeId };
}
