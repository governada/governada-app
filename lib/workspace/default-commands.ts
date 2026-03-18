import {
  Home,
  Compass,
  PenTool,
  ClipboardCheck,
  PanelRightOpen,
  PanelLeftOpen,
  Search,
  HelpCircle,
} from 'lucide-react';
import { commandRegistry } from './commands';

/**
 * Register the default set of workspace commands.
 *
 * Returns an unregister function that removes all registered commands.
 * Intended to be called once at app mount from CommandProvider.
 *
 * Navigation and View commands are registered here. Context-dependent commands
 * (review, author) are registered by their respective workspace components
 * via useRegisterReviewCommands / useRegisterAuthorCommands.
 */
export function registerDefaultCommands(deps: {
  /** Next.js router.push */
  push: (url: string) => void;
  /** Toggle a panel by ID */
  togglePanel: (panel: 'agent' | 'intel' | 'notes' | 'vote') => void;
  /** Toggle the sidebar */
  toggleSidebar: () => void;
  /** Open the command palette */
  openPalette: () => void;
  /** Open the keyboard help overlay */
  openKeyboardHelp: () => void;
}): () => void {
  const unregisters: Array<() => void> = [];

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.author',
      label: 'Go to Author',
      shortcut: 'g a',
      icon: PenTool,
      section: 'navigation',
      execute: () => deps.push('/workspace/author'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.review',
      label: 'Go to Review',
      shortcut: 'g r',
      icon: ClipboardCheck,
      section: 'navigation',
      execute: () => deps.push('/workspace/review'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.home',
      label: 'Go to Home',
      shortcut: 'g h',
      icon: Home,
      section: 'navigation',
      execute: () => deps.push('/'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.governance',
      label: 'Go to Governance',
      shortcut: 'g g',
      icon: Compass,
      section: 'navigation',
      execute: () => deps.push('/governance'),
    }),
  );

  // ------------------------------------------------------------------
  // View
  // ------------------------------------------------------------------

  unregisters.push(
    commandRegistry.register({
      id: 'view.toggle-agent',
      label: 'Toggle Agent Panel',
      shortcut: 'mod+shift+c',
      icon: PanelRightOpen,
      section: 'view',
      execute: () => deps.togglePanel('agent'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'view.toggle-sidebar',
      label: 'Toggle Sidebar',
      shortcut: 'mod+b',
      icon: PanelLeftOpen,
      section: 'view',
      execute: () => deps.toggleSidebar(),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'view.command-palette',
      label: 'Open Command Palette',
      shortcut: 'mod+k',
      icon: Search,
      section: 'view',
      execute: () => deps.openPalette(),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'view.keyboard-help',
      label: 'Show Keyboard Shortcuts',
      shortcut: '?',
      icon: HelpCircle,
      section: 'view',
      execute: () => deps.openKeyboardHelp(),
    }),
  );

  return () => {
    for (const unregister of unregisters) {
      unregister();
    }
  };
}
