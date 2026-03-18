'use client';

/**
 * CommandProvider — wires the command registry, keyboard engine, palette, and help overlay.
 *
 * Placed in the root layout so commands work from anywhere in the app.
 * Registers default commands on mount, attaches the keyboard engine,
 * and renders the command palette + keyboard help modals.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { createKeyboardEngine } from '@/lib/workspace/keyboard';
import { commandRegistry } from '@/lib/workspace/commands';
import { registerDefaultCommands } from '@/lib/workspace/default-commands';
import { WorkspaceCommandPalette } from '@/components/ui/command-palette';
import { KeyboardHelpOverlay } from '@/components/ui/keyboard-help';

export function CommandProvider() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();

  // Register default commands
  useEffect(() => {
    const store = useWorkspaceStore.getState();

    const unregister = registerDefaultCommands({
      push: (url: string) => router.push(url),
      togglePanel: (panel) => store.togglePanel(panel),
      toggleSidebar: () => store.toggleSidebar(),
      openPalette: () => setPaletteOpen(true),
      openKeyboardHelp: () => setHelpOpen((prev) => !prev),
    });

    return unregister;
  }, [router]);

  // Attach keyboard engine
  useEffect(() => {
    const engine = createKeyboardEngine(commandRegistry);
    const detach = engine.attach();
    return detach;
  }, []);

  // Listen for legacy 'openShortcutsHelp' custom event (from old code paths)
  useEffect(() => {
    const handler = () => setHelpOpen(true);
    window.addEventListener('openShortcutsHelp', handler);
    return () => window.removeEventListener('openShortcutsHelp', handler);
  }, []);

  const handlePaletteChange = useCallback((open: boolean) => {
    setPaletteOpen(open);
  }, []);

  const handleHelpChange = useCallback((open: boolean) => {
    setHelpOpen(open);
  }, []);

  return (
    <>
      <WorkspaceCommandPalette open={paletteOpen} onOpenChange={handlePaletteChange} />
      <KeyboardHelpOverlay open={helpOpen} onOpenChange={handleHelpChange} />
    </>
  );
}
