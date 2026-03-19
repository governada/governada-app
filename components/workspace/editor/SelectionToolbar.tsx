'use client';

/**
 * SelectionToolbar — Notion-style floating toolbar for inline commenting.
 *
 * Appears when the user selects text in the Tiptap editor. Provides a
 * "Comment" button that expands into a category picker + text input.
 * Supports both editable and read-only (review) editors by temporarily
 * toggling editability to apply the inlineComment mark.
 *
 * Uses custom selection detection + portal positioning (no BubbleMenu dependency).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import {
  MessageSquarePlus,
  Send,
  X,
  Highlighter,
  Strikethrough,
  Flag,
  ShieldAlert,
  Scale,
  Bold,
  Italic,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORIES = ['note', 'concern', 'question', 'suggestion'] as const;
type CommentCategory = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<CommentCategory, string> = {
  note: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  concern: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  question: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  suggestion: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

// ---------------------------------------------------------------------------
// Constitutional references
// ---------------------------------------------------------------------------

const CONSTITUTION_REFS = [
  { id: 'art1', article: 'Article I', summary: 'Tenets & Guardrails' },
  { id: 'art2', article: 'Article II', summary: 'Community Governance Consent' },
  { id: 'art3', article: 'Article III', summary: 'Governance Actions' },
  { id: 'art4', article: 'Article IV', summary: 'Constitutional Committee' },
  { id: 'art5', article: 'Article V', summary: 'Governance Principles' },
  { id: 'art6', article: 'Article VI', summary: 'Hard Fork Process' },
  { id: 'art7', article: 'Article VII', summary: 'Constitution Amendments' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SelectionToolbarProps {
  editor: Editor;
  currentUserId: string;
  currentUserName?: string;
  onCommentCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelectionToolbar({
  editor,
  currentUserId,
  currentUserName = 'You',
  onCommentCreated,
}: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentCategory, setCommentCategory] = useState<CommentCategory>('note');
  const [showRiskMenu, setShowRiskMenu] = useState(false);
  const [showConstitutionMenu, setShowConstitutionMenu] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const riskMenuRef = useRef<HTMLDivElement>(null);
  const constitutionMenuRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Selection detection — show/hide toolbar based on editor selection
  // -------------------------------------------------------------------------

  useEffect(() => {
    const updateToolbar = () => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setVisible(false);
        setShowCommentInput(false);
        return;
      }

      // Get the DOM range for positioning
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) {
        setVisible(false);
        return;
      }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0) {
        setVisible(false);
        return;
      }

      setPosition({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setVisible(true);
    };

    editor.on('selectionUpdate', updateToolbar);
    return () => {
      editor.off('selectionUpdate', updateToolbar);
    };
  }, [editor]);

  // Close when clicking outside
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowCommentInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  // -------------------------------------------------------------------------
  // Submit handler — applies inlineComment mark to the selected text
  // -------------------------------------------------------------------------

  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim()) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // If editor is non-editable (review mode), temporarily enable editing
    const wasEditable = editor.isEditable;
    if (!wasEditable) editor.setEditable(true);

    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const markType = editor.schema.marks.inlineComment;
        if (!markType) return false;
        const mark = markType.create({
          id: commentId,
          author: currentUserName,
          authorId: currentUserId,
          timestamp: new Date().toISOString(),
          category: commentCategory,
          text: commentText.trim(),
        });
        tr.addMark(from, to, mark);
        return true;
      })
      .setTextSelection({ from, to })
      .run();

    if (!wasEditable) editor.setEditable(false);

    setCommentText('');
    setShowCommentInput(false);
    setCommentCategory('note');
    setVisible(false);
    onCommentCreated?.();
  }, [editor, commentText, commentCategory, currentUserId, currentUserName, onCommentCreated]);

  // -------------------------------------------------------------------------
  // Quick mark handlers — one-click highlight / redline / flag
  // -------------------------------------------------------------------------

  const handleQuickMark = useCallback(
    (type: string, customText?: string) => {
      const { from, to } = editor.state.selection;
      if (from === to) return;

      const categoryMap: Record<string, CommentCategory> = {
        highlight: 'note',
        redline: 'concern',
        flag: 'concern',
        'risk-low': 'note',
        'risk-medium': 'concern',
        'risk-high': 'concern',
        'risk-critical': 'concern',
        constitution: 'note',
      };
      const textMap: Record<string, string> = {
        highlight: '[Highlighted for review]',
        redline: '[Suggested for deletion]',
        flag: '[Flagged as concerning]',
        'risk-low': '[Low Risk]',
        'risk-medium': '[Medium Risk]',
        'risk-high': '[High Risk]',
        'risk-critical': '[Critical Risk]',
      };

      const text = customText || textMap[type] || `[${type}]`;

      const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const wasEditable = editor.isEditable;
      if (!wasEditable) editor.setEditable(true);

      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          const markType = editor.schema.marks.inlineComment;
          if (!markType) return false;
          tr.addMark(
            from,
            to,
            markType.create({
              id: commentId,
              author: currentUserName,
              authorId: currentUserId,
              timestamp: new Date().toISOString(),
              category: categoryMap[type] || 'note',
              text,
            }),
          );
          return true;
        })
        .setTextSelection({ from, to })
        .run();

      if (!wasEditable) editor.setEditable(false);
      setVisible(false);
      onCommentCreated?.();
    },
    [editor, currentUserId, currentUserName, onCommentCreated],
  );

  const handleConstitutionRef = useCallback(
    (ref: (typeof CONSTITUTION_REFS)[0]) => {
      handleQuickMark('constitution', `[Ref: ${ref.article} — ${ref.summary}]`);
    },
    [handleQuickMark],
  );

  const handleCancel = useCallback(() => {
    setShowCommentInput(false);
    setCommentText('');
    setCommentCategory('note');
  }, []);

  // -------------------------------------------------------------------------
  // Render — portal to body for proper z-index stacking
  // -------------------------------------------------------------------------

  if (!visible) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-[60] -translate-x-1/2 -translate-y-full"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background shadow-lg p-1">
        {!showCommentInput ? (
          <>
            {/* Inline formatting buttons (edit mode only) */}
            {editor.isEditable && (
              <>
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn(
                    'p-1.5 rounded-md transition-colors cursor-pointer',
                    editor.isActive('bold')
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn(
                    'p-1.5 rounded-md transition-colors cursor-pointer',
                    editor.isActive('italic')
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                  title="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    const url = window.prompt('URL', editor.getAttributes('link').href ?? '');
                    if (url === null) return;
                    if (url === '') {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    } else {
                      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    }
                  }}
                  className={cn(
                    'p-1.5 rounded-md transition-colors cursor-pointer',
                    editor.isActive('link')
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                  title="Link"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-border" />
              </>
            )}
            <button
              onClick={() => setShowCommentInput(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              title="Add comment"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Comment
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => handleQuickMark('highlight')}
              className="p-1.5 text-amber-400/70 hover:text-amber-400 rounded-md hover:bg-amber-500/10 transition-colors cursor-pointer"
              title="Highlight"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleQuickMark('redline')}
              className="p-1.5 text-rose-400/70 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Suggest deletion (redline)"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleQuickMark('flag')}
              className="p-1.5 text-red-400/70 hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Flag as concerning"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-border" />
            {/* Risk severity */}
            <div className="relative" ref={riskMenuRef}>
              <button
                onClick={() => {
                  setShowRiskMenu(!showRiskMenu);
                  setShowConstitutionMenu(false);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                title="Tag risk severity"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
              </button>
              {showRiskMenu && (
                <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-border bg-background shadow-lg p-1 min-w-[120px]">
                  {(
                    [
                      { level: 'low', label: 'Low Risk', color: 'text-emerald-400' },
                      { level: 'medium', label: 'Medium Risk', color: 'text-amber-400' },
                      { level: 'high', label: 'High Risk', color: 'text-orange-400' },
                      { level: 'critical', label: 'Critical Risk', color: 'text-rose-400' },
                    ] as const
                  ).map(({ level, label, color }) => (
                    <button
                      key={level}
                      onClick={() => {
                        handleQuickMark(`risk-${level}`);
                        setShowRiskMenu(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-muted/50 cursor-pointer',
                        color,
                      )}
                    >
                      <ShieldAlert className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Constitutional reference */}
            <div className="relative" ref={constitutionMenuRef}>
              <button
                onClick={() => {
                  setShowConstitutionMenu(!showConstitutionMenu);
                  setShowRiskMenu(false);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                title="Link to constitutional article"
              >
                <Scale className="h-3.5 w-3.5" />
              </button>
              {showConstitutionMenu && (
                <div className="absolute bottom-full right-0 mb-1 rounded-lg border border-border bg-background shadow-lg p-1 min-w-[200px] max-h-[200px] overflow-y-auto">
                  {CONSTITUTION_REFS.map((ref) => (
                    <button
                      key={ref.id}
                      onClick={() => {
                        handleConstitutionRef(ref);
                        setShowConstitutionMenu(false);
                      }}
                      className="w-full flex flex-col gap-0.5 px-2 py-1.5 text-left rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-foreground">{ref.article}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {ref.summary}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 p-2 min-w-[280px]">
            {/* Category selector */}
            <div className="flex items-center gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCommentCategory(cat)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-medium rounded border capitalize transition-colors cursor-pointer',
                    commentCategory === cat
                      ? CATEGORY_COLORS[cat]
                      : 'text-muted-foreground border-transparent hover:border-border',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Comment input */}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write your comment..."
              className="w-full min-h-[60px] max-h-[120px] resize-none rounded border border-border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmitComment();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancel();
                }
              }}
            />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/40">Ctrl+Enter to submit</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCancel}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer',
                    commentText.trim()
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                >
                  <Send className="h-3 w-3" />
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
