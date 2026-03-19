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

import { useCallback, useEffect, useRef, useState } from 'react';
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
// URL Input Popover — replaces window.prompt for link/image URL entry
// ---------------------------------------------------------------------------

interface URLInputPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  defaultValue?: string;
  placeholder?: string;
}

function URLInputPopover({
  isOpen,
  onClose,
  onSubmit,
  defaultValue = '',
  placeholder = 'Enter URL...',
}: URLInputPopoverProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value when popover opens with a new defaultValue
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Auto-focus after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(value);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleFocus = async () => {
    // Paste-to-fill: if the input is empty, try to auto-populate from clipboard
    if (!value) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && /^https?:\/\//.test(text.trim())) {
          setValue(text.trim());
        }
      } catch {
        // Clipboard access denied — silently ignore
      }
    }
  };

  return (
    <div className="absolute top-full left-0 mt-1 z-50 rounded-md border border-border bg-popover shadow-lg p-2">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="h-7 w-56 rounded-sm border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center justify-center h-7 px-2 rounded-sm bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition-colors"
        >
          OK
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insert menu (+ button dropdown)
// ---------------------------------------------------------------------------

interface InsertItem {
  icon: React.ReactNode;
  label: string;
  /** If set, the item opens a URL popover instead of running an immediate action. */
  usesPopover?: boolean;
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
    usesPopover: true,
    // action is a no-op here — the popover callback handles insertion
    action: () => {},
  },
  {
    icon: <Code className="h-3.5 w-3.5" />,
    label: 'Code Block',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

function InsertMenu({ editor, onImageInsert }: { editor: Editor; onImageInsert: () => void }) {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (item: InsertItem) => {
      if (item.usesPopover) {
        onImageInsert();
      } else {
        item.action(editor);
      }
      setOpen(false);
    },
    [editor, onImageInsert],
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
              onClick={() => handleSelect(item)}
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

type ActivePopover = 'link' | 'image' | null;

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  // Force re-render on editor state changes for active-state detection
  // We use editor.on in useEffect, but for simplicity Tiptap's React
  // hooks already trigger re-renders on transactions.

  const [activePopover, setActivePopover] = useState<ActivePopover>(null);

  const openLinkPopover = useCallback(() => {
    setActivePopover('link');
  }, []);

  const openImagePopover = useCallback(() => {
    setActivePopover('image');
  }, []);

  const closePopover = useCallback(() => {
    setActivePopover(null);
    editor.commands.focus();
  }, [editor]);

  const handleLinkSubmit = useCallback(
    (url: string) => {
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    },
    [editor],
  );

  const handleImageSubmit = useCallback(
    (url: string) => {
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
    [editor],
  );

  const linkDefaultValue =
    activePopover === 'link'
      ? ((editor.getAttributes('link').href as string | undefined) ?? '')
      : '';

  return (
    <div className="formatting-toolbar sticky top-0 z-10 flex items-center gap-0.5 px-3 py-1.5 bg-muted/30 border-b border-border/30 flex-wrap">
      {/* Inline formatting */}
      <ToolbarButton
        icon={<Bold className="h-3.5 w-3.5" />}
        label="Bold (Ctrl+B)"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<Italic className="h-3.5 w-3.5" />}
        label="Italic (Ctrl+I)"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<Strikethrough className="h-3.5 w-3.5" />}
        label="Strikethrough (Ctrl+Shift+X)"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <div className="relative">
        <ToolbarButton
          icon={<Link className="h-3.5 w-3.5" />}
          label="Link (Ctrl+K)"
          isActive={editor.isActive('link')}
          onClick={openLinkPopover}
        />
        <URLInputPopover
          isOpen={activePopover === 'link'}
          onClose={closePopover}
          onSubmit={handleLinkSubmit}
          defaultValue={linkDefaultValue}
          placeholder="Enter URL..."
        />
      </div>

      <Separator />

      {/* Headings */}
      <ToolbarButton
        icon={<Heading1 className="h-3.5 w-3.5" />}
        label="Heading 1 (Ctrl+Alt+1)"
        isActive={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={<Heading2 className="h-3.5 w-3.5" />}
        label="Heading 2 (Ctrl+Alt+2)"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={<Heading3 className="h-3.5 w-3.5" />}
        label="Heading 3 (Ctrl+Alt+3)"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Separator />

      {/* Lists */}
      <ToolbarButton
        icon={<List className="h-3.5 w-3.5" />}
        label="Bullet List (Ctrl+Shift+8)"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<ListOrdered className="h-3.5 w-3.5" />}
        label="Numbered List (Ctrl+Shift+7)"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={<CheckSquare className="h-3.5 w-3.5" />}
        label="Task List (Ctrl+Shift+9)"
        isActive={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />

      <Separator />

      {/* Block elements */}
      <ToolbarButton
        icon={<Quote className="h-3.5 w-3.5" />}
        label="Blockquote (Ctrl+Shift+B)"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <Separator />

      {/* Insert menu (includes code block, table, divider, image) */}
      <div className="relative">
        <InsertMenu editor={editor} onImageInsert={openImagePopover} />
        <URLInputPopover
          isOpen={activePopover === 'image'}
          onClose={closePopover}
          onSubmit={handleImageSubmit}
          placeholder="Enter image URL..."
        />
      </div>
    </div>
  );
}
