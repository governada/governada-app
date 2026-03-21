'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface PillCloudProps {
  pills: Array<{ id: string; text: string; icon?: ReactNode }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  multiSelect?: boolean;
  layout?: 'cloud' | 'grid';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/* ─── Size variants ─────────────────────────────────────── */

const SIZE_CLASSES = {
  sm: 'text-xs px-2.5 py-1',
  md: 'text-sm px-3.5 py-1.5',
  lg: 'text-base px-4 py-2',
} as const;

/* ─── Component ─────────────────────────────────────────── */

export function PillCloud({
  pills,
  selected,
  onToggle,
  multiSelect = true,
  layout = 'cloud',
  disabled = false,
  size = 'md',
}: PillCloudProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleToggle = (id: string) => {
    if (disabled) return;
    onToggle(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle(id);
    }
  };

  return (
    <div
      role="group"
      aria-label={multiSelect ? 'Select one or more options' : 'Select an option'}
      className={cn(
        layout === 'cloud' && 'flex flex-wrap justify-center gap-2',
        layout === 'grid' && 'grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4',
      )}
    >
      {pills.map((pill, index) => {
        const isSelected = selected.has(pill.id);

        return (
          <motion.button
            key={pill.id}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            disabled={disabled}
            onClick={() => handleToggle(pill.id)}
            onKeyDown={(e) => handleKeyDown(e, pill.id)}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    delay: index * 0.04,
                    type: 'spring',
                    stiffness: 400,
                    damping: 25,
                  }
            }
            whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.95 }}
            className={cn(
              'cursor-pointer select-none rounded-full border backdrop-blur-sm',
              'transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              SIZE_CLASSES[size],
              isSelected
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                : 'border-white/[0.15] bg-white/[0.08] text-white/80 hover:border-white/25 hover:bg-white/[0.12] hover:text-white/90',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <span className="flex items-center gap-1.5">
              {pill.icon}
              {pill.text}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
