'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check } from 'lucide-react';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useGovernadaSound } from '@/hooks/useGovernadaSound';
import { cn } from '@/lib/utils';
import type { ActionRailItem } from '@/lib/cockpit/types';

// ---------------------------------------------------------------------------
// Priority pip colors
// ---------------------------------------------------------------------------

const PRIORITY_PIP: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-muted-foreground',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActionRailCardProps {
  item: ActionRailItem;
  index: number;
  isCompleting?: boolean;
}

export function ActionRailCard({ item, index, isCompleting = false }: ActionRailCardProps) {
  const router = useRouter();
  const setHoveredNode = useCockpitStore((s) => s.setHoveredNode);
  const { playClick } = useGovernadaSound();

  const handleMouseEnter = useCallback(() => {
    if (item.globeNodeId) {
      // Dispatch globe fly-to command
      window.dispatchEvent(
        new CustomEvent('senecaGlobeCommand', {
          detail: { type: 'flyTo', nodeId: item.globeNodeId },
        }),
      );
      setHoveredNode(item.globeNodeId);
    }
  }, [item.globeNodeId, setHoveredNode]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const handleClick = useCallback(() => {
    playClick();
    router.push(item.href);
  }, [router, item.href, playClick]);

  return (
    <AnimatePresence mode="popLayout">
      {!isCompleting ? (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            delay: index * 0.2,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label={`${item.priority} priority: ${item.title}. ${item.actionLabel}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          className={cn(
            'w-64 cursor-pointer rounded-lg border border-white/10',
            'bg-black/50 backdrop-blur-md',
            'px-3 py-2.5 transition-colors duration-200',
            'hover:border-white/20 hover:bg-black/60',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-compass-teal/50',
          )}
        >
          {/* Row 1: Priority pip + title */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                PRIORITY_PIP[item.priority] ?? PRIORITY_PIP.low,
                item.priority === 'urgent' && 'animate-pulse',
              )}
            />
            <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
          </div>

          {/* Row 2: Subtitle */}
          {item.subtitle && (
            <p className="mt-1 truncate pl-4 text-xs text-muted-foreground">{item.subtitle}</p>
          )}

          {/* Row 3: Deadline + action button */}
          <div className="mt-1.5 flex items-center justify-between pl-4">
            {item.deadline ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                <Clock className="h-3 w-3" />
                {item.deadline}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs font-medium text-compass-teal">{item.actionLabel}</span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key={`${item.id}-completing`}
          layout
          initial={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          animate={{
            backgroundColor: 'rgba(34,197,94,0.2)',
            x: -60,
            opacity: 0,
          }}
          transition={{
            backgroundColor: { duration: 0.3 },
            x: { delay: 1.5, duration: 0.4 },
            opacity: { delay: 1.5, duration: 0.4 },
          }}
          className={cn(
            'w-64 rounded-lg border border-green-500/30',
            'backdrop-blur-md px-3 py-2.5',
          )}
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            <span className="truncate text-sm font-medium text-green-400">{item.title}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
