'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Sparkles, ArrowRight, Info } from 'lucide-react';
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
// Seneca's narratives per page x progression
//
// Voice: Stoic philosopher and political advisor. Measured, direct, uses
// questions to guide thinking. Practical wisdom over platitudes. The kind
// of advisor who tells you a hard truth wrapped in an observation.
// Occasionally quotes himself (as Seneca would).
// ---------------------------------------------------------------------------

const SENECA_NARRATIVES: Record<
  PageKey,
  Record<CompassProgression, { text: string; cta?: { label: string; href: string } }>
> = {
  proposals: {
    first_visit: {
      text: 'Every decision you see below will shape Cardano for years. Some will allocate millions in treasury funds. Others will change how the protocol itself works. The question worth asking: who is deciding on your behalf, and do they share your values?',
    },
    exploring: {
      text: "You've been observing — that's wise. But observation without participation is spectatorship, not governance. I can tell you in 60 seconds which representatives would vote the way you think.",
      cta: { label: 'Find out', href: '/match' },
    },
    quiz_completed: {
      text: "Your values are mapped. Your matched representatives are voting on these proposals right now. Connect your wallet and I'll show you whether they're representing you well — or whether you should reconsider.",
      cta: { label: 'Connect your wallet', href: '/match' },
    },
    connected: {
      text: "These are today's open decisions. I'll tell you if anything here conflicts with your stated values.",
    },
  },
  representatives: {
    first_visit: {
      text: "These are the people who vote on Cardano's future. Some have voted on every proposal. Others have disappeared after registering. Below you'll find their records — not their promises, their actions. Judge accordingly.",
    },
    exploring: {
      text: '"It is not that we have a short time to live, but that we waste a great deal of it." You\'ve been browsing — let me save you time. Tell me your governance values and I\'ll show you who actually matches.',
      cta: { label: 'Match me', href: '/match' },
    },
    quiz_completed: {
      text: "I've ranked these representatives against your values. But a match score only tells part of the story. Connect your wallet and I'll show you the full alignment — where you agree, where you differ, and why it matters.",
      cta: { label: 'See full alignment', href: '/match' },
    },
    connected: {
      text: "Your representatives and their recent actions. I'll flag any votes that diverge from your stated priorities.",
    },
  },
  pools: {
    first_visit: {
      text: 'Most people choose stake pools for returns alone. But some pools also vote on governance — meaning your staking choice is also a governance choice, whether you intended it or not. Worth knowing which pools take that responsibility seriously.',
    },
    exploring: {
      text: "What if you could earn staking rewards from a pool that also votes your values? That's not idealism — it's available right now. Let me match you.",
      cta: { label: 'Find aligned pools', href: '/match' },
    },
    quiz_completed: {
      text: "I've identified pools that align with your governance values and participate actively. Connect your wallet to compare them against your current pool — you might be leaving representation on the table.",
      cta: { label: 'Compare pools', href: '/match' },
    },
    connected: {
      text: "Governance-active pools. I'll note any that better match your values than your current delegation.",
    },
  },
  committee: {
    first_visit: {
      text: "The Constitutional Committee exists for one reason: to ensure no proposal violates Cardano's founding principles. Below is their record — who participates, who reasons well, and who has yet to cast a single vote. Accountability starts with visibility.",
    },
    exploring: {
      text: '"No one is free who is a slave to their ignorance." You\'ve been learning how governance works. The committee is the last safeguard — connect your wallet and I\'ll show you how their rulings ripple into your delegation.',
      cta: { label: 'See your impact', href: '/match' },
    },
    quiz_completed: {
      text: "You understand the governance structure. Connect your wallet and I'll trace how committee decisions affect the proposals your matched representatives are voting on — the chain of accountability matters.",
      cta: { label: 'Connect to trace', href: '/match' },
    },
    connected: {
      text: "Committee activity and constitutional rulings. I'll alert you to any decisions that affect your delegation chain.",
    },
  },
  treasury: {
    first_visit: {
      text: "This is Cardano's common wealth — billions of ADA held in trust for the ecosystem. Every withdrawal requires community approval. The question isn't just how much is left, but whether what's been spent has delivered. Look at the numbers below and decide for yourself.",
    },
    exploring: {
      text: '"Wealth consists not in having great possessions, but in having few wants." Still — it helps to know how the treasury affects your stake. Connect your wallet and I\'ll make it concrete.',
      cta: { label: 'Show me', href: '/match' },
    },
    quiz_completed: {
      text: "Your governance values include views on treasury spending. Connect your wallet and I'll break down whether current allocations align with what you believe the treasury should fund.",
      cta: { label: 'See treasury alignment', href: '/match' },
    },
    connected: {
      text: "Treasury flows and runway projections. I'm watching for spending patterns that conflict with your priorities.",
    },
  },
  health: {
    first_visit: {
      text: "This is governance examined — not as it should be, but as it is. Participation rates, power concentration, deliberation quality. A democracy that doesn't measure itself cannot improve. These metrics tell you whether the system is healthy or merely operational.",
    },
    exploring: {
      text: "You've explored the pieces. This dashboard shows whether they add up to a functioning democracy. Connect your wallet and I'll show you where you fit in these numbers — participant or bystander.",
      cta: { label: 'Find your place', href: '/match' },
    },
    quiz_completed: {
      text: '"We suffer more in imagination than in reality." The health metrics here are real. Connect your wallet and I\'ll show you how your participation — active or absent — contributes to these scores.',
      cta: { label: 'See your contribution', href: '/match' },
    },
    connected: {
      text: "System health at a glance. I'll flag any governance metric that shifts meaningfully between epochs.",
    },
  },
};

// ---------------------------------------------------------------------------
// Seneca tooltip text
// ---------------------------------------------------------------------------

const SENECA_TOOLTIP =
  'Inspired by Seneca the Younger (c.\u00A04\u00A0BC\u2013AD\u00A065) \u2014 Stoic philosopher, statesman, and advisor whose letters on wisdom and governance remain influential two millennia later.';

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
    trackCompassPageView(page);
    const state: CompassState = getCompassState();
    setProgression(getCompassProgression(state));
    setMounted(true);
  }, [page]);

  if (!mounted) return null;

  const seneca = SENECA_NARRATIVES[page][progression];
  const narrative = briefing?.narrative ?? seneca.text;
  const headline = briefing?.headline ?? null;
  const cta = seneca.cta;

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
          <ScrollText className="h-3.5 w-3.5 text-primary" />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-help">
                Seneca
                <Info className="h-3 w-3 text-muted-foreground/40" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-[260px]">
              {SENECA_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Headline (only when briefing provides one) */}
      {headline && <p className="text-base font-semibold leading-snug">{headline}</p>}

      {/* Main narrative — Seneca's voice */}
      <p className="text-sm text-muted-foreground leading-relaxed italic">{narrative}</p>

      {/* Contextual CTA — unique per page */}
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

      {/* Ask Seneca link */}
      {discovery && (
        <button
          onClick={() => discovery.openHub()}
          className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
        >
          <ScrollText className="h-3 w-3" />
          Ask Seneca
        </button>
      )}
    </motion.div>
  );
}
