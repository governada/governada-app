/**
 * ConstitutionSlashMenuExtension — Unified slash command menu for the constitution editor.
 *
 * Combines:
 * 1. Content block commands (headings, lists, tables, etc.) — execute directly on editor
 * 2. AI commands (improve, complete, draft, etc.) — fire onSlashCommand callback
 * 3. Constitution-specific commands (amend, check-conflicts, etc.) — fire onSlashCommand callback
 *
 * Type `/` at the start of a line to trigger. Arrow keys to navigate, Enter to select.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Command definitions — discriminated union (content vs ai)
// ---------------------------------------------------------------------------

type CommandDef =
  | {
      kind: 'content';
      id: string;
      label: string;
      description: string;
      icon: string;
      aliases: string[];
      section: 'content';
      execute: (editor: Editor) => void;
    }
  | {
      kind: 'ai';
      id: string;
      label: string;
      description: string;
      icon: string;
      aliases: string[];
      section: 'ai' | 'constitution';
    };

// --- Content block commands ---

const CONTENT_COMMANDS: CommandDef[] = [
  {
    kind: 'content',
    id: 'heading',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: '\uD83C\uDD77',
    aliases: ['heading', 'h1'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    kind: 'content',
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: '\uD83C\uDD77',
    aliases: ['h2'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    kind: 'content',
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: '\uD83C\uDD77',
    aliases: ['h3'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    kind: 'content',
    id: 'bullet',
    label: 'Bullet List',
    description: 'Create a simple bulleted list',
    icon: '\u2022',
    aliases: ['bullet', 'list', 'ul'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    kind: 'content',
    id: 'numbered',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: '\uD83D\uDD22',
    aliases: ['numbered', 'ordered', 'ol'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    kind: 'content',
    id: 'todo',
    label: 'Task List',
    description: 'Checklist with toggleable items',
    icon: '\u2611',
    aliases: ['todo', 'checklist', 'task'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    kind: 'content',
    id: 'quote',
    label: 'Blockquote',
    description: 'Insert a quote block',
    icon: '\u275D',
    aliases: ['quote', 'blockquote'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    kind: 'content',
    id: 'code',
    label: 'Code Block',
    description: 'Insert a code block',
    icon: '\u2329\u232A',
    aliases: ['code', 'codeblock'],
    section: 'content',
    execute: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    kind: 'content',
    id: 'table',
    label: 'Table',
    description: 'Insert a 3x3 table',
    icon: '\u25A6',
    aliases: ['table'],
    section: 'content',
    execute: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    kind: 'content',
    id: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal rule',
    icon: '\u2015',
    aliases: ['divider', 'hr', 'rule'],
    section: 'content',
    execute: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    kind: 'content',
    id: 'image',
    label: 'Image',
    description: 'Insert an image from URL',
    icon: '\uD83D\uDDBC',
    aliases: ['image', 'img', 'picture'],
    section: 'content',
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
    icon: '\u2728',
    aliases: ['improve'],
    section: 'ai',
  },
  {
    kind: 'ai',
    id: 'complete',
    label: 'Complete',
    description: 'AI suggests what is missing from this section',
    icon: '\uD83D\uDCDD',
    aliases: ['complete'],
    section: 'ai',
  },
  {
    kind: 'ai',
    id: 'draft',
    label: 'Draft',
    description: 'AI drafts content from your instructions',
    icon: '\u270D\uFE0F',
    aliases: ['draft'],
    section: 'ai',
  },
];

// --- Constitution-specific AI commands ---

const CONSTITUTION_COMMANDS: CommandDef[] = [
  {
    kind: 'ai',
    id: 'amend',
    label: 'Propose Amendment',
    description: 'Suggest changes to this article',
    icon: '\u270F\uFE0F',
    aliases: ['amend', 'amendment'],
    section: 'constitution',
  },
  {
    kind: 'ai',
    id: 'check-conflicts',
    label: 'Check Conflicts',
    description: 'Check for conflicts with other articles',
    icon: '\u26A0\uFE0F',
    aliases: ['check-conflicts', 'conflicts'],
    section: 'constitution',
  },
  {
    kind: 'ai',
    id: 'explain-impact',
    label: 'Explain Impact',
    description: 'Explain governance impact of this change',
    icon: '\uD83D\uDCCA',
    aliases: ['explain-impact', 'impact'],
    section: 'constitution',
  },
  {
    kind: 'ai',
    id: 'compare-original',
    label: 'Compare Original',
    description: 'Show the original text',
    icon: '\uD83D\uDD0D',
    aliases: ['compare-original', 'compare'],
    section: 'constitution',
  },
];

const ALL_COMMANDS: CommandDef[] = [...CONTENT_COMMANDS, ...AI_COMMANDS, ...CONSTITUTION_COMMANDS];

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
  commands: CommandDef[],
  selectedIndex: number,
  onSelect: (command: CommandDef) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'slash-command-menu fixed z-50 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1 max-h-80 overflow-y-auto';
  container.setAttribute('role', 'listbox');

  // Group by section
  const contentItems = commands.filter((c) => c.section === 'content');
  const aiItems = commands.filter((c) => c.section === 'ai');
  const constItems = commands.filter((c) => c.section === 'constitution');

  let globalIndex = 0;

  const addSection = (label: string, items: CommandDef[]) => {
    if (items.length === 0) return;

    if (globalIndex > 0) {
      const separator = document.createElement('div');
      separator.className = 'mx-2 my-1 border-t border-border/50';
      container.appendChild(separator);
    }

    const header = document.createElement('div');
    header.className =
      'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground select-none';
    header.textContent = label;
    container.appendChild(header);

    for (const cmd of items) {
      const item = document.createElement('div');
      item.className = `slash-command-item flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${
        globalIndex === selectedIndex
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50'
      }`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(globalIndex === selectedIndex));

      const iconSpan = document.createElement('span');
      iconSpan.className = 'text-base flex-shrink-0';
      iconSpan.textContent = cmd.icon;

      const textContainer = document.createElement('div');
      textContainer.className = 'flex flex-col min-w-0';

      const nameEl = document.createElement('span');
      nameEl.className = 'font-medium text-[13px] leading-tight';
      nameEl.textContent = cmd.label;

      const desc = document.createElement('span');
      desc.className = 'text-[11px] text-muted-foreground leading-tight truncate';
      desc.textContent = cmd.description;

      textContainer.appendChild(nameEl);
      textContainer.appendChild(desc);
      item.appendChild(iconSpan);
      item.appendChild(textContainer);

      const cmdRef = cmd;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(cmdRef);
      });

      container.appendChild(item);
      globalIndex++;
    }
  };

  addSection('Content', contentItems);
  addSection('AI', aiItems);
  addSection('Constitution', constItems);

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
    if (node.type.name === 'constitutionSection' || node.type.name === 'sectionBlock') {
      return node.attrs.field as string;
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Filter commands by query
// ---------------------------------------------------------------------------

function filterCommands(query: string): CommandDef[] {
  if (!query) return ALL_COMMANDS;
  const lower = query.toLowerCase();
  return ALL_COMMANDS.filter(
    (cmd) =>
      cmd.id.includes(lower) ||
      cmd.label.toLowerCase().includes(lower) ||
      cmd.aliases.some((a) => a.includes(lower)),
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

          // Execute: content commands run on editor, AI commands fire callback
          if (selected.kind === 'content') {
            selected.execute(this.editor);
          } else {
            const section = getSectionContext(this.editor.view);
            this.options.onSlashCommand?.(selected.id, section);
          }

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
      const editorRef = this.editor;
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
                const slashMatch = textBefore.match(/(?:^|\s)\/([a-z0-9-]*)$/);

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

                menuElement = createMenuElement(filtered, state.selectedIndex, (cmd) => {
                  if (state.triggerPos !== null) {
                    const from = state.triggerPos;
                    const to = view.state.selection.from;
                    const tr = view.state.tr
                      .delete(from, to)
                      .setMeta(constitutionSlashMenuPluginKey, { type: 'close' });
                    view.dispatch(tr);
                  }

                  if (cmd.kind === 'content') {
                    cmd.execute(editorRef);
                  } else {
                    const section = getSectionContext(view);
                    extensionOptions.onSlashCommand?.(cmd.id, section);
                  }
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
