'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Users, TrendingUp, Compass, Globe, User, Clock, Shield, X } from 'lucide-react';
import { useActionQueue } from '@/hooks/useActionQueue';
import type { ActionItem } from '@/lib/actionQueue';

interface ActionDockProps {
  urgencyLevel: 'calm' | 'active' | 'critical';
  className?: string;
}

const ICON_MAP: Record<ActionItem['icon'], React.ComponentType<{ className?: string }>> = {
  vote: Vote,
  users: Users,
  trending: TrendingUp,
  compass: Compass,
  globe: Globe,
  user: User,
  clock: Clock,
  shield: Shield,
};

const PRIORITY_COLORS: Record<ActionItem['priority'], string> = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-teal-500',
  low: 'bg-gray-500',
};

export function ActionDock({ urgencyLevel, className }: ActionDockProps) {
  const { data } = useActionQueue();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const items = data?.items;
  const visibleItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => !dismissed.has(item.id)).slice(0, 5);
  }, [items, dismissed]);

  if (visibleItems.length === 0) return null;

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div
      className={[
        'fixed bottom-8 left-1/2 -translate-x-1/2 z-[12]',
        'bg-[oklch(0.15_0.01_260/0.6)] backdrop-blur-xl',
        'border border-white/[0.08] rounded-xl',
        'flex items-stretch gap-2 p-2',
        'overflow-x-auto scrollbar-none max-w-[calc(100vw-3rem)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AnimatePresence mode="popLayout">
        {visibleItems.map((item, index) => {
          const IconComponent = ICON_MAP[item.icon];
          const isUrgentCritical = urgencyLevel === 'critical' && item.priority === 'urgent';

          return (
            <motion.a
              key={item.id}
              href={item.href}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: index * 0.06,
              }}
              className={[
                'relative flex flex-col gap-1.5 p-3 rounded-lg min-w-[180px] max-w-[220px]',
                'bg-white/[0.04] hover:bg-white/[0.08] transition-colors',
                'border border-transparent',
                isUrgentCritical && 'border-red-500/30 animate-pulse',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Dismiss button */}
              <button
                onClick={(e) => handleDismiss(e, item.id)}
                className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground/50 hover:text-foreground/80 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>

              {/* Icon + Priority pip row */}
              <div className="flex items-center gap-2">
                <span
                  className={['h-2 w-2 rounded-full shrink-0', PRIORITY_COLORS[item.priority]].join(
                    ' ',
                  )}
                />
                <IconComponent className="h-3.5 w-3.5 text-foreground/60 shrink-0" />
                <span className="text-sm font-medium text-foreground/90 truncate pr-4">
                  {item.title}
                </span>
              </div>

              {/* Subtitle */}
              {item.subtitle && (
                <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
              )}

              {/* Deadline */}
              {item.deadline && (
                <span className="text-[10px] font-mono text-amber-400">{item.deadline}</span>
              )}
            </motion.a>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
