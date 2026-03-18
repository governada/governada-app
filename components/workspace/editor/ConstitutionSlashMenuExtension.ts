/**
 * ConstitutionSlashMenuExtension — Tiptap Extension for constitution-specific slash commands.
 *
 * Follows the same ProseMirror plugin pattern as SlashCommandMenu.tsx but uses
 * CONSTITUTION_COMMANDS instead of the proposal-specific COMMANDS array.
 *
 * The extension detects `/` typed at the start of a line, shows a dropdown
 * with constitution-specific commands, and fires onSlashCommand when selected.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { CONSTITUTION_COMMANDS, type ConstitutionCommandDef } from './ConstitutionSlashCommands';

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

interface SlashMenuState {
  active: boolean;
  query: string;
  selectedIndex: number;
  triggerPos: number | null;
  decorationSet: DecorationSet;
}

const constitutionSlashMenuPluginKey = new PluginKey<SlashMenuState>('constitutionSlashMenu');

// ---------------------------------------------------------------------------
// Menu DOM rendering
// ---------------------------------------------------------------------------

function createMenuElement(
  commands: ConstitutionCommandDef[],
  selectedIndex: number,
  onSelect: (commandId: string) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'slash-command-menu fixed z-50 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1';
  container.setAttribute('role', 'listbox');

  commands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = `slash-command-item flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${
      index === selectedIndex
        ? 'bg-accent text-accent-foreground'
        : 'text-foreground hover:bg-accent/50'
    }`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(index === selectedIndex));

    const iconSpan = document.createElement('span');
    iconSpan.className = 'text-base flex-shrink-0';
    iconSpan.textContent = cmd.icon;

    const textContainer = document.createElement('div');
    textContainer.className = 'flex flex-col min-w-0';

    const label = document.createElement('span');
    label.className = 'font-medium text-[13px] leading-tight';
    label.textContent = `/${cmd.id}`;

    const desc = document.createElement('span');
    desc.className = 'text-[11px] text-muted-foreground leading-tight truncate';
    desc.textContent = cmd.description;

    textContainer.appendChild(label);
    textContainer.appendChild(desc);
    item.appendChild(iconSpan);
    item.appendChild(textContainer);

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(cmd.id);
    });

    container.appendChild(item);
  });

  return container;
}

// ---------------------------------------------------------------------------
// Helper: get current section context from cursor position
// ---------------------------------------------------------------------------

function getSectionContext(view: EditorView): string {
  const { state } = view;
  const { $from } = state.selection;

  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'constitutionSection') {
      return node.attrs.field as string;
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Filter commands by query
// ---------------------------------------------------------------------------

function filterCommands(query: string): ConstitutionCommandDef[] {
  if (!query) return CONSTITUTION_COMMANDS;
  const lower = query.toLowerCase();
  return CONSTITUTION_COMMANDS.filter(
    (cmd) => cmd.id.includes(lower) || cmd.label.toLowerCase().includes(lower),
  );
}

// ---------------------------------------------------------------------------
// Extension options
// ---------------------------------------------------------------------------

export interface ConstitutionSlashMenuOptions {
  onSlashCommand?: (command: string, sectionContext: string) => void;
}

// ---------------------------------------------------------------------------
// Factory function (used by ConstitutionEditor)
// ---------------------------------------------------------------------------

export function createConstitutionSlashMenu(
  options: ConstitutionSlashMenuOptions,
): Extension<ConstitutionSlashMenuOptions> {
  return Extension.create<ConstitutionSlashMenuOptions>({
    name: 'constitutionSlashMenu',

    addOptions() {
      return {
        onSlashCommand: options.onSlashCommand,
      };
    },

    addKeyboardShortcuts() {
      return {
        ArrowUp: () => {
          const state = constitutionSlashMenuPluginKey.getState(this.editor.state);
          if (!state?.active) return false;
          const filtered = filterCommands(state.query);
          const newIndex = (state.selectedIndex - 1 + filtered.length) % filtered.length;
          this.editor.view.dispatch(
            this.editor.state.tr.setMeta(constitutionSlashMenuPluginKey, {
              type: 'updateIndex',
              index: newIndex,
            }),
          );
          return true;
        },
        ArrowDown: () => {
          const state = constitutionSlashMenuPluginKey.getState(this.editor.state);
          if (!state?.active) return false;
          const filtered = filterCommands(state.query);
          const newIndex = (state.selectedIndex + 1) % filtered.length;
          this.editor.view.dispatch(
            this.editor.state.tr.setMeta(constitutionSlashMenuPluginKey, {
              type: 'updateIndex',
              index: newIndex,
            }),
          );
          return true;
        },
        Enter: () => {
          const state = constitutionSlashMenuPluginKey.getState(this.editor.state);
          if (!state?.active) return false;

          const filtered = filterCommands(state.query);
          const selected = filtered[state.selectedIndex];
          if (!selected) return false;

          // Remove the slash and query text
          if (state.triggerPos !== null) {
            const from = state.triggerPos;
            const to = this.editor.state.selection.from;
            this.editor
              .chain()
              .focus()
              .command(({ tr }) => {
                tr.delete(from, to);
                return true;
              })
              .run();
          }

          // Close the menu
          this.editor.view.dispatch(
            this.editor.state.tr.setMeta(constitutionSlashMenuPluginKey, { type: 'close' }),
          );

          // Fire the callback
          const section = getSectionContext(this.editor.view);
          this.options.onSlashCommand?.(selected.id, section);
          return true;
        },
        Escape: () => {
          const state = constitutionSlashMenuPluginKey.getState(this.editor.state);
          if (!state?.active) return false;
          this.editor.view.dispatch(
            this.editor.state.tr.setMeta(constitutionSlashMenuPluginKey, { type: 'close' }),
          );
          return true;
        },
      };
    },

    addProseMirrorPlugins() {
      const extensionOptions = this.options;
      let menuElement: HTMLElement | null = null;

      return [
        new Plugin<SlashMenuState>({
          key: constitutionSlashMenuPluginKey,

          state: {
            init(): SlashMenuState {
              return {
                active: false,
                query: '',
                selectedIndex: 0,
                triggerPos: null,
                decorationSet: DecorationSet.empty,
              };
            },

            apply(tr, value, _oldState, newState): SlashMenuState {
              const meta = tr.getMeta(constitutionSlashMenuPluginKey) as
                | { type: string; index?: number }
                | undefined;

              if (meta?.type === 'close') {
                return {
                  active: false,
                  query: '',
                  selectedIndex: 0,
                  triggerPos: null,
                  decorationSet: DecorationSet.empty,
                };
              }

              if (meta?.type === 'updateIndex') {
                return { ...value, selectedIndex: meta.index ?? 0 };
              }

              if (tr.docChanged || tr.selectionSet) {
                const { $from } = newState.selection;
                const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
                const slashMatch = textBefore.match(/(?:^|\s)\/([a-z-]*)$/);

                if (slashMatch) {
                  const query = slashMatch[1];
                  const filtered = filterCommands(query);

                  if (filtered.length > 0) {
                    const triggerOffset = textBefore.lastIndexOf('/');
                    const triggerPos = $from.start() + triggerOffset;

                    return {
                      active: true,
                      query,
                      selectedIndex: Math.min(value.selectedIndex, filtered.length - 1),
                      triggerPos,
                      decorationSet: DecorationSet.empty,
                    };
                  }
                }

                if (value.active) {
                  return {
                    active: false,
                    query: '',
                    selectedIndex: 0,
                    triggerPos: null,
                    decorationSet: DecorationSet.empty,
                  };
                }
              }

              return value;
            },
          },

          view() {
            return {
              update(view) {
                const state = constitutionSlashMenuPluginKey.getState(view.state);

                if (!state?.active) {
                  if (menuElement) {
                    menuElement.remove();
                    menuElement = null;
                  }
                  return;
                }

                const filtered = filterCommands(state.query);
                if (filtered.length === 0) {
                  if (menuElement) {
                    menuElement.remove();
                    menuElement = null;
                  }
                  return;
                }

                if (menuElement) {
                  menuElement.remove();
                }

                menuElement = createMenuElement(filtered, state.selectedIndex, (commandId) => {
                  if (state.triggerPos !== null) {
                    const from = state.triggerPos;
                    const to = view.state.selection.from;
                    const tr = view.state.tr
                      .delete(from, to)
                      .setMeta(constitutionSlashMenuPluginKey, { type: 'close' });
                    view.dispatch(tr);
                  }

                  const section = getSectionContext(view);
                  extensionOptions.onSlashCommand?.(commandId, section);
                });

                const coords = view.coordsAtPos(view.state.selection.from);
                menuElement.style.top = `${coords.bottom + 4}px`;
                menuElement.style.left = `${Math.max(8, coords.left - 20)}px`;

                document.body.appendChild(menuElement);
              },

              destroy() {
                if (menuElement) {
                  menuElement.remove();
                  menuElement = null;
                }
              },
            };
          },
        }),
      ];
    },
  });
}
