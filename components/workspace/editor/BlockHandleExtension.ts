/**
 * BlockHandleExtension — Notion-style "+" gutter button and drag handle.
 *
 * Renders two UI elements on block hover:
 * 1. A "+" button that opens the slash command menu at that position
 * 2. A 6-dot drag handle for block reordering (within a section)
 *
 * Uses a ProseMirror plugin view that tracks cursor/hover position and
 * renders a floating UI element alongside the hovered block.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const blockHandlePluginKey = new PluginKey('blockHandle');

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createHandleElement(): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'block-handle-container fixed z-40 flex items-center gap-0.5 opacity-0 transition-opacity pointer-events-none';
  container.style.userSelect = 'none';

  // Drag handle (6-dot grip)
  const drag = document.createElement('div');
  drag.className =
    'block-drag-handle w-4 h-6 flex items-center justify-center rounded cursor-grab text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/50 transition-colors pointer-events-auto';
  drag.setAttribute('draggable', 'true');
  drag.setAttribute('aria-label', 'Drag to reorder');
  drag.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
    <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
    <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
  </svg>`;

  // Plus button
  const plus = document.createElement('button');
  plus.className =
    'block-plus-button w-5 h-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground/80 hover:bg-primary/10 transition-colors pointer-events-auto cursor-pointer';
  plus.setAttribute('aria-label', 'Add block');
  plus.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
    <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
  </svg>`;

  container.appendChild(drag);
  container.appendChild(plus);

  return container;
}

// ---------------------------------------------------------------------------
// Find the top-level block node at a given screen position
// ---------------------------------------------------------------------------

function findBlockAtCoords(
  view: EditorView,
  coords: { left: number; top: number },
): { pos: number; dom: HTMLElement } | null {
  const posInfo = view.posAtCoords(coords);
  if (!posInfo) return null;

  // Walk up to find the top-level block within the content section
  const $pos = view.state.doc.resolve(posInfo.pos);

  // Find depth 2 (section > block) or depth 1 (doc > block)
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    const nodeType = node.type.name;

    // Stop at section boundaries
    if (nodeType === 'constitutionSection' || nodeType === 'sectionBlock') break;

    // This is a block-level node (paragraph, heading, list, etc.)
    if (
      nodeType === 'paragraph' ||
      nodeType === 'heading' ||
      nodeType === 'bulletList' ||
      nodeType === 'orderedList' ||
      nodeType === 'taskList' ||
      nodeType === 'blockquote' ||
      nodeType === 'codeBlock' ||
      nodeType === 'table' ||
      nodeType === 'horizontalRule'
    ) {
      const pos = $pos.before(depth);
      const dom = view.nodeDOM(pos) as HTMLElement | null;
      if (dom) {
        return { pos, dom };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export interface BlockHandleOptions {
  /** Called when the "+" button is clicked. Receives the position to insert at. */
  onPlusClick?: (pos: number) => void;
}

export const BlockHandleExtension = Extension.create<BlockHandleOptions>({
  name: 'blockHandle',

  addOptions() {
    return {
      onPlusClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const editorRef = this.editor;
    let handleEl: HTMLElement | null = null;
    let currentBlockPos: number | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | undefined;

    return [
      new Plugin({
        key: blockHandlePluginKey,

        view() {
          // Create the floating handle element
          handleEl = createHandleElement();

          document.body.appendChild(handleEl);

          return {
            update(view: EditorView) {
              if (!handleEl) return;

              // Only show when editor is editable
              if (!view.editable) {
                handleEl.style.opacity = '0';
                handleEl.style.pointerEvents = 'none';
                return;
              }
            },

            destroy() {
              if (handleEl) {
                handleEl.remove();
                handleEl = null;
              }
              if (hideTimeout) clearTimeout(hideTimeout);
            },
          };
        },

        props: {
          handleDOMEvents: {
            mousemove(view: EditorView, event: MouseEvent) {
              if (!handleEl || !view.editable) return false;

              // Clear any pending hide
              if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = undefined;
              }

              const coords = { left: event.clientX, top: event.clientY };
              const block = findBlockAtCoords(view, coords);

              if (!block) {
                // Delay hiding to avoid flicker when moving between blocks
                hideTimeout = setTimeout(() => {
                  if (handleEl) {
                    handleEl.style.opacity = '0';
                    handleEl.style.pointerEvents = 'none';
                  }
                  currentBlockPos = null;
                }, 200);
                return false;
              }

              // Same block, no update needed
              if (currentBlockPos === block.pos) return false;
              currentBlockPos = block.pos;

              // Position the handle to the left of the block
              const blockRect = block.dom.getBoundingClientRect();
              handleEl.style.top = `${blockRect.top + 2}px`;
              handleEl.style.left = `${Math.max(4, blockRect.left - 48)}px`;
              handleEl.style.opacity = '1';
              handleEl.style.pointerEvents = 'auto';

              // Wire the plus button click for this specific position
              const plusBtn = handleEl.querySelector('.block-plus-button');
              if (plusBtn) {
                const newPlusBtn = plusBtn.cloneNode(true) as HTMLElement;
                plusBtn.parentNode?.replaceChild(newPlusBtn, plusBtn);
                newPlusBtn.addEventListener('mousedown', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const { tr } = editorRef.state;
                  const $blockPos = editorRef.state.doc.resolve(block.pos);
                  const after = block.pos + $blockPos.parent.child($blockPos.index()).nodeSize;
                  const paragraph = editorRef.state.schema.nodes.paragraph.create();
                  editorRef.view.dispatch(tr.insert(after, paragraph));
                  editorRef.commands.focus(after + 1);
                  setTimeout(() => {
                    editorRef.commands.insertContent('/');
                  }, 10);
                });
              }

              // Wire drag handle for this block
              const dragHandle = handleEl.querySelector('.block-drag-handle');
              if (dragHandle) {
                const newDrag = dragHandle.cloneNode(true) as HTMLElement;
                dragHandle.parentNode?.replaceChild(newDrag, dragHandle);
                newDrag.setAttribute('draggable', 'true');
                newDrag.addEventListener('dragstart', (e) => {
                  if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    // Use ProseMirror's selection-based drag
                    const $pos = editorRef.state.doc.resolve(block.pos);
                    const nodeAtPos = $pos.parent.child($pos.index());
                    const from = block.pos;
                    const to = from + nodeAtPos.nodeSize;
                    editorRef.commands.setNodeSelection(from);

                    // Create a drag image from the block
                    const ghost = block.dom.cloneNode(true) as HTMLElement;
                    ghost.style.opacity = '0.5';
                    ghost.style.position = 'absolute';
                    ghost.style.top = '-1000px';
                    document.body.appendChild(ghost);
                    e.dataTransfer.setDragImage(ghost, 0, 0);
                    setTimeout(() => ghost.remove(), 0);

                    e.dataTransfer.setData(
                      'application/prosemirror-block',
                      JSON.stringify({ from, to }),
                    );
                  }
                });
              }

              return false;
            },

            mouseleave(_view: EditorView) {
              if (!handleEl) return false;
              // Delay hiding so user can move to the handle itself
              hideTimeout = setTimeout(() => {
                if (handleEl) {
                  handleEl.style.opacity = '0';
                  handleEl.style.pointerEvents = 'none';
                }
                currentBlockPos = null;
              }, 300);
              return false;
            },
          },
        },
      }),
    ];
  },
});
