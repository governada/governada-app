'use client';

/**
 * OnboardingChecklist — Progressive onboarding for new citizens.
 *
 * Shows after wallet connect. Collapsible checklist with quick wins:
 * - Connect wallet (already done)
 * - Explore governance options
 * - Cast first sentiment vote
 * - Delegate to a DRep
 *
 * Self-dismisses after all items checked or after 3 sessions.
 * State persisted in localStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Wallet,
  Compass,
  MessageSquare,
  Vote,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getOnboardingState,
  updateOnboardingState,
  incrementSessionCount,
  isOnboardingDismissed,
  isOnboardingComplete,
  type OnboardingState,
} from '@/lib/funnel';
import { spring } from '@/lib/animations';

interface ChecklistItem {
  id: keyof Pick<
    OnboardingState,
    'walletConnected' | 'exploredGovernance' | 'firstSentimentVote' | 'delegatedDRep'
  >;
  label: string;
  description: string;
  icon: typeof Wallet;
  href?: string;
  action?: () => void;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'walletConnected',
    label: 'Connect wallet',
    description: 'You are connected and ready to participate',
    icon: Wallet,
  },
  {
    id: 'exploredGovernance',
    label: 'See what\u2019s being decided',
    description: 'Browse decisions and representatives',
    icon: Compass,
    href: '/governance',
  },
  {
    id: 'firstSentimentVote',
    label: 'Share your opinion on a decision',
    description: 'Quick poll \u2014 no wallet transaction needed',
    icon: MessageSquare,
    href: '/governance/proposals',
  },
  {
    id: 'delegatedDRep',
    label: 'Choose your representative',
    description: 'Pick who votes on your behalf \u2014 takes 60 seconds',
    icon: Vote,
    href: '/match',
  },
];

export function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [visible, setVisible] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- async localStorage read in useEffect is standard React pattern for hydration-safe state */
  useEffect(() => {
    const onboardingState = getOnboardingState();
    const sessionCount = incrementSessionCount();
    onboardingState.sessionCount = sessionCount;

    // Always mark wallet as connected if this component renders (it's in authenticated context)
    if (!onboardingState.walletConnected) {
      onboardingState.walletConnected = true;
      updateOnboardingState({ walletConnected: true, sessionCount });
    } else {
      updateOnboardingState({ sessionCount });
    }

    setState(onboardingState);

    if (!isOnboardingDismissed(onboardingState)) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    updateOnboardingState({ dismissedAt: Date.now() });
    setVisible(false);
  }, []);

  const completedCount = state ? CHECKLIST_ITEMS.filter((item) => state[item.id]).length : 0;
  const totalCount = CHECKLIST_ITEMS.length;

  if (!visible || !state) return null;

  if (isOnboardingComplete(state)) {
    // Show celebration briefly then auto-dismiss
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={spring.smooth}
        >
          <Card className="border-emerald-500/20 bg-emerald-500/5 mx-4 mb-4">
            <CardContent className="flex items-center gap-3 py-3">
              <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  You&apos;re all set! You now have a voice in how Cardano is run.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <Card className="border-white/[0.08] bg-card/50 backdrop-blur-sm mx-4 mb-4">
      <CardContent className="py-3 px-4">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Get started with governance</p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{totalCount} completed
            </p>
          </div>
          {/* Progress ring */}
          <div className="relative h-8 w-8 shrink-0">
            <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted/30"
              />
              <circle
                cx="16"
                cy="16"
                r="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${(completedCount / totalCount) * 81.68} 81.68`}
                strokeLinecap="round"
                className="text-primary transition-all duration-500"
              />
            </svg>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Checklist items */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.smooth}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-1.5 border-t border-border/30 pt-3">
                {CHECKLIST_ITEMS.map((item) => {
                  const completed = state[item.id];
                  const Icon = item.icon;

                  const content = (
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-lg px-3 py-2 transition-colors',
                        completed ? 'opacity-60' : 'hover:bg-primary/5 cursor-pointer',
                      )}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            completed && 'line-through text-muted-foreground',
                          )}
                        >
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      {!completed && (
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      )}
                    </div>
                  );

                  if (completed || !item.href) {
                    return <div key={item.id}>{content}</div>;
                  }

                  return (
                    <Link key={item.id} href={item.href}>
                      {content}
                    </Link>
                  );
                })}
              </div>

              {/* Dismiss button */}
              <div className="flex justify-end mt-2 pt-2 border-t border-border/20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-xs text-muted-foreground h-7"
                >
                  Dismiss
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
