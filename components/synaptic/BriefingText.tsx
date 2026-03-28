'use client';

import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BriefingTextProps {
  /** Full content received so far from the stream */
  content: string;
  isStreaming: boolean;
  error?: string | null;
}

// Typewriter reveal speed: ms per character
const CHAR_DELAY = 18;

/**
 * Streaming text renderer with typewriter effect.
 *
 * Buffers incoming SSE chunks and reveals characters one-by-one
 * so Seneca appears to be typing in real-time, not dumping text.
 */
export const BriefingText = memo(function BriefingText({
  content,
  isStreaming,
  error,
}: BriefingTextProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Typewriter: reveal characters gradually
  useEffect(() => {
    if (revealedCount >= content.length && !isStreaming) {
      // All caught up and stream is done
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (revealedCount < content.length && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setRevealedCount((prev) => {
          const next = Math.min(prev + 1, content.length);
          if (next >= content.length) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          return next;
        });
      }, CHAR_DELAY);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content.length, revealedCount, isStreaming]);

  // Reset revealed count when content resets (new briefing)
  useEffect(() => {
    if (content.length === 0) setRevealedCount(0);
  }, [content.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Strip leaked internal markers before rendering
  const sanitized = content
    .replace(/\[\[action:[^\]]*\]\]/g, '')
    .replace(/\[\[globe:[^\]]*\]\]/g, '')
    .replace(/\[\[chip:[^\]]*\]\]/g, '');
  const visibleText = sanitized.slice(0, Math.min(revealedCount, sanitized.length));
  const isRevealing = revealedCount < sanitized.length;
  const rendered = useMemo(
    () => renderBriefingMarkdown(visibleText, router),
    [visibleText, router],
  );

  if (error) {
    return <p className="text-sm text-red-400/80 italic">{error}</p>;
  }

  if (!content && isStreaming) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Seneca is thinking...</span>
      </div>
    );
  }

  return (
    <div
      className="text-sm text-foreground/90 leading-relaxed space-y-1.5"
      role="log"
      aria-live="polite"
    >
      {rendered}
      {(isStreaming || isRevealing) && (
        <span className="inline-block w-1.5 h-4 bg-compass-teal/60 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Entity link patterns
// ---------------------------------------------------------------------------

// Match [DRep: Name](/path) or [Proposal: Title](/path)
const ENTITY_LINK_RE = /\[(DRep|Proposal):\s*([^\]]+)\]\(([^)]+)\)/g;
// Match **bold text**
const BOLD_RE = /(\*\*[^*]+\*\*)/g;

/**
 * Render briefing markdown with entity inline links.
 * Entity references become clickable spans with hover effect.
 */
function renderBriefingMarkdown(
  text: string,
  router: ReturnType<typeof useRouter>,
): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // First pass: extract entity links
    const segments: Array<{
      type: 'text' | 'entity';
      content: string;
      href?: string;
      label?: string;
      entityType?: string;
    }> = [];
    let lastIdx = 0;
    ENTITY_LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ENTITY_LINK_RE.exec(line)) !== null) {
      if (match.index > lastIdx) {
        segments.push({ type: 'text', content: line.slice(lastIdx, match.index) });
      }
      segments.push({
        type: 'entity',
        content: match[2],
        href: match[3],
        label: match[1],
        entityType: match[1].toLowerCase(),
      });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) {
      segments.push({ type: 'text', content: line.slice(lastIdx) });
    }

    // Second pass: render each segment with bold support
    const spans = segments.map((seg, j) => {
      if (seg.type === 'entity') {
        return (
          <button
            key={j}
            onClick={() => seg.href && router.push(seg.href)}
            className="inline text-compass-teal hover:text-compass-teal/80 font-medium
              underline decoration-compass-teal/30 underline-offset-2
              hover:decoration-compass-teal/60 transition-colors cursor-pointer"
            title={`View ${seg.label}: ${seg.content}`}
          >
            {seg.content}
          </button>
        );
      }

      // Text segment — apply bold formatting
      const parts = seg.content.split(BOLD_RE);
      return parts.map((part, k) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={`${j}-${k}`} className="text-foreground font-medium">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${j}-${k}`}>{part}</span>;
      });
    });

    elements.push(
      <p key={i} className="text-sm">
        {spans}
      </p>,
    );
  }

  return elements;
}
