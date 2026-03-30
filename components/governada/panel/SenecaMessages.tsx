/**
 * SenecaMessages — Conversation message rendering for the Seneca panel.
 *
 * Includes:
 * - ConversationContent: Scrollable message list with navigation markers
 * - ShareInsightButton: Share insight to X/clipboard
 */

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Check, Microscope } from 'lucide-react';
import { CompassSigil } from '@/components/governada/CompassSigil';
import { AIResponse } from '@/components/commandpalette/AIResponse';
import type { ThreadMessage } from '@/stores/senecaThreadStore';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Heuristic: show "Go deeper" if response is substantive and query implies analysis
// ---------------------------------------------------------------------------

const DEEP_QUERY_RE = /\b(compare|analyz|research|explain|how|why|detail|assess)\b/i;
function shouldShowGoDeeper(content: string, query: string): boolean {
  return content.length >= 200 && !!query && DEEP_QUERY_RE.test(query);
}

// ---------------------------------------------------------------------------
// ConversationContent
// ---------------------------------------------------------------------------

export function ConversationContent({
  messages,
  onEntityFocus,
  routeChanged,
  routeLabel,
  accentColor,
  isStreaming,
  toolStatus,
  personaId,
  onStartResearch,
}: {
  messages: ThreadMessage[];
  onEntityFocus?: (entityType: string, entityId: string) => void;
  routeChanged: boolean;
  routeLabel: string;
  accentColor?: string;
  isStreaming: boolean;
  toolStatus: string | null;
  personaId?: string;
  onStartResearch?: (query: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Navigation marker when route changes during conversation */}
      {routeChanged && messages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] text-muted-foreground/40 shrink-0">
            Now viewing: {routeLabel}
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
      )}

      {messages.map((msg, idx) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end px-3 py-2">
              <div
                className={cn(
                  'max-w-[85%] px-3 py-1.5 rounded-2xl rounded-br-sm',
                  'bg-primary/15 text-foreground/90 text-sm leading-relaxed',
                )}
              >
                {msg.content}
              </div>
            </div>
          );
        }

        // Assistant message — last one may be actively streaming
        const isLastMsg = idx === messages.length - 1;
        const msgIsStreaming = isLastMsg && isStreaming;
        // Show share button on completed assistant messages with substantial content
        const showShare = !msgIsStreaming && msg.content.length > 80;
        // "Go deeper" — only on last completed assistant message
        const precedingUser = idx > 0 ? messages[idx - 1] : undefined;
        const userQuery = precedingUser?.role === 'user' ? precedingUser.content : '';
        const showGoDeeper =
          isLastMsg &&
          !isStreaming &&
          onStartResearch &&
          shouldShowGoDeeper(msg.content, userQuery);

        return (
          <div key={msg.id}>
            <div className="group flex gap-2 items-start px-3 py-2">
              <div className="shrink-0 mt-1">
                <CompassSigil
                  state={msgIsStreaming ? 'thinking' : 'idle'}
                  size={14}
                  accentColor={accentColor}
                />
              </div>
              <div className="flex-1 min-w-0">
                {/* 1C: Tool status — shown when tool executes before text arrives */}
                {msgIsStreaming && toolStatus && msg.content === '' ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-muted-foreground/50 animate-pulse"
                  >
                    {toolStatus}
                  </motion.span>
                ) : (
                  <AIResponse
                    content={msg.content}
                    isStreaming={msgIsStreaming}
                    onEntityFocus={onEntityFocus}
                  />
                )}

                {/* 3C: Share this insight */}
                {showShare && (
                  <ShareInsightButton content={msg.content} personaId={personaId} msgId={msg.id} />
                )}
              </div>
            </div>
            {showGoDeeper && (
              <div className="px-3 pb-2 pl-8">
                <button
                  type="button"
                  onClick={() => onStartResearch!(userQuery)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md',
                    'text-[11px] font-medium text-primary/80',
                    'bg-primary/5 hover:bg-primary/10 border border-primary/15 hover:border-primary/25',
                    'transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                >
                  <Microscope className="h-3 w-3" />
                  Go deeper
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShareInsightButton — generates shareable link with OG card
// ---------------------------------------------------------------------------

function ShareInsightButton({
  content,
  personaId,
  msgId,
}: {
  content: string;
  personaId?: string;
  msgId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    // Extract the first meaningful sentence as the quote for the OG card
    const quote = content
      .replace(/\*\*/g, '') // strip markdown bold
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip links
      .slice(0, 280);

    // Detect topic from content
    let topic = 'Governance Insight';
    if (/treasury|withdrawal|funding|budget/i.test(content)) topic = 'Treasury Analysis';
    else if (/proposal|governance action/i.test(content)) topic = 'Proposal Analysis';
    else if (/drep|representative|delegation/i.test(content)) topic = 'Representative Analysis';
    else if (/health|participation|quorum/i.test(content)) topic = 'Governance Health';

    // Build share URL for X/Twitter
    const shareText = `${quote.slice(0, 200)}${quote.length > 200 ? '...' : ''}\n\nvia @governada`;
    const shareUrl = `${window.location.origin}/pulse`;
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    // Try native share API first (mobile), fallback to copy + open X
    if (navigator.share) {
      void navigator.share({ title: 'Seneca Insight', text: quote, url: shareUrl });
    } else {
      void navigator.clipboard?.writeText(`${quote}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    }

    // PostHog analytics
    import('posthog-js')
      .then((mod) => mod.default.capture('seneca_insight_shared', { topic, persona: personaId }))
      .catch(() => {});
  }, [content, personaId, msgId]);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      onClick={handleShare}
      className={cn(
        'mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]',
        'text-muted-foreground/30 hover:text-muted-foreground/60',
        'hover:bg-white/[0.04] transition-colors',
        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
      )}
      aria-label="Share this insight"
    >
      {copied ? (
        <>
          <Check className="h-2.5 w-2.5" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Share2 className="h-2.5 w-2.5" />
          <span>Share insight</span>
        </>
      )}
    </motion.button>
  );
}
