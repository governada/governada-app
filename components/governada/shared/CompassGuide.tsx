'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Navigation2, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import {
  type CompassProgression,
  type CompassState,
  getCompassState,
  getCompassProgression,
  trackCompassPageView,
} from '@/lib/funnel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageKey = 'proposals' | 'representatives' | 'pools' | 'committee' | 'treasury' | 'health';

interface CompassGuideProps {
  /** Which governance page this is rendered on */
  page: PageKey;
  /** Server-fetched briefing data — pre-generated narrative content */
  briefing?: {
    headline: string;
    narrative: string;
  } | null;
  /** Current count of active proposals (for proposals page context) */
  proposalCount?: number;
  /** Current count of active dreps (for representatives page context) */
  drepCount?: number;
  /** Current count of governance-active pools */
  poolCount?: number;
}

// ---------------------------------------------------------------------------
// Static fallback narratives per page x progression
// ---------------------------------------------------------------------------

const FALLBACK_NARRATIVES: Record<PageKey, Record<CompassProgression, string>> = {
  proposals: {
    first_visit:
      "Proposals are how Cardano's future gets shaped. Each one represents a community decision \u2014 from treasury spending to protocol changes. The votes below show where representatives stand right now.",
    exploring:
      "You've been exploring governance. Each proposal below shows real-time voting from elected representatives. Curious who'd vote the way you would?",
    quiz_completed:
      'Based on your governance values, your matched representatives are actively voting on these proposals. Connect your wallet to see how they align with your priorities.',
    connected: "Here's what's being decided right now in Cardano governance.",
  },
  representatives: {
    first_visit:
      'DReps are the elected voices of Cardano governance. They vote on proposals on behalf of delegators. Browse their track records, voting patterns, and stated positions below.',
    exploring:
      "You've seen how governance works. Now explore who's doing the governing \u2014 each DRep below has a real voting record you can examine.",
    quiz_completed:
      'Your governance values are mapped. These representatives are ranked by how well they match your priorities. Connect your wallet to delegate to your top match.',
    connected: 'Your elected representatives and their latest activity.',
  },
  pools: {
    first_visit:
      'Stake pools do more than produce blocks \u2014 many actively participate in governance by voting on proposals. See which pools align governance with staking.',
    exploring:
      "You've been learning about governance. Stake pools are another layer \u2014 some vote on your behalf when DReps don't. Explore their governance activity below.",
    quiz_completed:
      'Your governance profile is taking shape. Some of these pools may align with your values while earning you staking rewards.',
    connected: 'Governance-active stake pools and their voting participation.',
  },
  committee: {
    first_visit:
      "The Constitutional Committee safeguards Cardano's founding principles. They review every proposal for constitutional compliance before it can take effect.",
    exploring:
      "You've been exploring how decisions get made. The Constitutional Committee is the final check \u2014 they ensure every proposal respects Cardano's constitution.",
    quiz_completed:
      'You understand the governance landscape. The committee below is the constitutional safeguard \u2014 connect your wallet to see how their decisions affect your priorities.',
    connected: 'Constitutional Committee members and their review activity.',
  },
  treasury: {
    first_visit:
      "Cardano's treasury funds the ecosystem's growth. Every withdrawal requires community approval through governance. See how funds are being allocated below.",
    exploring:
      "You've seen how governance works. The treasury is where it gets real \u2014 billions of ADA allocated by community vote. Explore the spending below.",
    quiz_completed:
      'Your governance values include treasury priorities. Connect your wallet to see how spending aligns with what you care about.',
    connected: 'Treasury activity and spending allocation.',
  },
  health: {
    first_visit:
      "Governance health tracks how well Cardano's decision-making is functioning. Participation rates, voting patterns, and network decentralization are all measured here.",
    exploring:
      "You've been exploring the governance landscape. This dashboard shows the big picture \u2014 is participation growing? Are votes concentrated or distributed?",
    quiz_completed:
      'You know your governance values. This health dashboard shows how the system performs overall \u2014 connect your wallet to see your role in the picture.',
    connected: 'Overall governance health and participation metrics.',
  },
};

// ---------------------------------------------------------------------------
// CTA messages for intermediate progression states
// ---------------------------------------------------------------------------

const EXPLORING_CTA =
  "You've been exploring governance. Curious who'd represent your values? Take the 60-second match quiz.";

const QUIZ_COMPLETED_CTA =
  'You found your top matches. Connect your wallet to see your full governance profile across all 6 dimensions.';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompassGuide({
  page,
  briefing,
  proposalCount: _proposalCount,
  drepCount: _drepCount,
  poolCount: _poolCount,
}: CompassGuideProps) {
  const [progression, setProgression] = useState<CompassProgression>('first_visit');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Track the page view and derive progression
    trackCompassPageView(page);
    const state: CompassState = getCompassState();
    setProgression(getCompassProgression(state));
    setMounted(true);
  }, [page]);

  // Don't render until we've read localStorage to avoid flash
  if (!mounted) return null;

  // Resolve narrative text: prefer server briefing, fall back to static
  const narrative = briefing?.narrative ?? FALLBACK_NARRATIVES[page][progression];
  const headline = briefing?.headline ?? null;

  // Determine CTA based on progression
  const showExploreCTA = progression === 'exploring';
  const showQuizCTA = progression === 'quiz_completed';
  const hasCTA = showExploreCTA || showQuizCTA;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 sm:p-6 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Navigation2 className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Compass Guide
        </span>
      </div>

      {/* Headline (only when briefing provides one) */}
      {headline && <p className="text-base font-semibold leading-snug">{headline}</p>}

      {/* Main narrative */}
      <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>

      {/* Contextual CTA for intermediate progression states */}
      {hasCTA && (
        <div className="rounded-lg bg-muted/20 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {showExploreCTA ? EXPLORING_CTA : QUIZ_COMPLETED_CTA}
          </p>
          {showExploreCTA && (
            <Link
              href="/match"
              className={cn(
                'mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary',
                'hover:text-primary/80 transition-colors',
              )}
            >
              Take the match quiz
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          {showQuizCTA && (
            <Link
              href="/get-started"
              className={cn(
                'mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary',
                'hover:text-primary/80 transition-colors',
              )}
            >
              Connect your wallet
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* AI attribution (only when briefing is provided) */}
      {briefing && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
          <Sparkles className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/40">
            AI-generated briefing — updates with each epoch
          </span>
        </div>
      )}
    </motion.div>
  );
}
