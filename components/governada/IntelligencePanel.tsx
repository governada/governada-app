'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIntelligencePanel } from '@/hooks/useIntelligencePanel';
import { ReadinessSignal } from './panel/ReadinessSignal';
import { PanelRouter } from './panel/PanelRouter';
import { SenecaInput } from './panel/SenecaInput';
import { SenecaConversation } from './panel/SenecaConversation';
import { SenecaResearch } from './panel/SenecaResearch';
import { SenecaMatch } from './panel/SenecaMatch';
import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

interface IntelligencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  panelWidth: number;
  /** Called when user clicks an entity link in a Seneca response */
  onEntityFocus?: (entityType: string, entityId: string) => void;
  /** Called to execute globe commands from Seneca match flow */
  onGlobeCommand?: (cmd: GlobeCommand) => void;
}

export function IntelligencePanel({
  isOpen,
  onClose,
  panelWidth,
  onEntityFocus,
  onGlobeCommand,
}: IntelligencePanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const { panelRoute, entityId, mode, pendingQuery, startConversation, returnToBriefing } =
    useIntelligencePanel();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={prefersReducedMotion ? { opacity: 0 } : { x: panelWidth, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { x: panelWidth, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            'fixed top-10 bottom-0 right-0 z-30',
            'bg-background/60 backdrop-blur-xl',
            'border-l border-border/20',
            'flex flex-col',
            'overflow-hidden',
          )}
          style={{ width: panelWidth }}
          role="complementary"
          aria-label="Governance intelligence panel"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/10 shrink-0">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary/70" aria-hidden="true" />
              <h2 className="text-xs font-semibold text-foreground/80">Seneca</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded-md',
                'text-muted-foreground/60 hover:text-foreground hover:bg-accent/30',
                'transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              aria-label="Close intelligence panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {mode === 'matching' ? (
            <SenecaMatch onBack={returnToBriefing} onGlobeCommand={onGlobeCommand} />
          ) : mode === 'research' && pendingQuery ? (
            <SenecaResearch question={pendingQuery} onBack={returnToBriefing} />
          ) : mode === 'conversation' ? (
            <SenecaConversation
              initialQuery={pendingQuery}
              onBack={returnToBriefing}
              panelRoute={panelRoute}
              entityId={entityId}
              onEntityFocus={onEntityFocus}
            />
          ) : (
            <>
              {/* Governance Readiness Signal */}
              <ReadinessSignal />

              {/* Scrollable panel content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent">
                <PanelRouter panelRoute={panelRoute} entityId={entityId} />
              </div>

              {/* Seneca input */}
              <SenecaInput panelRoute={panelRoute} onSubmit={(query) => startConversation(query)} />

              {/* Panel footer */}
              <div className="shrink-0 border-t border-border/10 px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground/40 text-center">
                  Press{' '}
                  <kbd className="px-1 py-0.5 rounded bg-muted/30 text-muted-foreground/50 text-[9px] font-mono">
                    ]
                  </kbd>{' '}
                  to toggle &middot; Type to ask Seneca
                </p>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
