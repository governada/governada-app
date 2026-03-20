'use client';

/**
 * AnnotationBase — Shared wrapper for ambient AI annotations.
 *
 * All annotations follow the Harvey AI/Elicit pattern:
 * - Subtle inline indicator (icon + short text)
 * - Expandable provenance chain on demand
 * - Non-intrusive: muted styling that blends with content
 * - Respects prefers-reduced-motion
 */

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProvenanceStep {
  label: string;
  detail: string;
  /** Optional link to source data */
  href?: string;
}

interface AnnotationBaseProps {
  /** Icon component to display */
  icon: React.ReactNode;
  /** Short annotation text */
  text: string;
  /** Visual urgency level */
  variant?: 'info' | 'warning' | 'success' | 'neutral';
  /** Expandable provenance chain */
  provenance?: ProvenanceStep[];
  /** Additional classes */
  className?: string;
  /** Test ID for automated testing */
  'data-testid'?: string;
}

const VARIANT_STYLES = {
  info: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
  warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  success: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  neutral: 'border-white/[0.08] bg-white/[0.02] text-muted-foreground',
};

export function AnnotationBase({
  icon,
  text,
  variant = 'neutral',
  provenance,
  className,
  'data-testid': testId,
}: AnnotationBaseProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const hasProvenance = provenance && provenance.length > 0;

  return (
    <div
      className={cn('rounded-lg border px-3 py-2', VARIANT_STYLES[variant], className)}
      data-testid={testId}
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed">{text}</p>
        </div>
        {hasProvenance && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-[10px] text-current/60 hover:text-current transition-colors inline-flex items-center gap-0.5"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide reasoning' : 'Show reasoning'}
          >
            {expanded ? 'Hide' : 'Show reasoning'}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform duration-200', expanded && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {/* Expandable provenance chain */}
      <AnimatePresence>
        {expanded && hasProvenance && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-current/10 space-y-1.5">
              {provenance.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className="shrink-0 mt-1 w-4 h-4 rounded-full border border-current/20 flex items-center justify-center text-[8px] font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium">{step.label}</span>
                    <span className="mx-1 text-current/40">&mdash;</span>
                    {step.href ? (
                      <a
                        href={step.href}
                        className="underline underline-offset-2 hover:text-current transition-colors"
                      >
                        {step.detail}
                      </a>
                    ) : (
                      <span className="text-current/70">{step.detail}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
