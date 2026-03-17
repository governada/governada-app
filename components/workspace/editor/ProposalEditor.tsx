'use client';

/**
 * ProposalEditor — Tiptap-based governance proposal editor.
 *
 * Shell implementation (Phase 0C). Renders proposal sections as labeled blocks
 * with basic formatting. Custom extensions added in Phase 1A.
 */

import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import type { EditorMode, ProposalField } from '@/lib/workspace/editor/types';

interface ProposalEditorProps {
  /** Initial content per section */
  content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Editor mode */
  mode: EditorMode;
  /** Called when content changes (debounced save) */
  onContentChange?: (field: ProposalField, content: string) => void;
  /** Whether the editor is read-only (review mode) */
  readOnly?: boolean;
}

/** Section configuration */
const SECTIONS: Array<{
  field: ProposalField;
  label: string;
  placeholder: string;
  maxChars: number;
}> = [
  { field: 'title', label: 'Title', placeholder: 'Proposal title...', maxChars: 200 },
  {
    field: 'abstract',
    label: 'Abstract',
    placeholder: 'Brief summary of what this proposal does...',
    maxChars: 2000,
  },
  {
    field: 'motivation',
    label: 'Motivation',
    placeholder: 'Why is this proposal needed? What problem does it solve?',
    maxChars: 10000,
  },
  {
    field: 'rationale',
    label: 'Rationale',
    placeholder: 'Why is this the right approach? Why should DReps vote Yes?',
    maxChars: 10000,
  },
];

/**
 * Individual section editor — one Tiptap instance per proposal section.
 *
 * Using one editor per section (vs. one editor for the whole document) because:
 * 1. Each section has different character limits
 * 2. Sections are independently saveable (existing auto-save pattern)
 * 3. Custom extensions (AIDiff, comments) anchor to specific sections
 * 4. Diff mode compares per-section
 */
function SectionEditor({
  field,
  label,
  placeholder,
  maxChars,
  initialContent,
  readOnly,
  onContentChange,
}: {
  field: ProposalField;
  label: string;
  placeholder: string;
  maxChars: number;
  initialContent: string;
  readOnly: boolean;
  onContentChange?: (field: ProposalField, content: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Proposals use section labels, not headings
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxChars }),
    ],
    content: initialContent || '',
    editable: !readOnly,
    onBlur: ({ editor: e }) => {
      onContentChange?.(field, e.getText());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60px] px-4 py-3',
      },
    },
  });

  // Sync readOnly
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  return (
    <div className="border border-border/50 rounded-lg bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/30">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            charCount > maxChars * 0.9
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground/60'
          }`}
        >
          {charCount.toLocaleString()} / {maxChars.toLocaleString()}
        </span>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}

export function ProposalEditor({
  content,
  mode,
  onContentChange,
  readOnly = false,
}: ProposalEditorProps) {
  const isReadOnly = readOnly || mode === 'review';

  const handleContentChange = useCallback(
    (field: ProposalField, text: string) => {
      if (!isReadOnly) onContentChange?.(field, text);
    },
    [isReadOnly, onContentChange],
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      {SECTIONS.map(({ field, label, placeholder, maxChars }) => (
        <SectionEditor
          key={field}
          field={field}
          label={label}
          placeholder={placeholder}
          maxChars={maxChars}
          initialContent={content[field]}
          readOnly={isReadOnly}
          onContentChange={handleContentChange}
        />
      ))}
    </div>
  );
}
