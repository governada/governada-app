import { type ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandSection = 'navigation' | 'actions' | 'ai' | 'view';

export interface Command {
  /** Unique identifier, e.g. 'navigate.author', 'view.toggle-agent' */
  id: string;
  /** Human-readable label, e.g. 'Go to Author' */
  label: string;
  /** Shortcut string, e.g. 'g a', 'mod+shift+c', '?' */
  shortcut?: string;
  /** Optional Lucide icon component */
  icon?: ComponentType<{ className?: string }>;
  /** Section for grouping in palette / help overlay */
  section: CommandSection;
  /** Context predicate — command only shows/executes when this returns true */
  when?: () => boolean;
  /** Execute the command */
  execute: () => void;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class CommandRegistryImpl {
  private commands = new Map<string, Command>();
  private listeners = new Set<() => void>();

  register(command: Command): () => void {
    this.commands.set(command.id, command);
    this.notify();
    return () => {
      this.commands.delete(command.id);
      this.notify();
    };
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getBySection(section: Command['section']): Command[] {
    return this.getAll().filter((c) => c.section === section);
  }

  /** Get all commands whose `when` predicate passes (or have no predicate). */
  getAvailable(): Command[] {
    return this.getAll().filter((c) => !c.when || c.when());
  }

  execute(id: string): boolean {
    const cmd = this.commands.get(id);
    if (cmd && (!cmd.when || cmd.when())) {
      cmd.execute();
      return true;
    }
    return false;
  }

  /** Subscribe to registry changes (for React hooks). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Get a snapshot for useSyncExternalStore. */
  getSnapshot(): Map<string, Command> {
    return this.commands;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const commandRegistry = new CommandRegistryImpl();
