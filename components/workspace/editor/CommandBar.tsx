'use client';

/**
 * CommandBar — Cmd+K / Ctrl+K overlay for free-form AI instructions.
 *
 * A floating input bar that appears over the editor when the keyboard shortcut
 * is pressed. User types a free-form instruction (e.g., "make this more specific",
 * "add budget breakdown", "simplify"). On submit, fires the onCommand callback
 * with the instruction, selected text, and current section. Escape dismisses.
 *
 * This is implemented as a Tiptap Extension that manages its own React portal
 * rendered by ProposalEditor, not as a ProseMirror decoration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

interface CommandBarState {
  isOpen: boolean;
  selectedText: string;
  section: string;
  cursorPos: number | null;
}

const commandBarPluginKey = new PluginKey<CommandBarState>('commandBar');

const OPEN_COMMAND_BAR = 'openCommandBar';
const CLOSE_COMMAND_BAR = 'closeCommandBar';

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface CommandBarExtensionOptions {
  /** Called when user submits an instruction */
  onCommand?: (instruction: string, selectedText: string, section: string) => void;
}

export const CommandBarExtension = Extension.create<CommandBarExtensionOptions>({
  name: 'commandBar',

  addOptions() {
    return {
      onCommand: undefined,
    };
  },

  addStorage() {
    return {
      isOpen: false,
      selectedText: '',
      section: '',
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const { state } = this.editor;
        const { from, to } = state.selection;
        const selectedText = from !== to ? state.doc.textBetween(from, to) : '';

        // Find current section
        const { $from } = state.selection;
        let section = 'unknown';
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === 'sectionBlock') {
            section = node.attrs.field as string;
            break;
          }
        }

        // Dispatch open event
        this.editor.view.dispatch(state.tr.setMeta(OPEN_COMMAND_BAR, { selectedText, section }));

        // Update storage for React to read
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storage = (this.editor.storage as any).commandBar;
        if (storage) {
          storage.isOpen = true;
          storage.selectedText = selectedText;
          storage.section = section;
        }

        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<CommandBarState>({
        key: commandBarPluginKey,

        state: {
          init(): CommandBarState {
            return {
              isOpen: false,
              selectedText: '',
              section: '',
              cursorPos: null,
            };
          },

          apply(tr, value): CommandBarState {
            const openData = tr.getMeta(OPEN_COMMAND_BAR) as
              | { selectedText: string; section: string }
              | undefined;

            if (openData) {
              return {
                isOpen: true,
                selectedText: openData.selectedText,
                section: openData.section,
                cursorPos: tr.selection.from,
              };
            }

            if (tr.getMeta(CLOSE_COMMAND_BAR)) {
              return {
                isOpen: false,
                selectedText: '',
                section: '',
                cursorPos: null,
              };
            }

            return value;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// React UI component — rendered by ProposalEditor when command bar is open
// ---------------------------------------------------------------------------

interface CommandBarUIProps {
  /** Whether the command bar is visible */
  isOpen: boolean;
  /** Currently selected text in the editor */
  selectedText: string;
  /** Current section the cursor is in */
  section: string;
  /** Called when user submits an instruction */
  onSubmit: (instruction: string, selectedText: string, section: string) => void;
  /** Called when user dismisses the command bar */
  onDismiss: () => void;
}

export function CommandBarUI({
  isOpen,
  selectedText,
  section,
  onSubmit,
  onDismiss,
}: CommandBarUIProps) {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setInstruction('');
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    if (!instruction.trim()) return;
    onSubmit(instruction.trim(), selectedText, section);
    setInstruction('');
    onDismiss();
  }, [instruction, selectedText, section, onSubmit, onDismiss]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    },
    [handleSubmit, onDismiss],
  );

  if (!isOpen) return null;

  return (
    <div className="command-bar-overlay fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onDismiss} />

      {/* Command bar */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
        {/* Selected text preview */}
        {selectedText && (
          <div className="px-4 pt-3 pb-2 border-b border-border/50">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Selected text
            </span>
            <p className="text-xs text-foreground/70 mt-1 line-clamp-2 leading-relaxed">
              {selectedText.length > 200 ? selectedText.slice(0, 200) + '...' : selectedText}
            </p>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
            <span className="h-5 px-1.5 rounded bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-1">
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                <path d="M5 3v4" />
                <path d="M19 17v4" />
                <path d="M3 5h4" />
                <path d="M17 19h4" />
              </svg>
              AI
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an instruction... (e.g., 'make this more specific')"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <kbd className="h-5 px-1.5 rounded bg-muted text-[10px] font-mono text-muted-foreground flex items-center">
              Enter
            </kbd>
          </div>
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-t border-border/30 text-[10px] text-muted-foreground">
          <span>
            Section: <span className="font-medium text-foreground/70">{section}</span>
          </span>
          <span>
            <kbd className="px-1 rounded bg-muted font-mono">Esc</kbd> to dismiss
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Programmatically close the command bar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function closeCommandBar(editor: any): void {
  const tr = editor.view.state.tr.setMeta(CLOSE_COMMAND_BAR, true);
  editor.view.dispatch(tr);
  if (editor.storage?.commandBar) {
    editor.storage.commandBar.isOpen = false;
  }
}
