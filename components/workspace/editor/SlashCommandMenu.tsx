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
// SVG icon helper (Lucide-style inline SVGs for DOM rendering)
// ---------------------------------------------------------------------------

function createSvgIcon(paths: string[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of paths) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Lucide icon paths
// ---------------------------------------------------------------------------

const ICON_HEADING: string[] = ['M4 12h8', 'M4 18V6', 'M12 18V6', 'M17 12l3-2v8'];
const ICON_LIST: string[] = [
  'M8 6h13',
  'M8 12h13',
  'M8 18h13',
  'M3 6h.01',
  'M3 12h.01',
  'M3 18h.01',
];
const ICON_LIST_ORDERED: string[] = [
  'M10 6h11',
  'M10 12h11',
  'M10 18h11',
  'M4 6h1v4',
  'M4 10h2',
  'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
];
const ICON_CHECK_SQUARE: string[] = [
  'M9 11l3 3L22 4',
  'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
];
const ICON_QUOTE: string[] = [
  'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z',
  'M17 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z',
];
const ICON_CODE: string[] = ['m18 16 4-4-4-4', 'M6 8l-4 4 4 4', 'M14.5 4l-5 16'];
const ICON_TABLE: string[] = [
  'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
];
const ICON_MINUS: string[] = ['M5 12h14'];
const ICON_LIGHTBULB: string[] = [
  'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
  'M9 18h6',
  'M10 22h4',
];
const ICON_IMAGE: string[] = [
  'M21 3.6v16.8a.6.6 0 0 1-.6.6H3.6a.6.6 0 0 1-.6-.6V3.6a.6.6 0 0 1 .6-.6h16.8a.6.6 0 0 1 .6.6z',
  'M3 16l5-7 4.5 6 3.5-4 5 5',
  'M16 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
];
const ICON_SPARKLES: string[] = [
  'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z',
  'M5 3v4',
  'M19 17v4',
  'M3 5h4',
  'M17 19h4',
];
const ICON_SCALE: string[] = [
  'm16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
  'M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
  'M7 21h10',
  'M12 3v18',
  'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2',
];
const ICON_SEARCH: string[] = ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'M21 21l-4.35-4.35'];
const ICON_FILE_TEXT: string[] = [
  'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
  'M14 2v4a2 2 0 0 0 2 2h4',
  'M10 9H8',
  'M16 13H8',
  'M16 17H8',
];
const ICON_PEN_LINE: string[] = ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'];

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
      icon: string[];
      aliases: string[];
      execute: (editor: Editor) => void;
    }
  | {
      kind: 'ai';
      id: SlashCommandType;
      label: string;
      description: string;
      icon: string[];
      aliases: string[];
    };

// --- Content block commands ---

const CONTENT_COMMANDS: CommandDef[] = [
  {
    kind: 'content',
    id: 'heading',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: ICON_HEADING,
    aliases: ['heading', 'h1'],
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    kind: 'content',
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: ICON_HEADING,
    aliases: ['h2'],
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    kind: 'content',
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: ICON_HEADING,
    aliases: ['h3'],
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    kind: 'content',
    id: 'bullet',
    label: 'Bullet List',
    description: 'Create a simple bulleted list',
    icon: ICON_LIST,
    aliases: ['bullet', 'list', 'ul'],
    execute: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    kind: 'content',
    id: 'numbered',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: ICON_LIST_ORDERED,
    aliases: ['numbered', 'ordered', 'ol'],
    execute: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    kind: 'content',
    id: 'todo',
    label: 'Task List',
    description: 'Checklist with toggleable items',
    icon: ICON_CHECK_SQUARE,
    aliases: ['todo', 'checklist', 'task'],
    execute: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    kind: 'content',
    id: 'quote',
    label: 'Blockquote',
    description: 'Insert a quote block',
    icon: ICON_QUOTE,
    aliases: ['quote', 'blockquote'],
    execute: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    kind: 'content',
    id: 'code',
    label: 'Code Block',
    description: 'Insert a code block',
    icon: ICON_CODE,
    aliases: ['code', 'codeblock'],
    execute: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    kind: 'content',
    id: 'table',
    label: 'Table',
    description: 'Insert a 3x3 table',
    icon: ICON_TABLE,
    aliases: ['table'],
    execute: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    kind: 'content',
    id: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal rule',
    icon: ICON_MINUS,
    aliases: ['divider', 'hr', 'rule'],
    execute: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    kind: 'content',
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted note or warning block',
    icon: ICON_LIGHTBULB,
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
    icon: ICON_IMAGE,
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
    icon: ICON_SPARKLES,
    aliases: ['improve'],
  },
  {
    kind: 'ai',
    id: 'check-constitution',
    label: 'Check Constitution',
    description: 'Analyze constitutional compliance of this section',
    icon: ICON_SCALE,
    aliases: ['check-constitution', 'constitution'],
  },
  {
    kind: 'ai',
    id: 'similar-proposals',
    label: 'Similar Proposals',
    description: 'Find precedent from past governance proposals',
    icon: ICON_SEARCH,
    aliases: ['similar-proposals', 'similar'],
  },
  {
    kind: 'ai',
    id: 'complete',
    label: 'Complete',
    description: 'AI suggests what is missing from this section',
    icon: ICON_FILE_TEXT,
    aliases: ['complete'],
  },
  {
    kind: 'ai',
    id: 'draft',
    label: 'Draft',
    description: 'AI drafts content from your instructions',
    icon: ICON_PEN_LINE,
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
  iconSpan.className = 'flex-shrink-0 w-5 flex items-center justify-center text-muted-foreground';
  iconSpan.appendChild(createSvgIcon(cmd.icon));

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
