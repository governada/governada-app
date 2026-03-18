'use client';

/**
 * FormattingToolbar — compact horizontal toolbar above the editor content.
 *
 * Groups: Inline (B/I/S/Link) | Headings (H1/H2/H3) | Lists (bullet/ordered/task) |
 * Blocks (quote/code/table/divider)
 *
 * Active state detection highlights buttons matching the current cursor context.
 * Rendered sticky so it stays visible when scrolling long proposal content.
 */

import { useCallback, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Link,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Table,
  Minus,
  Plus,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormattingToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Button component
// ---------------------------------------------------------------------------

function ToolbarButton({ icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={`inline-flex items-center justify-center h-7 w-7 rounded text-xs transition-colors ${
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-4 bg-border/50 mx-0.5" />;
}

// ---------------------------------------------------------------------------
// Insert menu (+ button dropdown)
// ---------------------------------------------------------------------------

interface InsertItem {
  icon: React.ReactNode;
  label: string;
  action: (editor: Editor) => void;
}

const INSERT_ITEMS: InsertItem[] = [
  {
    icon: <Table className="h-3.5 w-3.5" />,
    label: 'Table',
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    icon: <Minus className="h-3.5 w-3.5" />,
    label: 'Divider',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    label: 'Image',
    action: (editor) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    icon: <Code className="h-3.5 w-3.5" />,
    label: 'Code Block',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

function InsertMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (action: (editor: Editor) => void) => {
      action(editor);
      setOpen(false);
    },
    [editor],
  );

  return (
    <div className="relative">
      <ToolbarButton
        icon={open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        label="Insert block"
        onClick={handleToggle}
      />
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-md border border-border bg-popover shadow-lg py-1">
          {INSERT_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSelect(item.action)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-foreground hover:bg-accent/50 transition-colors"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar component
// ---------------------------------------------------------------------------

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  // Force re-render on editor state changes for active-state detection
  // We use editor.on in useEffect, but for simplicity Tiptap's React
  // hooks already trigger re-renders on transactions.

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', previousUrl ?? '');

    if (url === null) return; // Cancelled

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="formatting-toolbar sticky top-0 z-10 flex items-center gap-0.5 px-3 py-1.5 bg-muted/30 border-b border-border/30 flex-wrap">
      {/* Inline formatting */}
      <ToolbarButton
        icon={<Bold className="h-3.5 w-3.5" />}
        label="Bold"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<Italic className="h-3.5 w-3.5" />}
        label="Italic"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<Strikethrough className="h-3.5 w-3.5" />}
        label="Strikethrough"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        icon={<Link className="h-3.5 w-3.5" />}
        label="Link"
        isActive={editor.isActive('link')}
        onClick={setLink}
      />

      <Separator />

      {/* Headings */}
      <ToolbarButton
        icon={<Heading1 className="h-3.5 w-3.5" />}
        label="Heading 1"
        isActive={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={<Heading2 className="h-3.5 w-3.5" />}
        label="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={<Heading3 className="h-3.5 w-3.5" />}
        label="Heading 3"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Separator />

      {/* Lists */}
      <ToolbarButton
        icon={<List className="h-3.5 w-3.5" />}
        label="Bullet List"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<ListOrdered className="h-3.5 w-3.5" />}
        label="Numbered List"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={<CheckSquare className="h-3.5 w-3.5" />}
        label="Task List"
        isActive={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />

      <Separator />

      {/* Block elements */}
      <ToolbarButton
        icon={<Quote className="h-3.5 w-3.5" />}
        label="Blockquote"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={<Code className="h-3.5 w-3.5" />}
        label="Code Block"
        isActive={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />

      <Separator />

      {/* Insert menu */}
      <InsertMenu editor={editor} />
    </div>
  );
}
