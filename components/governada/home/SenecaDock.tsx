'use client';

/**
 * SenecaDock — Warm, conversational Seneca entry point on the anonymous homepage.
 *
 * Replaces hero text by communicating what Cardano governance IS, why it matters,
 * and what the user can do — through Seneca's voice, not marketing copy.
 *
 * Three visit states:
 * 1. First Visit  — Value proposition + "Find my representative" CTA
 * 2. Returning    — Dynamic narrative pulse + "Continue" / "Start fresh"
 * 3. Post-Match   — Previous match results + "See my matches" / restart
 *
 * Instead of a free-form chat input (which would hit the AI API), anonymous users
 * get structured conversational options — Seneca guides them through governance
 * discovery with pre-computed responses. Full AI chat unlocks after login.
 *
 * Also detects wallet extensions for personalized messaging.
 */

import { useState, useCallback, useEffect } from 'react';
import { Sparkles, ArrowRight, RotateCcw, BookOpen, BarChart3, Users } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSenecaWarmth } from '@/hooks/useSenecaWarmth';
import { CompassSigil } from '@/components/governada/CompassSigil';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SenecaDockProps {
  onStartMatch?: () => void;
  narrativePulse?: string;
  /** Active proposal count for contextual messaging */
  activeProposals?: number;
}

// ---------------------------------------------------------------------------
// Conversational guide options (no AI API calls — pre-computed content)
// ---------------------------------------------------------------------------

interface GuideOption {
  label: string;
  icon: React.ReactNode;
  /** Route to navigate to, OR 'match' to trigger match flow */
  action: string;
}

const GUIDE_OPTIONS: GuideOption[] = [
  {
    label: "What's being decided right now?",
    icon: <BarChart3 className="h-3.5 w-3.5 shrink-0" />,
    action: '/governance/proposals',
  },
  {
    label: 'How does Cardano governance work?',
    icon: <BookOpen className="h-3.5 w-3.5 shrink-0" />,
    action: '/governance/health',
  },
  {
    label: 'Who are the representatives?',
    icon: <Users className="h-3.5 w-3.5 shrink-0" />,
    action: '/governance/representatives',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SenecaDock({ onStartMatch, narrativePulse, activeProposals }: SenecaDockProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { dockState, walletDetected, matchMemory, greeting, markVisited } = useSenecaWarmth();
  const [showGuide, setShowGuide] = useState(false);

  // Mark visited after first render
  useEffect(() => {
    const timer = setTimeout(markVisited, 2000);
    return () => clearTimeout(timer);
  }, [markVisited]);

  const handleMatchClick = useCallback(() => {
    if (onStartMatch) {
      onStartMatch();
    }
  }, [onStartMatch]);

  const handleGuideAction = useCallback(
    (action: string) => {
      if (action === 'match') {
        handleMatchClick();
      } else {
        router.push(action);
      }
    },
    [handleMatchClick, router],
  );

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:left-4 lg:left-6 sm:w-[22rem] z-40 pointer-events-auto"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-black/75 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Sigil + warm content */}
        <div className="px-5 pt-5 pb-3">
          {/* Compass Sigil */}
          <div className="mb-3">
            <CompassSigil state="greeting" size={28} />
          </div>

          {/* State-dependent warm content */}
          {dockState === 'first-visit' && (
            <FirstVisitContent walletDetected={walletDetected} activeProposals={activeProposals} />
          )}
          {dockState === 'returning' && (
            <ReturningContent
              greeting={greeting}
              narrativePulse={narrativePulse}
              activeProposals={activeProposals}
            />
          )}
          {dockState === 'post-match' && matchMemory && (
            <PostMatchContent matchMemory={matchMemory} />
          )}
        </div>

        {/* Primary CTA — Find my representative */}
        <div className="px-4 pb-2">
          {dockState === 'post-match' && matchMemory ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMatchClick}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary/20 border border-primary/30 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/30 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                See my matches
              </button>
              <button
                type="button"
                onClick={handleMatchClick}
                className="flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleMatchClick}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/15 border border-primary/25 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/25 transition-colors group"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Find my representative
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </button>
          )}
        </div>

        {/* Conversational guide options — replaces free-form input for anonymous users */}
        <div className="px-4 pb-4">
          {!showGuide ? (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="w-full text-center text-[11px] text-white/30 hover:text-white/50 transition-colors py-1.5"
            >
              Or let me guide you through governance →
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-1.5 overflow-hidden"
              >
                <p className="text-[11px] text-white/35 pb-1">What would you like to explore?</p>
                {GUIDE_OPTIONS.map((option) => (
                  <button
                    key={option.action}
                    type="button"
                    onClick={() => handleGuideAction(option.action)}
                    className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-[13px] text-white/60 hover:text-white/85 hover:bg-white/[0.07] hover:border-white/[0.12] transition-all text-left group"
                  >
                    <span className="text-white/30 group-hover:text-primary/70 transition-colors">
                      {option.icon}
                    </span>
                    {option.label}
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for each dock state
// ---------------------------------------------------------------------------

function FirstVisitContent({
  walletDetected,
  activeProposals,
}: {
  walletDetected: boolean;
  activeProposals?: number;
}) {
  return (
    <div className="space-y-2">
      <h2
        className="text-[15px] font-semibold text-white/90 leading-snug"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        Cardano runs on decentralized governance.
      </h2>
      <p className="text-[13px] text-white/55 leading-relaxed">
        {walletDetected ? (
          <>
            I see you have a wallet — you&apos;re halfway to participating.
            {activeProposals && activeProposals > 0
              ? ` There are ${activeProposals} proposals being decided right now. `
              : ' '}
            Find a representative for your ADA in about 60 seconds.
          </>
        ) : (
          <>
            700 representatives are making decisions about a $2 billion treasury right now.
            {activeProposals && activeProposals > 0
              ? ` ${activeProposals} proposals are being voted on this epoch. `
              : ' '}
            One of them could represent your ADA — and finding them takes 60 seconds.
          </>
        )}
      </p>
    </div>
  );
}

function ReturningContent({
  greeting,
  narrativePulse,
  activeProposals,
}: {
  greeting: string;
  narrativePulse?: string;
  activeProposals?: number;
}) {
  return (
    <div className="space-y-2">
      <h2
        className="text-[15px] font-semibold text-white/90 leading-snug"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        {greeting}. Welcome back.
      </h2>
      {narrativePulse ? (
        <p className="text-[13px] text-white/55 leading-relaxed">{narrativePulse}</p>
      ) : activeProposals && activeProposals > 0 ? (
        <p className="text-[13px] text-white/55 leading-relaxed">
          Governance is active — {activeProposals} proposal{activeProposals > 1 ? 's are' : ' is'}{' '}
          being decided right now. Find your representative, or explore what&apos;s at stake.
        </p>
      ) : (
        <p className="text-[13px] text-white/55 leading-relaxed">
          Governance is always moving. Find your representative, or explore what&apos;s happening.
        </p>
      )}
    </div>
  );
}

function PostMatchContent({
  matchMemory,
}: {
  matchMemory: { topMatches: Array<{ name: string; score: number }>; archetype?: string };
}) {
  const topMatch = matchMemory.topMatches[0];
  const matchCount = matchMemory.topMatches.length;

  return (
    <div className="space-y-2">
      <h2
        className="text-[15px] font-semibold text-white/90 leading-snug"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        Welcome back{matchMemory.archetype ? `, ${matchMemory.archetype}` : ''}.
      </h2>
      <p className="text-[13px] text-white/55 leading-relaxed">
        {topMatch ? (
          <>
            You matched with <span className="text-white/75 font-medium">{topMatch.name}</span> (
            {topMatch.score}%)
            {matchCount > 1 && (
              <>
                {' '}
                and {matchCount - 1} other{matchCount > 2 ? 's' : ''}
              </>
            )}{' '}
            last time. Ready to delegate?
          </>
        ) : (
          <>You started finding your representative. Pick up where you left off?</>
        )}
      </p>
    </div>
  );
}
