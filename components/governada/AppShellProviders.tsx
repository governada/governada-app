'use client';

import type { ReactNode } from 'react';
import { ModeProvider } from '@/components/providers/ModeProvider';
import { ShortcutOverlay } from './ShortcutOverlay';
import { ShortcutProvider } from './ShortcutProvider';

interface AppShellProvidersProps {
  children: ReactNode;
}

/**
 * Private/app shell providers that do not need to ride on every public page.
 * Public chrome stays at the root shell; authenticated and workflow-heavy
 * routes opt into this layer via nested layouts.
 */
export function AppShellProviders({ children }: AppShellProvidersProps) {
  return (
    <ModeProvider>
      <ShortcutProvider>
        {children}
        <ShortcutOverlay />
      </ShortcutProvider>
    </ModeProvider>
  );
}
