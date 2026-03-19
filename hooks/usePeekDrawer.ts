'use client';

/**
 * usePeekDrawer — state management for the entity peek drawer.
 *
 * Manages open/closed state, current entity type + ID, and keyboard navigation.
 * - Space toggles peek on focused list item
 * - Escape closes the drawer
 * - Arrow keys are handled by the list pages themselves to update peek content
 */

import { useCallback, useState } from 'react';

export type PeekEntityType = 'proposal' | 'drep' | 'pool' | 'cc';

export interface PeekEntity {
  type: PeekEntityType;
  id: string;
  /** Secondary key for composite IDs (e.g., proposal index) */
  secondaryId?: string | number;
}

interface PeekDrawerState {
  isOpen: boolean;
  entity: PeekEntity | null;
}

export interface UsePeekDrawerReturn {
  isOpen: boolean;
  entity: PeekEntity | null;
  open: (entity: PeekEntity) => void;
  close: () => void;
  toggle: (entity: PeekEntity) => void;
}

export function usePeekDrawer(): UsePeekDrawerReturn {
  const [state, setState] = useState<PeekDrawerState>({
    isOpen: false,
    entity: null,
  });

  const open = useCallback((entity: PeekEntity) => {
    setState({ isOpen: true, entity });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, entity: null });
  }, []);

  const toggle = useCallback((entity: PeekEntity) => {
    setState((prev) => {
      // If same entity, close. If different or closed, open with new entity.
      if (
        prev.isOpen &&
        prev.entity?.type === entity.type &&
        prev.entity?.id === entity.id &&
        prev.entity?.secondaryId === entity.secondaryId
      ) {
        return { isOpen: false, entity: null };
      }
      return { isOpen: true, entity };
    });
  }, []);

  return {
    isOpen: state.isOpen,
    entity: state.entity,
    open,
    close,
    toggle,
  };
}
