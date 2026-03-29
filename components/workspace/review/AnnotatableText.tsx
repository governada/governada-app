'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAISkill } from '@/hooks/useAISkill';
import { useFeatureFlag } from '@/components/FeatureGate';
import {
  MessageSquare,
  Highlighter,
  AlertTriangle,
  BookOpen,
  Brain,
  X,
  Trash2,
  Globe,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProposalAnnotation, AnnotationType, AnnotationField } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<AnnotationType, { bg: string; text: string; border: string }> = {
  note: {
    bg: 'bg-yellow-200/60 dark:bg-yellow-900/40',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-400 dark:border-yellow-600',
  },
  highlight: {
    bg: 'bg-emerald-200/60 dark:bg-emerald-900/40',
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-400 dark:border-emerald-600',
  },
  citation: {
    bg: 'bg-blue-200/60 dark:bg-blue-900/40',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-400 dark:border-blue-600',
  },
  concern: {
    bg: 'bg-red-200/60 dark:bg-red-900/40',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-400 dark:border-red-600',
  },
  suggestion: {
    bg: 'bg-sky-200/60 dark:bg-sky-900/40',
    text: 'text-sky-800 dark:text-sky-200',
    border: 'border-sky-400 dark:border-sky-600',
  },
};

const TYPE_ICONS: Record<AnnotationType, typeof MessageSquare> = {
  note: MessageSquare,
  highlight: Highlighter,
  citation: BookOpen,
  concern: AlertTriangle,
  suggestion: Brain,
};

const TYPE_LABELS: Record<AnnotationType, string> = {
  note: 'Note',
  highlight: 'Highlight',
  citation: 'Citation',
  concern: 'Concern',
  suggestion: 'Suggestion',
};

/** Priority for overlapping annotations (higher = shown on top) */
const TYPE_PRIORITY: Record<AnnotationType, number> = {
  highlight: 1,
  note: 2,
  citation: 3,
  concern: 4,
  suggestion: 5,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnnotatableTextProps {
  text: string;
  field: AnnotationField;
  proposalTxHash: string;
  proposalIndex: number;
  annotations: ProposalAnnotation[];
  currentUserId?: string;
  onCreateAnnotation: (annotation: {
    proposalTxHash: string;
    proposalIndex: number;
    anchorStart: number;
    anchorEnd: number;
    anchorField: AnnotationField;
    annotationText: string;
    annotationType: AnnotationType;
    isPublic?: boolean;
  }) => void;
  onUpdateAnnotation: (
    id: string,
    updates: Partial<Pick<ProposalAnnotation, 'annotationText' | 'isPublic' | 'color'>>,
  ) => void;
  onDeleteAnnotation: (id: string) => void;
  readOnly?: boolean;
  /** Proposal type for AI explain action */
  proposalType?: string;
}

interface TextSegment {
  start: number;
  end: number;
  text: string;
  annotations: ProposalAnnotation[];
}

// ---------------------------------------------------------------------------
// Segment builder — splits text into annotated/unannotated ranges
// ---------------------------------------------------------------------------

function buildSegments(text: string, annotations: ProposalAnnotation[]): TextSegment[] {
  if (annotations.length === 0) {
    return [{ start: 0, end: text.length, text, annotations: [] }];
  }

  // Collect all unique boundary points
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);
  for (const a of annotations) {
    boundaries.add(Math.max(0, a.anchorStart));
    boundaries.add(Math.min(text.length, a.anchorEnd));
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  const segments: TextSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;

    const overlapping = annotations.filter((a) => a.anchorStart < end && a.anchorEnd > start);

    segments.push({
      start,
      end,
      text: text.slice(start, end),
      annotations: overlapping,
    });
  }

  return segments;
}

function getTopAnnotation(annotations: ProposalAnnotation[]): ProposalAnnotation | null {
  if (annotations.length === 0) return null;
  return annotations.reduce((top, a) =>
    TYPE_PRIORITY[a.annotationType] > TYPE_PRIORITY[top.annotationType] ? a : top,
  );
}

// ---------------------------------------------------------------------------
// Selection Toolbar — appears when user selects text
// ---------------------------------------------------------------------------

interface SelectionToolbarProps {
  position: { top: number; left: number };
  onSelect: (type: AnnotationType) => void;
  onClose: () => void;
  onExplain?: () => void;
}

function SelectionToolbar({ position, onSelect, onClose, onExplain }: SelectionToolbarProps) {
  const types: AnnotationType[] = ['note', 'highlight', 'concern', 'citation'];

  return (
    <div
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {types.map((type) => {
        const Icon = TYPE_ICONS[type];
        const colors = TYPE_COLORS[type];
        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              'hover:bg-accent',
              colors.text,
            )}
            title={TYPE_LABELS[type]}
          >
            <Icon className="h-3.5 w-3.5" />
            {TYPE_LABELS[type]}
          </button>
        );
      })}
      {onExplain && (
        <>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={onExplain}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-accent transition-colors"
            title="Explain this passage"
          >
            <Brain className="h-3.5 w-3.5" />
            Explain
          </button>
        </>
      )}
      <button
        onClick={onClose}
        className="ml-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Annotation Popover — shows details when clicking a highlight
// ---------------------------------------------------------------------------

interface AnnotationPopoverProps {
  annotations: ProposalAnnotation[];
  currentUserId?: string;
  position: { top: number; left: number };
  onClose: () => void;
  onUpdate: (
    id: string,
    updates: Partial<Pick<ProposalAnnotation, 'annotationText' | 'isPublic' | 'color'>>,
  ) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

function AnnotationPopover({
  annotations,
  currentUserId,
  position,
  onClose,
  onUpdate,
  onDelete,
  readOnly,
}: AnnotationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {annotations.map((a) => {
        const colors = TYPE_COLORS[a.annotationType];
        const Icon = TYPE_ICONS[a.annotationType];
        const isOwn = a.userId === currentUserId;

        return (
          <div key={a.id} className="border-b border-border last:border-b-0 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className={cn('flex items-center gap-1.5 text-xs font-medium', colors.text)}>
                <Icon className="h-3.5 w-3.5" />
                {TYPE_LABELS[a.annotationType]}
                {a.isPublic && (
                  <span className="ml-1 text-[10px] text-muted-foreground">(public)</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed">{a.annotationText}</p>

            {isOwn && !readOnly && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onUpdate(a.id, { isPublic: !a.isPublic })}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  title={a.isPublic ? 'Make private' : 'Make public'}
                >
                  {a.isPublic ? (
                    <>
                      <Lock className="h-3 w-3" />
                      Make private
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3" />
                      Publish
                    </>
                  )}
                </button>
                <button
                  onClick={() => onDelete(a.id)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}

            {!isOwn && (
              <div className="text-[10px] text-muted-foreground">
                {a.userId.slice(0, 8)}...
                {a.upvoteCount > 0 && <span className="ml-2">+{a.upvoteCount}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Annotation Dialog — inline form after selecting text
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  type: AnnotationType;
  position: { top: number; left: number };
  onSubmit: (text: string) => void;
  onClose: () => void;
}

function CreateAnnotationDialog({ type, position, onSubmit, onClose }: CreateDialogProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const colors = TYPE_COLORS[type];
  const Icon = TYPE_ICONS[type];

  return (
    <div
      ref={dialogRef}
      className="fixed z-50 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg space-y-2"
      style={{ top: position.top, left: position.left }}
    >
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', colors.text)}>
        <Icon className="h-3.5 w-3.5" />
        Add {TYPE_LABELS[type]}
      </div>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Your ${type}...`}
        className="w-full min-h-[60px] rounded-md border border-border bg-background px-2 py-1.5 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        maxLength={2000}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) {
            onSubmit(text.trim());
          }
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{text.length}/2000</span>
        <div className="flex gap-1.5">
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={!text.trim()}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              colors.bg,
              colors.text,
              'disabled:opacity-40',
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AnnotatableText component
// ---------------------------------------------------------------------------

export function AnnotatableText({
  text,
  field,
  proposalTxHash,
  proposalIndex,
  annotations,
  currentUserId,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  readOnly = false,
  proposalType,
}: AnnotatableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Feature flag for explain action
  const explainEnabled = useFeatureFlag('review_section_intelligence');

  // Explain state (AI explain popover)
  const [explainState, setExplainState] = useState<{
    selectedText: string;
    surroundingContext: string;
    position: { top: number; left: number };
  } | null>(null);

  // Selection state
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
    position: { top: number; left: number };
  } | null>(null);

  // Toolbar state — shown after selection
  const [toolbarVisible, setToolbarVisible] = useState(false);

  // Create dialog state
  const [createDialog, setCreateDialog] = useState<{
    type: AnnotationType;
    start: number;
    end: number;
    position: { top: number; left: number };
  } | null>(null);

  // Popover state
  const [popover, setPopover] = useState<{
    annotations: ProposalAnnotation[];
    position: { top: number; left: number };
  } | null>(null);

  // Filter annotations to this field only
  const fieldAnnotations = annotations.filter((a) => a.anchorField === field);
  const segments = buildSegments(text, fieldAnnotations);

  // ---------------------------------------------------------------------------
  // Text selection handler
  // ---------------------------------------------------------------------------

  const handleMouseUp = useCallback(() => {
    if (readOnly || createDialog || popover) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelection(null);
      setToolbarVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    // Calculate the text offset within our container
    const preRange = document.createRange();
    preRange.selectNodeContents(containerRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const end = start + range.toString().length;

    if (end <= start) return;

    const rect = range.getBoundingClientRect();
    const position = {
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 350)),
    };

    setSelection({ start, end, position });
    setToolbarVisible(true);
  }, [readOnly, createDialog, popover]);

  // Also support touch: on touchend, same logic
  const handleTouchEnd = useCallback(() => {
    // Small delay to let the browser settle the selection
    setTimeout(() => handleMouseUp(), 100);
  }, [handleMouseUp]);

  // ---------------------------------------------------------------------------
  // Toolbar action — user picks annotation type
  // ---------------------------------------------------------------------------

  const handleToolbarSelect = useCallback(
    (type: AnnotationType) => {
      if (!selection) return;

      if (type === 'highlight') {
        // Highlights are instant — no text needed
        onCreateAnnotation({
          proposalTxHash,
          proposalIndex,
          anchorStart: selection.start,
          anchorEnd: selection.end,
          anchorField: field,
          annotationText: text.slice(selection.start, selection.end),
          annotationType: 'highlight',
        });
        setSelection(null);
        setToolbarVisible(false);
        window.getSelection()?.removeAllRanges();
      } else {
        // Show create dialog for typed annotations
        setCreateDialog({
          type,
          start: selection.start,
          end: selection.end,
          position: selection.position,
        });
        setToolbarVisible(false);
      }
    },
    [selection, onCreateAnnotation, proposalTxHash, proposalIndex, field, text],
  );

  // ---------------------------------------------------------------------------
  // Explain action — AI explains selected text
  // ---------------------------------------------------------------------------

  const handleExplain = useCallback(() => {
    if (!selection) return;
    const selectedText = text.slice(selection.start, selection.end);
    const contextStart = Math.max(0, selection.start - 300);
    const contextEnd = Math.min(text.length, selection.end + 300);
    const surroundingContext = text.slice(contextStart, contextEnd);
    setExplainState({
      selectedText,
      surroundingContext,
      position: selection.position,
    });
    setToolbarVisible(false);
    window.getSelection()?.removeAllRanges();
  }, [selection, text]);

  // ---------------------------------------------------------------------------
  // Create dialog submit
  // ---------------------------------------------------------------------------

  const handleCreateSubmit = useCallback(
    (annotationText: string) => {
      if (!createDialog) return;
      onCreateAnnotation({
        proposalTxHash,
        proposalIndex,
        anchorStart: createDialog.start,
        anchorEnd: createDialog.end,
        anchorField: field,
        annotationText,
        annotationType: createDialog.type,
      });
      setCreateDialog(null);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [createDialog, onCreateAnnotation, proposalTxHash, proposalIndex, field],
  );

  // ---------------------------------------------------------------------------
  // Highlight click — show popover
  // ---------------------------------------------------------------------------

  const handleHighlightClick = useCallback(
    (segAnnotations: ProposalAnnotation[], e: React.MouseEvent) => {
      e.stopPropagation();
      if (createDialog) return;
      setPopover({
        annotations: segAnnotations,
        position: {
          top: e.clientY + 8,
          left: Math.max(8, Math.min(e.clientX - 100, window.innerWidth - 300)),
        },
      });
    },
    [createDialog],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
      >
        {segments.map((seg, i) => {
          if (seg.annotations.length === 0) {
            return <span key={i}>{seg.text}</span>;
          }

          const topAnnotation = getTopAnnotation(seg.annotations);
          if (!topAnnotation) return <span key={i}>{seg.text}</span>;

          const colors = TYPE_COLORS[topAnnotation.annotationType];
          const isOwn = topAnnotation.userId === currentUserId;
          const othersCount = seg.annotations.filter((a) => a.userId !== currentUserId).length;

          return (
            <mark
              key={i}
              data-annotation-id={topAnnotation.id}
              className={cn(
                'cursor-pointer rounded-sm px-0.5 transition-colors',
                isOwn
                  ? colors.bg
                  : 'underline decoration-dashed decoration-1 underline-offset-4 bg-muted/40',
                isOwn
                  ? colors.bg
                  : `decoration-${topAnnotation.annotationType === 'concern' ? 'red' : topAnnotation.annotationType === 'citation' ? 'blue' : topAnnotation.annotationType === 'highlight' ? 'emerald' : 'yellow'}-400`,
              )}
              onClick={(e) => handleHighlightClick(seg.annotations, e)}
              title={`${seg.annotations.length} annotation${seg.annotations.length > 1 ? 's' : ''}`}
            >
              {seg.text}
              {seg.annotations.length > 1 && (
                <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-muted text-[10px] font-medium text-muted-foreground align-super">
                  +{seg.annotations.length - 1}
                </span>
              )}
              {othersCount > 0 && seg.annotations.length === 1 && (
                <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary/10 text-[10px] font-medium text-primary align-super">
                  {othersCount}
                </span>
              )}
            </mark>
          );
        })}
      </div>

      {/* Selection Toolbar */}
      {toolbarVisible && selection && !createDialog && (
        <SelectionToolbar
          position={selection.position}
          onSelect={handleToolbarSelect}
          onClose={() => {
            setSelection(null);
            setToolbarVisible(false);
            window.getSelection()?.removeAllRanges();
          }}
          onExplain={proposalType && explainEnabled ? handleExplain : undefined}
        />
      )}

      {/* Create Dialog */}
      {createDialog && (
        <CreateAnnotationDialog
          type={createDialog.type}
          position={createDialog.position}
          onSubmit={handleCreateSubmit}
          onClose={() => {
            setCreateDialog(null);
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      {/* Annotation Popover */}
      {popover && (
        <AnnotationPopover
          annotations={popover.annotations}
          currentUserId={currentUserId}
          position={popover.position}
          onClose={() => setPopover(null)}
          onUpdate={(id, updates) => {
            onUpdateAnnotation(id, updates);
            setPopover(null);
          }}
          onDelete={(id) => {
            onDeleteAnnotation(id);
            setPopover(null);
          }}
          readOnly={readOnly}
        />
      )}

      {/* Explain Popover */}
      {explainState && proposalType && (
        <ExplainPopover
          selectedText={explainState.selectedText}
          surroundingContext={explainState.surroundingContext}
          proposalType={proposalType}
          position={explainState.position}
          proposalTxHash={proposalTxHash}
          proposalIndex={proposalIndex}
          onClose={() => setExplainState(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explain Popover — shows AI explanation of selected text
// ---------------------------------------------------------------------------

function ExplainPopover({
  selectedText,
  surroundingContext,
  proposalType,
  position,
  proposalTxHash,
  proposalIndex,
  onClose,
}: {
  selectedText: string;
  surroundingContext: string;
  proposalType: string;
  position: { top: number; left: number };
  proposalTxHash: string;
  proposalIndex: number;
  onClose: () => void;
}) {
  const skill = useAISkill<{ improvedText: string; explanation: string }>();
  const invokedRef = useRef(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invokedRef.current) return;
    invokedRef.current = true;
    skill.mutate({
      skill: 'text-improve',
      input: {
        selectedText,
        surroundingContext,
        proposalType,
        instruction: 'Explain this passage in plain governance terms, personalized to the reader.',
      },
      proposalTxHash,
      proposalIndex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[380px] max-h-[280px] overflow-y-auto rounded-xl border bg-popover p-4 shadow-lg"
      style={{ top: position.top + 28, left: position.left }}
    >
      {skill.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          Explaining...
        </div>
      )}
      {skill.isError && <p className="text-sm text-destructive">Explanation unavailable.</p>}
      {skill.data && (
        <div className="space-y-2">
          <blockquote className="border-l-2 border-border pl-3 text-xs text-muted-foreground italic">
            {selectedText.length > 150 ? selectedText.slice(0, 150) + '...' : selectedText}
          </blockquote>
          <p className="text-sm leading-relaxed">{skill.data.output.improvedText}</p>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
