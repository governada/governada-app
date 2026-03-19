/**
 * completionProvider — Debounced AI completion trigger for the constitution editor.
 *
 * Watches cursor position and typing activity. After a pause (debounce),
 * calls the text-improve skill with the current section context to generate
 * a ghost text suggestion. Uses the AICompletion extension's setCompletion API.
 *
 * Feature-flagged behind `amendment_ai_completion`.
 */

import {
  setCompletion,
  clearCompletion,
  hasCompletion,
} from '@/components/workspace/editor/AICompletionDecoration';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletionProviderOptions {
  /** Debounce delay in ms before triggering completion */
  debounceMs?: number;
  /** Minimum characters in current paragraph before triggering */
  minChars?: number;
  /** Feature flag check — return true if completions are enabled */
  isEnabled?: () => boolean;
}

// ---------------------------------------------------------------------------
// Provider class
// ---------------------------------------------------------------------------

export class CompletionProvider {
  private editor: Editor | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private abortController: AbortController | null = null;
  private readonly debounceMs: number;
  private readonly minChars: number;
  private readonly isEnabled: () => boolean;
  private lastRequestText = '';

  constructor(options: CompletionProviderOptions = {}) {
    this.debounceMs = options.debounceMs ?? 1500;
    this.minChars = options.minChars ?? 20;
    this.isEnabled = options.isEnabled ?? (() => true);
  }

  /** Attach to an editor instance */
  attach(editor: Editor): void {
    this.editor = editor;
    editor.on('update', this.handleUpdate);
  }

  /** Detach from the editor */
  detach(): void {
    if (this.editor) {
      this.editor.off('update', this.handleUpdate);
      this.editor = null;
    }
    this.cancel();
  }

  /** Cancel any pending completion request */
  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private handleUpdate = (): void => {
    if (!this.editor || !this.isEnabled()) return;

    // Clear existing completion on any edit
    if (hasCompletion(this.editor)) {
      clearCompletion(this.editor);
    }

    // Cancel any pending request
    this.cancel();

    // Don't trigger in read-only mode
    if (!this.editor.isEditable) return;

    // Debounce the completion request
    this.debounceTimer = setTimeout(() => {
      this.requestCompletion();
    }, this.debounceMs);
  };

  private async requestCompletion(): Promise<void> {
    if (!this.editor || !this.editor.isEditable) return;

    // Get current cursor context
    const { state } = this.editor;
    const { $from } = state.selection;

    // Get the text of the current paragraph
    const currentNode = $from.parent;
    if (currentNode.type.name !== 'paragraph' && currentNode.type.name !== 'heading') return;

    const text = currentNode.textContent;
    if (text.length < this.minChars) return;

    // Don't re-request for the same text
    if (text === this.lastRequestText) return;
    this.lastRequestText = text;

    // Find the section context
    let sectionTitle = 'unknown';
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === 'constitutionSection') {
        sectionTitle = node.attrs.title as string;
        break;
      }
    }

    // Abort any previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const res = await fetch('/api/ai/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: 'text-improve',
          input: {
            selectedText: text,
            surroundingContext: `Constitution section: ${sectionTitle}`,
            mode: 'complete',
          },
        }),
        signal: this.abortController.signal,
      });

      if (!res.ok) return;
      const data = await res.json();

      // Extract the completion text
      const suggestion = data.output?.improved ?? data.output?.text;
      if (!suggestion || typeof suggestion !== 'string') return;

      // Only show the NEW part (the continuation)
      const continuation = suggestion.startsWith(text) ? suggestion.slice(text.length) : suggestion;

      if (!continuation || continuation.length < 3) return;

      // Check editor is still valid and cursor hasn't moved
      if (!this.editor || !this.editor.isEditable) return;

      const cursorPos = this.editor.state.selection.from;
      setCompletion(this.editor, continuation.slice(0, 200), cursorPos);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Silently fail — completions are a nice-to-have
    } finally {
      this.abortController = null;
    }
  }
}
