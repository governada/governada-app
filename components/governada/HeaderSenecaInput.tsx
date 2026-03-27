'use client';

import { useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Compass, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSenecaThread } from '@/hooks/useSenecaThread';
import { useTranslation } from '@/lib/i18n/useTranslation';

/** Route-aware placeholder text for the Seneca prompt. */
function getPlaceholder(pathname: string, t: (key: string) => string): string {
  if (pathname.startsWith('/proposal/')) return t('Ask about this proposal...');
  if (pathname.startsWith('/drep/')) return t('Ask about this representative...');
  if (pathname.startsWith('/pool/')) return t('Ask about this pool...');
  if (pathname.startsWith('/governance/treasury')) return t('Ask about the treasury...');
  if (pathname.startsWith('/governance')) return t('Explore governance...');
  if (pathname.startsWith('/workspace')) return t('Ask about your work...');
  return t('Ask Seneca anything...');
}

interface HeaderSenecaInputProps {
  /** When true, collapse to just the Compass icon */
  compact?: boolean;
  className?: string;
}

/**
 * Inline Seneca prompt that lives in the header.
 * Typing opens the Seneca right panel in conversation mode.
 * Cmd+K remains separate for navigation via command palette.
 */
export function HeaderSenecaInput({ compact = false, className }: HeaderSenecaInputProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const panel = useSenecaThread();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      panel.startConversation(trimmed);
      setQuery('');
      inputRef.current?.blur();
    },
    [query, panel],
  );

  // Compact mode: just show the Compass icon button
  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'flex items-center justify-center h-8 w-8 rounded-full transition-colors',
          panel.isOpen
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          className,
        )}
        onClick={() => panel.toggle()}
        aria-label={panel.isOpen ? t('Close Seneca') : t('Open Seneca')}
        aria-pressed={panel.isOpen}
      >
        <Compass className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'hidden lg:flex items-center gap-2 h-8 px-3 rounded-full transition-all',
        'border border-border/20 bg-background/20 backdrop-blur-sm',
        'hover:border-border/40 hover:bg-background/30',
        'focus-within:border-primary/40 focus-within:bg-background/30 focus-within:ring-1 focus-within:ring-primary/20',
        'min-w-[200px] max-w-[320px] flex-1',
        className,
      )}
    >
      <Compass
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-colors',
          panel.isOpen ? 'text-primary' : 'text-muted-foreground/60',
        )}
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={getPlaceholder(pathname, t)}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQuery('');
            inputRef.current?.blur();
          }
        }}
      />
      {query.trim() && (
        <button
          type="submit"
          className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors shrink-0"
          aria-label={t('Send to Seneca')}
        >
          <ArrowUp className="h-3 w-3" />
        </button>
      )}
    </form>
  );
}
