'use client';

/**
 * SlashCommandMenu — Slash command dropdown for the Tiptap editor.
 *
 * Appears when user types `/` at the start of a line. Shows two sections:
 * 1. Content block commands (headings, lists, quotes, etc.) — execute directly on editor
 * 2. AI commands (improve, check-constitution, etc.) — fire onSlashCommand callback
 *
 * Each content command applies a Tiptap chain directly. AI commands fire
 * an `onSlashCommand(command, sectionContext)` callback.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';
import type { SlashCommandType } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

/** Discriminated union: content commands execute on editor, AI commands fire callback */
type CommandDef =
  | {
      kind: 'content';
      id: string;
      label: string;
      description: string;
      icon: string;
      aliases: string[];
      execute: (editor: Editor) => void;
    }
  | {
      kind: 'ai';
      id: SlashCommandType;
      label: string;
      description: string;
      icon: string;
      aliases: string[];
    };

// --- Content block commands ---

const CONTENT_COMMANDS: CommandDef[] = [
  {
    kind: 'content',
    id: 'heading',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: '\uD83C\uDD77', // H boxed
    aliases: ['heading', 'h1'],
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    kind: 'content',
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: '\uD83C\uDD77', // H boxed
    aliases: ['h2'],
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    kind: 'content',
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: '\uD83C\uDD77', // H boxed
    aliases: ['h3'],
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    kind: 'content',
    id: 'bullet',
    label: 'Bullet List',
    description: 'Create a simple bulleted list',
    icon: '\u2022', // bullet
    aliases: ['bullet', 'list', 'ul'],
    execute: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    kind: 'content',
    id: 'numbered',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: '\uD83D\uDD22', // 1234
    aliases: ['numbered', 'ordered', 'ol'],
    execute: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    kind: 'content',
    id: 'todo',
    label: 'Task List',
    description: 'Checklist with toggleable items',
    icon: '\u2611', // checkbox
    aliases: ['todo', 'checklist', 'task'],
    execute: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    kind: 'content',
    id: 'quote',
    label: 'Blockquote',
    description: 'Insert a quote block',
    icon: '\u275D', // heavy quote
    aliases: ['quote', 'blockquote'],
    execute: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    kind: 'content',
    id: 'code',
    label: 'Code Block',
    description: 'Insert a code block',
    icon: '\u2329\u232A', // angle brackets
    aliases: ['code', 'codeblock'],
    execute: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    kind: 'content',
    id: 'table',
    label: 'Table',
    description: 'Insert a 3x3 table',
    icon: '\u25A6', // grid
    aliases: ['table'],
    execute: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    kind: 'content',
    id: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal rule',
    icon: '\u2015', // horizontal bar
    aliases: ['divider', 'hr', 'rule'],
    execute: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    kind: 'content',
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted note or warning block',
    icon: '\uD83D\uDCA1', // lightbulb
    aliases: ['callout', 'note', 'warning'],
    execute: (editor) =>
      editor
        .chain()
        .focus()
        .toggleBlockquote()
        .command(({ tr, dispatch }) => {
          if (dispatch) {
            tr.insertText('**Note:** ');
          }
          return true;
        })
        .run(),
  },
  {
    kind: 'content',
    id: 'image',
    label: 'Image',
    description: 'Insert an image from URL',
    icon: '\uD83D\uDDBC', // framed picture
    aliases: ['image', 'img', 'picture'],
    execute: (editor) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
];

// --- AI commands ---

const AI_COMMANDS: CommandDef[] = [
  {
    kind: 'ai',
    id: 'improve',
    label: 'Improve',
    description: 'AI improves the selected text or current section',
    icon: '\u2728', // sparkles
    aliases: ['improve'],
  },
  {
    kind: 'ai',
    id: 'check-constitution',
    label: 'Check Constitution',
    description: 'Analyze constitutional compliance of this section',
    icon: '\u2696\uFE0F', // scales
    aliases: ['check-constitution', 'constitution'],
  },
  {
    kind: 'ai',
    id: 'similar-proposals',
    label: 'Similar Proposals',
    description: 'Find precedent from past governance proposals',
    icon: '\uD83D\uDD0D', // magnifying glass
    aliases: ['similar-proposals', 'similar'],
  },
  {
    kind: 'ai',
    id: 'complete',
    label: 'Complete',
    description: 'AI suggests what is missing from this section',
    icon: '\uD83D\uDCDD', // memo
    aliases: ['complete'],
  },
  {
    kind: 'ai',
    id: 'draft',
    label: 'Draft',
    description: 'AI drafts content from your instructions',
    icon: '\u270D\uFE0F', // writing hand
    aliases: ['draft'],
  },
];

const ALL_COMMANDS: CommandDef[] = [...CONTENT_COMMANDS, ...AI_COMMANDS];

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

const slashMenuPluginKey = new PluginKey<SlashMenuState>('slashCommandMenu');

// ---------------------------------------------------------------------------
// Menu DOM rendering
// ---------------------------------------------------------------------------

function createMenuElement(
  commands: CommandDef[],
  selectedIndex: number,
  onSelect: (command: CommandDef) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'slash-command-menu fixed z-50 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1 max-h-80 overflow-y-auto';
  container.setAttribute('role', 'listbox');

  // Split into content and AI groups
  const contentItems = commands.filter((c) => c.kind === 'content');
  const aiItems = commands.filter((c) => c.kind === 'ai');

  let globalIndex = 0;

  // Content section header
  if (contentItems.length > 0) {
    const header = document.createElement('div');
    header.className =
      'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground select-none';
    header.textContent = 'Content';
    container.appendChild(header);

    for (const cmd of contentItems) {
      container.appendChild(createCommandItem(cmd, globalIndex, selectedIndex, onSelect));
      globalIndex++;
    }
  }

  // Separator + AI section header
  if (aiItems.length > 0) {
    if (contentItems.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'mx-2 my-1 border-t border-border/50';
      container.appendChild(separator);
    }

    const header = document.createElement('div');
    header.className =
      'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground select-none';
    header.textContent = 'AI';
    container.appendChild(header);

    for (const cmd of aiItems) {
      container.appendChild(createCommandItem(cmd, globalIndex, selectedIndex, onSelect));
      globalIndex++;
    }
  }

  return container;
}

function createCommandItem(
  cmd: CommandDef,
  index: number,
  selectedIndex: number,
  onSelect: (command: CommandDef) => void,
): HTMLElement {
  const item = document.createElement('div');
  item.className = `slash-command-item flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${
    index === selectedIndex
      ? 'bg-accent text-accent-foreground'
      : 'text-foreground hover:bg-accent/50'
  }`;
  item.setAttribute('role', 'option');
  item.setAttribute('aria-selected', String(index === selectedIndex));
  item.dataset.index = String(index);

  const iconSpan = document.createElement('span');
  iconSpan.className = 'text-base flex-shrink-0 w-5 text-center';
  iconSpan.textContent = cmd.icon;

  const textContainer = document.createElement('div');
  textContainer.className = 'flex flex-col min-w-0';

  const label = document.createElement('span');
  label.className = 'font-medium text-[13px] leading-tight';
  // Show the first alias as the slash label
  const slashLabel = cmd.kind === 'ai' ? cmd.id : cmd.aliases[0] || cmd.id;
  label.textContent = `/${slashLabel}`;

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
    onSelect(cmd);
  });

  return item;
}

// ---------------------------------------------------------------------------
// Helper: get current section context from cursor position
// ---------------------------------------------------------------------------

function getSectionContext(view: EditorView): string {
  const { state } = view;
  const { $from } = state.selection;

  // Walk up from cursor to find the sectionBlock
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'sectionBlock') {
      return node.attrs.field as string;
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface SlashCommandMenuOptions {
  /** Called when an AI slash command is selected */
  onSlashCommand?: (command: SlashCommandType, sectionContext: string) => void;
}

export const SlashCommandMenu = Extension.create<SlashCommandMenuOptions>({
  name: 'slashCommandMenu',

  addOptions() {
    return {
      onSlashCommand: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;
        const filtered = filterCommands(state.query);
        const newIndex = (state.selectedIndex - 1 + filtered.length) % filtered.length;
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, {
            type: 'updateIndex',
            index: newIndex,
          }),
        );
        return true;
      },
      ArrowDown: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;
        const filtered = filterCommands(state.query);
        const newIndex = (state.selectedIndex + 1) % filtered.length;
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, {
            type: 'updateIndex',
            index: newIndex,
          }),
        );
        return true;
      },
      Enter: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
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
          this.editor.state.tr.setMeta(slashMenuPluginKey, { type: 'close' }),
        );

        // Execute the command
        if (selected.kind === 'content') {
          selected.execute(this.editor);
        } else {
          const section = getSectionContext(this.editor.view);
          this.options.onSlashCommand?.(selected.id, section);
        }
        return true;
      },
      Escape: () => {
        const state = slashMenuPluginKey.getState(this.editor.state);
        if (!state?.active) return false;
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(slashMenuPluginKey, { type: 'close' }),
        );
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;
    const editorInstance = this.editor;
    let menuElement: HTMLElement | null = null;

    return [
      new Plugin<SlashMenuState>({
        key: slashMenuPluginKey,

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
            const meta = tr.getMeta(slashMenuPluginKey) as
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

            // Check if we should open or update the slash menu
            if (tr.docChanged || tr.selectionSet) {
              const { $from } = newState.selection;
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

              // Check for slash at start of line (or after only whitespace)
              const slashMatch = textBefore.match(/(?:^|\s)\/([a-z0-9-]*)$/);

              if (slashMatch) {
                const query = slashMatch[1];
                const filtered = filterCommands(query);

                if (filtered.length > 0) {
                  // Calculate the trigger position (the `/` character)
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

              // Close menu if the slash pattern broke
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
              const state = slashMenuPluginKey.getState(view.state);

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

              // Remove old menu
              if (menuElement) {
                menuElement.remove();
              }

              // Create new menu
              menuElement = createMenuElement(filtered, state.selectedIndex, (cmd) => {
                // Remove the slash text
                if (state.triggerPos !== null) {
                  const from = state.triggerPos;
                  const to = view.state.selection.from;

                  const tr = view.state.tr
                    .delete(from, to)
                    .setMeta(slashMenuPluginKey, { type: 'close' });
                  view.dispatch(tr);
                }

                // Execute the command
                if (cmd.kind === 'content') {
                  cmd.execute(editorInstance);
                } else {
                  const section = getSectionContext(view);
                  extensionOptions.onSlashCommand?.(cmd.id, section);
                }
              });

              // Position the menu below the cursor
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterCommands(query: string): CommandDef[] {
  if (!query) return ALL_COMMANDS;
  const lower = query.toLowerCase();
  return ALL_COMMANDS.filter(
    (cmd) =>
      cmd.id.includes(lower) ||
      cmd.label.toLowerCase().includes(lower) ||
      cmd.aliases.some((alias) => alias.includes(lower)),
  );
}
