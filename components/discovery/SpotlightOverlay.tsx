'use client';

/**
 * SpotlightOverlay — Contextual spotlight highlight with tooltip card.
 *
 * Renders a semi-transparent backdrop with a clip-path cutout around
 * the target element, plus an explanation tooltip card.
 */

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spring } from '@/lib/animations';
import type { SpotlightStep } from '@/lib/discovery/content';

interface SpotlightOverlayProps {
  step: SpotlightStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // px around target element
const TOOLTIP_GAP = 12; // px between target and tooltip
const RETRY_INTERVAL_MS = 300;
const MAX_RETRIES = 15; // 15 * 300ms = 4.5s max wait for DOM (more time for mobile)
const SCROLL_SETTLE_MS = 400; // wait for scrollIntoView to finish before measuring

export function SpotlightOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
  const shouldReduceMotion = useReducedMotion();
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find and measure the target element — retries to handle post-navigation DOM delays
  useEffect(() => {
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout>;
    let measureTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const measureTarget = (el: Element) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      measureTimer = setTimeout(() => {
        if (cancelled) return;
        const rect = el.getBoundingClientRect();
        // Viewport-relative coords — overlay container is position:fixed
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // On small screens (mobile), require less space for the tooltip
        const minSpace = window.innerWidth < 640 ? 140 : 200;
        setTooltipPosition(spaceBelow > minSpace || spaceBelow > spaceAbove ? 'bottom' : 'top');
      }, SCROLL_SETTLE_MS);
    };

    const findTarget = () => {
      if (cancelled) return;
      const el = document.querySelector(step.targetSelector);
      if (el) {
        measureTarget(el);
        return;
      }
      // Retry — DOM may not be rendered yet after navigation
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        retryTimer = setTimeout(findTarget, RETRY_INTERVAL_MS);
      } else {
        // Give up after max retries — skip this step
        if (!cancelled) onNext();
      }
    };

    // Reset rect when step changes
    setTargetRect(null);
    findTarget();

    const handleResize = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) measureTarget(el);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(measureTimer);
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when step changes
  }, [step.targetSelector, step.id]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'Enter' || e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onSkip]);

  if (!targetRect) return null;

  // Cutout dimensions with padding
  const cutout = {
    top: targetRect.top - PADDING,
    left: targetRect.left - PADDING,
    width: targetRect.width + PADDING * 2,
    height: targetRect.height + PADDING * 2,
  };

  // Tooltip position — clamp within viewport, especially on mobile
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 640;
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: isMobileViewport ? 16 : Math.max(16, Math.min(cutout.left, window.innerWidth - 320)),
    maxWidth: isMobileViewport ? window.innerWidth - 32 : 320,
    ...(tooltipPosition === 'bottom'
      ? { top: Math.min(cutout.top + cutout.height + TOOLTIP_GAP, window.innerHeight - 160) }
      : { top: Math.max(cutout.top - TOOLTIP_GAP, 16), transform: 'translateY(-100%)' }),
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      role="dialog"
      aria-label="Guided tour"
    >
      {/* Backdrop with cutout — pointer-events-auto so clicks on dark area advance */}
      <div
        className="absolute inset-0 bg-black/50 transition-all duration-300 pointer-events-auto"
        onClick={onNext}
        style={{
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${cutout.top}px,
            ${cutout.left}px ${cutout.top}px,
            ${cutout.left}px ${cutout.top + cutout.height}px,
            ${cutout.left + cutout.width}px ${cutout.top + cutout.height}px,
            ${cutout.left + cutout.width}px ${cutout.top}px,
            0% ${cutout.top}px
          )`,
        }}
      />

      {/* Highlight ring around target */}
      <div
        className="absolute rounded-lg border-2 border-primary/50 pointer-events-none"
        style={{
          top: cutout.top,
          left: cutout.left,
          width: cutout.width,
          height: cutout.height,
        }}
      />

      {/* Tooltip card — pointer-events-auto so buttons are tappable on mobile */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tooltipRef}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={spring.smooth}
          style={tooltipStyle}
          className="rounded-xl border border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-2xl p-4 space-y-3 pointer-events-auto"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {step.description}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-2 -m-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="End tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === stepIndex
                      ? 'w-4 bg-primary'
                      : i < stepIndex
                        ? 'w-1.5 bg-primary/40'
                        : 'w-1.5 bg-muted/40'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
                className="h-9 text-xs text-muted-foreground min-w-[44px]"
              >
                <SkipForward className="h-3 w-3 mr-1" />
                Skip
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="h-9 text-xs min-w-[44px]"
              >
                {stepIndex < totalSteps - 1 ? (
                  <>
                    Next
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}
