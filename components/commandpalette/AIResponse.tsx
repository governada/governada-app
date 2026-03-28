'use client';

/**
 * AIResponse — Rich AI response renderer for the command palette.
 *
 * Renders streaming markdown-like content with:
 * - Entity links (proposals, DReps) as clickable cards
 * - Bold text, bullet points, inline formatting
 * - Typing indicator during streaming
 * - Error state handling
 */

import { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, FileText, User, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIResponseProps {
  /** The response content (may be partial during streaming) */
  content: string;
  /** Whether the response is still streaming */
  isStreaming: boolean;
  /** Error message if the response failed */
  error?: string;
  /** Called when user clicks an entity link, with entity type and id */
  onEntityFocus?: (entityType: string, entityId: string) => void;
}

// ---------------------------------------------------------------------------
// Entity link parsing
// ---------------------------------------------------------------------------

interface ParsedSegment {
  type: 'text' | 'proposal_link' | 'drep_link';
  text: string;
  href?: string;
  label?: string;
}

function parseEntityLinks(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  // Match [Proposal: <title>](/governance/proposals/<hash>#<index>) and [DRep: <name>](/governance/dreps/<id>)
  const entityPattern = /\[(Proposal|DRep):\s*([^\]]+)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = entityPattern.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    const entityType = match[1].toLowerCase() as 'proposal' | 'drep';
    segments.push({
      type: entityType === 'proposal' ? 'proposal_link' : 'drep_link',
      text: match[2],
      href: match[3],
      label: match[1],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Entity Card component
// ---------------------------------------------------------------------------

function EntityCard({
  type,
  label,
  href,
  onClick,
  onEntityFocus,
}: {
  type: 'proposal_link' | 'drep_link';
  label: string;
  href: string;
  onClick: (href: string) => void;
  onEntityFocus?: (entityType: string, entityId: string) => void;
}) {
  const Icon = type === 'proposal_link' ? FileText : User;
  const typeLabel = type === 'proposal_link' ? 'Proposal' : 'DRep';

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Extract entity ID from href and notify globe bridge
        if (onEntityFocus) {
          const entityType = type === 'drep_link' ? 'drep' : 'proposal';
          // Extract ID from paths like /drep/<id> or /governance/proposals/<hash>#<index>
          const segments = href.split('/').filter(Boolean);
          const entityId = segments[segments.length - 1]?.split('#')[0] ?? '';
          if (entityId) {
            onEntityFocus(entityType, entityId);
          }
        }
        onClick(href);
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
        'bg-primary/10 hover:bg-primary/20 text-primary',
        'text-xs font-medium transition-colors cursor-pointer',
        'border border-primary/20 hover:border-primary/30',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[200px]">{label}</span>
      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
      <span className="sr-only">View {typeLabel}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Text renderer with inline formatting
// ---------------------------------------------------------------------------

function FormattedText({
  content,
  onNavigate,
  onEntityFocus,
}: {
  content: string;
  onNavigate: (href: string) => void;
  onEntityFocus?: (entityType: string, entityId: string) => void;
}) {
  const segments = useMemo(() => parseEntityLinks(content), [content]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          // Apply basic inline formatting: **bold**, *italic*
          return <InlineFormatted key={i} text={seg.text} />;
        }

        return (
          <EntityCard
            key={i}
            type={seg.type}
            label={seg.text}
            href={seg.href ?? '#'}
            onClick={onNavigate}
            onEntityFocus={onEntityFocus}
          />
        );
      })}
    </>
  );
}

function InlineFormatted({ text }: { text: string }) {
  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main AIResponse component
// ---------------------------------------------------------------------------

export const AIResponse = memo(function AIResponse({
  content,
  isStreaming,
  error,
  onEntityFocus,
}: AIResponseProps) {
  const router = useRouter();

  const handleNavigate = (href: string) => {
    // Dispatch event to close command palette before navigating
    window.dispatchEvent(new CustomEvent('closeCommandPalette'));
    router.push(href);
  };

  if (error) {
    return (
      <div className="flex items-start gap-2 px-3 py-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (!content && isStreaming) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Thinking about your governance question...</span>
      </div>
    );
  }

  if (!content) return null;

  // Strip any leaked internal markers before rendering
  const cleaned = content
    .replace(/\[\[action:[^\]]*\]\]/g, '')
    .replace(/\[\[globe:[^\]]*\]\]/g, '')
    .replace(/\[\[chip:[^\]]*\]\]/g, '')
    .trim();

  if (!cleaned) return null;

  // Split content into lines for rendering
  const lines = cleaned.split('\n');

  return (
    <div className="px-3 py-3 space-y-1.5">
      {/* AI indicator */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        <Bot className="h-3 w-3" />
        <span>Governance Advisor</span>
        {isStreaming && <Loader2 className="h-2.5 w-2.5 animate-spin ml-1" />}
      </div>

      {/* Response content */}
      <div className="text-sm text-foreground/90 leading-relaxed space-y-1">
        {lines.map((line, i) => {
          const trimmed = line.trim();

          // Empty line = paragraph break
          if (!trimmed) {
            return <div key={i} className="h-1" />;
          }

          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} className="flex gap-2 pl-2">
                <span className="text-muted-foreground shrink-0 select-none">&bull;</span>
                <span>
                  <FormattedText
                    content={trimmed.slice(2)}
                    onNavigate={handleNavigate}
                    onEntityFocus={onEntityFocus}
                  />
                </span>
              </div>
            );
          }

          // Numbered lists
          const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
          if (numberedMatch) {
            return (
              <div key={i} className="flex gap-2 pl-2">
                <span className="text-muted-foreground shrink-0 select-none font-mono text-xs min-w-[1rem] text-right">
                  {numberedMatch[1]}.
                </span>
                <span>
                  <FormattedText
                    content={numberedMatch[2]}
                    onNavigate={handleNavigate}
                    onEntityFocus={onEntityFocus}
                  />
                </span>
              </div>
            );
          }

          // Regular text
          return (
            <p key={i}>
              <FormattedText
                content={trimmed}
                onNavigate={handleNavigate}
                onEntityFocus={onEntityFocus}
              />
            </p>
          );
        })}
      </div>

      {/* Streaming cursor */}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse rounded-sm" />
      )}
    </div>
  );
});
