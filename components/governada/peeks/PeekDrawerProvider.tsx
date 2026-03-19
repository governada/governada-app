'use client';

/**
 * PeekDrawerProvider — context provider for peek drawer state.
 *
 * Wraps list pages so any entity card can open the peek drawer.
 * Feature-gated behind `peek_drawer` flag.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { usePeekDrawer, type UsePeekDrawerReturn, type PeekEntity } from '@/hooks/usePeekDrawer';
import { useFeatureFlag } from '@/components/FeatureGate';
import { PeekDrawer } from '@/components/governada/PeekDrawer';
import { PeekContent } from './PeekContent';

const PeekDrawerContext = createContext<UsePeekDrawerReturn | null>(null);

export function usePeekDrawerContext(): UsePeekDrawerReturn | null {
  return useContext(PeekDrawerContext);
}

/**
 * Convenience hook that returns a function to open peek for an entity.
 * Returns null if peek drawer is not available (flag off or no provider).
 */
export function usePeekTrigger(): ((entity: PeekEntity) => void) | null {
  const ctx = useContext(PeekDrawerContext);
  if (!ctx) return null;
  return ctx.open;
}

interface PeekDrawerProviderProps {
  children: ReactNode;
}

export function PeekDrawerProvider({ children }: PeekDrawerProviderProps) {
  const peekEnabled = useFeatureFlag('peek_drawer');
  const drawer = usePeekDrawer();

  // If flag is loading or disabled, just render children without drawer
  if (peekEnabled === null || !peekEnabled) {
    return <>{children}</>;
  }

  return (
    <PeekDrawerContext.Provider value={drawer}>
      {children}
      <PeekDrawer
        isOpen={drawer.isOpen}
        onClose={drawer.close}
        ariaLabel={drawer.entity ? `${drawer.entity.type} preview` : 'Entity preview'}
      >
        {drawer.entity && <PeekContent entity={drawer.entity} />}
      </PeekDrawer>
    </PeekDrawerContext.Provider>
  );
}
