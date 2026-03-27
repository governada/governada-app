'use client';

import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelRoute } from '@/hooks/useSenecaThread';

const GHOST_PROMPTS: Record<string, string> = {
  hub: 'What should I know about governance today?',
  proposal: 'Ask about this proposal...',
  drep: 'Ask about this representative...',
  workspace: 'How can I help with your work?',
};

function getPlaceholder(route: PanelRoute): string {
  return GHOST_PROMPTS[route] ?? 'Ask Seneca anything about governance...';
}

interface SenecaInputProps {
  panelRoute: PanelRoute;
  onSubmit: (query: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SenecaInput({ panelRoute, onSubmit, disabled, className }: SenecaInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
      setValue('');
    },
    [value, disabled, onSubmit],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setValue('');
      inputRef.current?.blur();
    }
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'shrink-0 border-t border-border/20',
        'flex items-center gap-1.5 px-3 py-2',
        'bg-background/40 backdrop-blur-sm',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder(panelRoute)}
        disabled={disabled}
        className={cn(
          'flex-1 bg-transparent text-sm outline-none min-w-0',
          'placeholder:text-muted-foreground/40 placeholder:text-xs',
          'disabled:opacity-50',
        )}
        aria-label="Ask Seneca"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className={cn(
          'p-1.5 rounded-md transition-colors shrink-0',
          'text-muted-foreground/50 hover:text-primary hover:bg-primary/10',
          'disabled:opacity-20 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
        aria-label="Send message"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
