'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useSynapticStore } from '@/stores/synapticStore';
import { useSenecaThreadStore, isMatchIntent } from '@/stores/senecaThreadStore';
import { readAdvisorStream } from '@/lib/intelligence/streamAdvisor';
import type { GlobeStreamCommand } from '@/lib/intelligence/streamAdvisor';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useEpochContext } from '@/hooks/useEpochContext';
import { BriefingText } from './BriefingText';
import { BriefingChips } from './BriefingChips';
import { SenecaInput } from '@/components/governada/panel/SenecaInput';
import { cn } from '@/lib/utils';

const SenecaMatch = dynamic(
  () =>
    import('@/components/governada/panel/SenecaMatch').then((m) => ({ default: m.SenecaMatch })),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Default follow-up chips per persona (fallback if AI doesn't generate them)
// ---------------------------------------------------------------------------

const DEFAULT_CHIPS: Record<string, string[]> = {
  citizen: ['Find my DRep match', 'What proposals matter to me?', "How's my DRep doing?"],
  drep: ['Show pending votes', 'How do I compare?', "What's my delegation trend?"],
  spo: ['Check my governance score', "Show my pool's activity", 'Compare with peers'],
  cc: ['Show recent votes', 'Constitutional alignment check', 'Inter-body dynamics'],
};

// ---------------------------------------------------------------------------
// Chip marker parsing
// ---------------------------------------------------------------------------

const CHIP_RE = /\[\[chip:([^\]]+)\]\]/g;

function extractChips(text: string): { cleanText: string; chips: string[] } {
  const chips: string[] = [];
  const cleanText = text.replace(CHIP_RE, (_, chipText: string) => {
    chips.push(chipText.trim());
    return '';
  });
  return { cleanText: cleanText.trim(), chips };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SynapticBriefPanelProps {
  onGlobeCommand?: (command: GlobeStreamCommand) => void;
  onFilterChange?: (filter: string | null) => void;
  className?: string;
}

export function SynapticBriefPanel({
  onGlobeCommand,
  onFilterChange,
  className,
}: SynapticBriefPanelProps) {
  const { segment } = useSegment();
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const daysRemaining = totalDays - day;

  // Match mode — when Seneca triggers a match flow, render SenecaMatch in place of briefing
  const senecaMode = useSenecaThreadStore((s) => s.mode);
  const returnToIdle = useSenecaThreadStore((s) => s.returnToIdle);

  const store = useSynapticStore();
  const abortRef = useRef<AbortController | null>(null);
  const hasStarted = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [conversationMessages, setConversationMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [conversationStreaming, setConversationStreaming] = useState(false);
  const [conversationText, setConversationText] = useState('');

  // -------------------------------------------------------------------------
  // Auto-start briefing on mount (1.5s delay for globe to settle)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (hasStarted.current || segment === 'anonymous') return;
    const timer = setTimeout(() => {
      if (hasStarted.current) return;
      hasStarted.current = true;
      startBriefing();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Briefing stream
  // -------------------------------------------------------------------------
  const startBriefing = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    store.startBriefing();
    let accumulated = '';

    readAdvisorStream(
      [{ role: 'user', content: 'Brief me on governance. Keep it to 2-3 sentences.' }],
      {
        epoch: epoch ?? 0,
        daysRemaining,
        activeProposalCount: activeProposalCount ?? 0,
        segment: segment ?? 'citizen',
        mode: 'briefing',
      },
      // onDelta
      (text) => {
        accumulated += text;
        store.appendText(text);
      },
      // onError
      (error) => {
        store.setError(error);
      },
      // onDone
      () => {
        const { cleanText, chips } = extractChips(accumulated);
        if (chips.length > 0) {
          // Re-set the text without chip markers
          useSynapticStore.setState({ briefingText: cleanText });
          store.setChips(chips);
        } else {
          // Use persona-specific defaults
          store.setChips(DEFAULT_CHIPS[segment ?? 'citizen'] ?? DEFAULT_CHIPS.citizen);
        }
        store.finishBriefing();
      },
      controller.signal,
      onGlobeCommand,
    );
  }, [epoch, daysRemaining, activeProposalCount, segment, store, onGlobeCommand]);

  // -------------------------------------------------------------------------
  // Follow-up conversation
  // -------------------------------------------------------------------------
  const handleFollowUp = useCallback(
    (query: string) => {
      // Intercept match intents — launch the quiz directly instead of hitting the AI
      if (isMatchIntent(query)) {
        useSenecaThreadStore.getState().startMatch();
        return;
      }

      store.startConversation();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        // Include the original briefing context
        { role: 'assistant', content: store.briefingText },
        ...conversationMessages,
        { role: 'user', content: query },
      ];

      setConversationMessages((prev) => [...prev, { role: 'user', content: query }]);
      setConversationStreaming(true);
      setConversationText('');

      readAdvisorStream(
        messages,
        {
          epoch: epoch ?? 0,
          daysRemaining,
          activeProposalCount: activeProposalCount ?? 0,
          segment: segment ?? 'citizen',
          mode: 'conversation',
        },
        (text) => {
          setConversationText((prev) => prev + text);
        },
        (error) => {
          setConversationText(`Error: ${error}`);
          setConversationStreaming(false);
        },
        () => {
          setConversationStreaming(false);
          setConversationText((finalText) => {
            setConversationMessages((prev) => [...prev, { role: 'assistant', content: finalText }]);
            return finalText;
          });
        },
        controller.signal,
        onGlobeCommand,
        (actionPayload) => {
          const colonIdx = actionPayload.indexOf(':');
          const actionType = colonIdx > 0 ? actionPayload.slice(0, colonIdx) : actionPayload;

          if (actionType === 'startMatch') {
            controller.abort();
            setConversationStreaming(false);
            useSenecaThreadStore.getState().startMatch();
          }
        },
      );
    },
    [
      store,
      conversationMessages,
      epoch,
      daysRemaining,
      activeProposalCount,
      segment,
      onGlobeCommand,
    ],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Don't show for anonymous users
  if (segment === 'anonymous') return null;

  // ── Match mode: replace briefing panel with SenecaMatch quiz ──
  if (senecaMode === 'matching') {
    return (
      <motion.div
        key="synaptic-match-panel"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed bottom-6 left-6 z-50',
          'w-[min(440px,calc(100vw-3rem))]',
          'max-h-[70vh]',
          'backdrop-blur-xl bg-background/50 border border-white/5',
          'rounded-2xl shadow-2xl shadow-black/40',
          'flex flex-col overflow-hidden',
          'max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full',
          'max-md:rounded-b-none max-md:rounded-t-xl',
          'max-md:max-h-[70vh] max-md:backdrop-blur-none max-md:bg-background/90',
          className,
        )}
      >
        <SenecaMatch onBack={returnToIdle} />
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {store.phase !== 'minimized' ? (
        <motion.div
          ref={panelRef}
          key="synaptic-panel"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            // Desktop: fixed bottom-left panel
            'fixed bottom-6 left-6 z-50',
            'w-[min(440px,calc(100vw-3rem))]',
            store.phase === 'conversation' ? 'max-h-[60vh]' : 'max-h-[30vh]',
            'backdrop-blur-xl bg-background/50 border border-white/5',
            'rounded-2xl shadow-2xl shadow-black/40',
            'flex flex-col overflow-hidden',
            'transition-[max-height] duration-300',
            // Mobile: full-width bottom card, no backdrop-blur for performance
            'max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full',
            'max-md:rounded-b-none max-md:rounded-t-xl',
            'max-md:max-h-[50vh] max-md:backdrop-blur-none max-md:bg-background/90',
            className,
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-compass-teal animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">Seneca</span>
            </div>
            <button
              onClick={store.minimize}
              className="p-1 rounded hover:bg-white/5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Minimize briefing"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
            {/* Briefing text */}
            <BriefingText
              content={store.briefingText}
              isStreaming={store.isStreaming}
              error={store.error}
            />

            {/* Discovery chips — always visible after briefing completes */}
            {!store.isStreaming && store.phase === 'briefing' && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: 'Browse Proposals', filter: 'proposals' },
                  { label: 'Find a DRep', filter: 'dreps' },
                  { label: 'Pool Rankings', filter: 'spos' },
                ].map((item) => (
                  <button
                    key={item.filter}
                    onClick={() => onFilterChange?.(item.filter)}
                    className="px-2.5 py-1 text-xs rounded-full border border-compass-teal/20 text-compass-teal/80 hover:bg-compass-teal/10 hover:text-compass-teal transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    useSenecaThreadStore.getState().startMatch();
                  }}
                  className="px-2.5 py-1 text-xs rounded-full border border-amber-500/20 text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                >
                  Find my match
                </button>
              </div>
            )}

            {/* Follow-up chips (shown after briefing completes) */}
            {!store.isStreaming && store.phase === 'briefing' && (
              <BriefingChips chips={store.chips} onChipClick={handleFollowUp} />
            )}

            {/* Conversation messages */}
            {store.phase === 'conversation' && conversationMessages.length > 0 && (
              <div className="space-y-3 mt-3 pt-3 border-t border-white/5">
                {conversationMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn('text-sm', msg.role === 'user' && 'text-compass-teal/80')}
                  >
                    {msg.role === 'user' ? (
                      <p className="font-medium">{msg.content}</p>
                    ) : (
                      <BriefingText content={msg.content} isStreaming={false} />
                    )}
                  </div>
                ))}
                {conversationStreaming && <BriefingText content={conversationText} isStreaming />}
              </div>
            )}
          </div>

          {/* Input (conversation mode) */}
          {store.phase === 'conversation' && (
            <SenecaInput
              panelRoute="hub"
              onSubmit={handleFollowUp}
              disabled={conversationStreaming}
              className="rounded-b-2xl"
            />
          )}
        </motion.div>
      ) : (
        /* Minimized state: small pill to restore */
        <motion.button
          key="synaptic-pill"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          onClick={store.restore}
          className="fixed bottom-6 left-6 z-50
            flex items-center gap-2 px-4 py-2
            backdrop-blur-xl bg-background/50 border border-white/5
            rounded-full shadow-lg shadow-black/30
            text-xs text-muted-foreground hover:text-foreground
            hover:bg-background/60 transition-colors
            max-md:bottom-4 max-md:left-4"
          aria-label="Open Seneca briefing"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Seneca</span>
          <ChevronUp className="h-3 w-3" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
