import {
  Home,
  Compass,
  PenTool,
  ClipboardCheck,
  PanelRightOpen,
  PanelLeftOpen,
  Search,
  HelpCircle,
  FileText,
  Users,
  Wallet,
  Shield,
  Activity,
  User,
  Wrench,
  Settings,
  PanelRight,
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
  togglePanel: (panel: 'agent' | 'intel' | 'notes' | 'vote' | 'readiness') => void;
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
      shortcut: 'g v',
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

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.proposals',
      label: 'Go to Proposals',
      shortcut: 'g p',
      icon: FileText,
      section: 'navigation',
      execute: () => deps.push('/governance/proposals'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.representatives',
      label: 'Go to Representatives',
      shortcut: 'g r',
      icon: Users,
      section: 'navigation',
      execute: () => deps.push('/governance/representatives'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.treasury',
      label: 'Go to Treasury',
      shortcut: 'g t',
      icon: Wallet,
      section: 'navigation',
      execute: () => deps.push('/governance/treasury'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.committee',
      label: 'Go to Committee',
      shortcut: 'g c',
      icon: Shield,
      section: 'navigation',
      execute: () => deps.push('/governance/committee'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.health',
      label: 'Go to Governance Health',
      shortcut: 'g e',
      icon: Activity,
      section: 'navigation',
      execute: () => deps.push('/governance/health'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.you',
      label: 'Go to You',
      shortcut: 'g y',
      icon: User,
      section: 'navigation',
      execute: () => deps.push('/you'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.match',
      label: 'Go to Match',
      shortcut: 'g m',
      icon: Compass,
      section: 'navigation',
      execute: () => deps.push('/match'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.workspace',
      label: 'Go to Workspace',
      shortcut: 'g w',
      icon: Wrench,
      section: 'navigation',
      execute: () => deps.push('/workspace'),
    }),
  );

  unregisters.push(
    commandRegistry.register({
      id: 'navigate.settings',
      label: 'Go to Settings',
      shortcut: 'g s',
      icon: Settings,
      section: 'navigation',
      execute: () => deps.push('/you/settings'),
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

  unregisters.push(
    commandRegistry.register({
      id: 'view.toggle-intel-panel',
      label: 'Toggle Intelligence Panel',
      shortcut: ']',
      icon: PanelRight,
      section: 'view',
      execute: () => window.dispatchEvent(new CustomEvent('toggleIntelPanel')),
    }),
  );

  return () => {
    for (const unregister of unregisters) {
      unregister();
    }
  };
}
