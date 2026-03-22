'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Navigation2, Sparkles, ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import { useDiscoveryHub } from '@/components/discovery/DiscoveryHubContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
// Solon's narratives per page x progression
// Solon speaks as a warm, authoritative governance mentor — first person,
// conversational, knowledgeable. Like a trusted advisor who genuinely cares
// about helping you navigate governance.
// ---------------------------------------------------------------------------

const SOLON_NARRATIVES: Record<
  PageKey,
  Record<CompassProgression, { text: string; cta?: { label: string; href: string } }>
> = {
  proposals: {
    first_visit: {
      text: "These are the decisions shaping Cardano right now. Each proposal below represents a community choice — from treasury spending to protocol changes. I've been tracking how representatives are voting. Let me walk you through what's happening.",
    },
    exploring: {
      text: "You've been looking around — good. These votes are where governance gets real. Want to know which representatives would vote the way you would? I can figure that out in about 60 seconds.",
      cta: { label: 'Find out', href: '/match' },
    },
    quiz_completed: {
      text: "Your matched representatives are actively voting on these proposals. I can show you exactly how their positions align with your priorities — connect your wallet and I'll make it personal.",
      cta: { label: 'Connect your wallet', href: '/get-started' },
    },
    connected: {
      text: "Here's what's being decided right now. I'm watching for anything that affects your delegation.",
    },
  },
  representatives: {
    first_visit: {
      text: "DReps are the elected voices of Cardano governance — they vote on proposals on behalf of people like you. Below you'll find their track records, voting patterns, and stated positions. Take your time browsing.",
    },
    exploring: {
      text: "Now that you've seen how governance works, let me help you find your match. I can compare your governance values against every active representative in about 60 seconds.",
      cta: { label: 'Match me', href: '/match' },
    },
    quiz_completed: {
      text: "I've ranked these representatives by how well they match your values. Connect your wallet and I'll show you the full picture — alignment across all 6 governance dimensions, not just the top-line score.",
      cta: { label: 'See full alignment', href: '/get-started' },
    },
    connected: {
      text: "Your representatives and their latest activity. I'll flag anything that shifts your alignment.",
    },
  },
  pools: {
    first_visit: {
      text: "Stake pools do more than produce blocks — many actively vote on governance proposals. Below you'll see which pools put governance participation alongside staking rewards.",
    },
    exploring: {
      text: 'Some of these pools might earn you rewards AND vote your governance values. I can match you to pools that align with what you care about — takes about a minute.',
      cta: { label: 'Find aligned pools', href: '/match' },
    },
    quiz_completed: {
      text: "Your governance profile is mapped. I've found pools that match your values and earn staking rewards. Connect your wallet to see the full comparison.",
      cta: { label: 'Compare pools', href: '/get-started' },
    },
    connected: {
      text: "Governance-active pools and their voting participation. I'll note any that match your values.",
    },
  },
  committee: {
    first_visit: {
      text: "The Constitutional Committee is Cardano's safeguard. These members review every proposal for constitutional compliance before it can take effect. Below is their track record — who's voting, who's reasoning well, and where the gaps are.",
    },
    exploring: {
      text: "You've been exploring how decisions get made. The committee is the final check — they ensure every proposal respects Cardano's constitution. Connect your wallet and I'll show you how their decisions ripple into your delegation.",
      cta: { label: 'See your impact', href: '/get-started' },
    },
    quiz_completed: {
      text: "You understand the governance landscape. Connect your wallet and I'll show you how committee decisions affect the proposals your matched representatives are voting on.",
      cta: { label: 'Connect to see', href: '/get-started' },
    },
    connected: {
      text: "Constitutional Committee activity. I'll alert you if any rulings affect proposals relevant to your delegation.",
    },
  },
  treasury: {
    first_visit: {
      text: "Cardano's treasury funds the ecosystem's growth — billions of ADA allocated by community vote. Every withdrawal requires approval through governance. Below you'll see where the money is going and how long the runway lasts.",
    },
    exploring: {
      text: 'This is where governance gets tangible — real ADA, real spending. I can show you how treasury decisions impact your specific delegation. Want to see the numbers?',
      cta: { label: 'Show me', href: '/get-started' },
    },
    quiz_completed: {
      text: "Your governance values include treasury priorities. Connect your wallet and I'll break down how current spending aligns with what you care about.",
      cta: { label: 'See your treasury view', href: '/get-started' },
    },
    connected: {
      text: "Treasury activity and spending allocation. I'm tracking anything that affects your delegation.",
    },
  },
  health: {
    first_visit: {
      text: "This is the big picture — how well Cardano's governance is actually functioning. Participation rates, voting concentration, deliberation quality. Think of it as a health check for democracy itself.",
    },
    exploring: {
      text: "You've been exploring the landscape. This dashboard shows whether the system is healthy — are enough people participating? Is power concentrated or distributed? Connect your wallet and I'll show you your place in the picture.",
      cta: { label: 'Find your place', href: '/get-started' },
    },
    quiz_completed: {
      text: "You know your governance values. Connect your wallet and I'll show you how your participation — or lack of it — fits into these health metrics.",
      cta: { label: 'See your role', href: '/get-started' },
    },
    connected: {
      text: "Overall governance health. I'll flag any shifts that affect your delegation or participation score.",
    },
  },
};

// ---------------------------------------------------------------------------
// Solon tooltip text
// ---------------------------------------------------------------------------

const SOLON_TOOLTIP =
  'Named after Solon of Athens (c.\u00A0630\u2013560\u00A0BC) \u2014 the lawmaker who laid the foundations of Athenian democracy.';

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
  const discovery = useDiscoveryHub();

  useEffect(() => {
    // Track the page view and derive progression
    trackCompassPageView(page);
    const state: CompassState = getCompassState();
    setProgression(getCompassProgression(state));
    setMounted(true);
  }, [page]);

  // Don't render until we've read localStorage to avoid flash
  if (!mounted) return null;

  // Resolve content: prefer server briefing, fall back to Solon's static narratives
  const solon = SOLON_NARRATIVES[page][progression];
  const narrative = briefing?.narrative ?? solon.text;
  const headline = briefing?.headline ?? null;
  const cta = solon.cta;

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-help">
                Solon
                <Info className="h-3 w-3 text-muted-foreground/40" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-[240px]">
              {SOLON_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Headline (only when briefing provides one) */}
      {headline && <p className="text-base font-semibold leading-snug">{headline}</p>}

      {/* Main narrative */}
      <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>

      {/* Contextual CTA — unique per page, woven into Solon's narrative */}
      {cta && (
        <Link
          href={cta.href}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium text-primary',
            'hover:text-primary/80 transition-colors',
          )}
        >
          {cta.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
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

      {/* Ask Solon link */}
      {discovery && (
        <button
          onClick={() => discovery.openHub()}
          className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
        >
          <Navigation2 className="h-3 w-3" />
          Ask Solon
        </button>
      )}
    </motion.div>
  );
}
