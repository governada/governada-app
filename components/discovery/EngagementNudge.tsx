'use client';

/**
 * EngagementNudge — Slide-in wallet connection prompt for anonymous users.
 *
 * Triggers after 45s browsing or 3+ page views. Rotates through 3 content
 * variants. Caps at 3 lifetime impressions with 24h cooldown.
 * Suppressed on homepage (AnonymousLanding handles conversion there).
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Wallet, X, Shield, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spring } from '@/lib/animations';
import { useEngagementNudge } from '@/hooks/useEngagementNudge';
import { posthog } from '@/lib/posthog';
import { useEffect, useRef } from 'react';

const NUDGE_VARIANTS = [
  {
    icon: Wallet,
    headline: 'See who represents you',
    body: 'Connect your wallet to see your DRep, pool, and how well they are governing on your behalf.',
    cta: 'Connect Wallet',
  },
  {
    icon: Shield,
    headline: 'Your ADA, your voice',
    body: 'Governance decisions affect every ADA holder. Connect to track proposals and votes that matter to you.',
    cta: 'Get Started',
  },
  {
    icon: TrendingUp,
    headline: 'Track your governance health',
    body: 'See your delegation performance, participation score, and personalized governance recommendations.',
    cta: 'Connect Wallet',
  },
];

export function EngagementNudge() {
  const { shouldShow, variant, dismiss, convert } = useEngagementNudge();
  const shouldReduceMotion = useReducedMotion();
  const trackedRef = useRef(false);

  const content = NUDGE_VARIANTS[variant] ?? NUDGE_VARIANTS[0];
  const Icon = content.icon;

  // Track impression
  useEffect(() => {
    if (shouldShow && !trackedRef.current) {
      trackedRef.current = true;
      posthog.capture('engagement_nudge_shown', { variant });
    }
  }, [shouldShow, variant]);

  const handleDismiss = () => {
    dismiss();
    posthog.capture('engagement_nudge_dismissed', { variant, method: 'close' });
  };

  const handleConvert = () => {
    convert();
    posthog.capture('engagement_nudge_converted', { variant });
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={spring.smooth}
          className="fixed bottom-24 sm:bottom-8 left-4 sm:left-auto sm:right-4 z-30 w-[320px] max-w-[calc(100vw-2rem)]"
        >
          <div className="rounded-xl border border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 shrink-0">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{content.headline}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{content.body}</p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleConvert} className="flex-1 h-8 text-xs">
                <Wallet className="h-3.5 w-3.5 mr-1.5" />
                {content.cta}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 text-xs text-muted-foreground"
              >
                Not now
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
