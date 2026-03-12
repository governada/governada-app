'use client';

/**
 * IntentWalletPrompt — Contextual wallet connect that appears at moments of intent.
 *
 * Instead of prompting on landing, this shows a wallet connect CTA
 * after the user has seen value and is ready to take action.
 *
 * Variants:
 * - delegate: "Connect to delegate to [Name]"
 * - vote: "Connect to make your voice count"
 * - profile: "Connect to track your governance impact"
 * - generic: "Connect your wallet to get started"
 */

import { Wallet, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';

type PromptVariant = 'delegate' | 'vote' | 'profile' | 'generic';

interface IntentWalletPromptProps {
  variant: PromptVariant;
  /** Entity name for delegate variant */
  entityName?: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for inline usage */
  compact?: boolean;
}

const VARIANT_CONFIG: Record<
  PromptVariant,
  {
    headline: string | ((name?: string) => string);
    subtext: string;
    cta: string;
  }
> = {
  delegate: {
    headline: (name?: string) => (name ? `Ready to delegate to ${name}?` : 'Ready to delegate?'),
    subtext: 'Connect your wallet to delegate your voting power. Your ADA stays in your wallet.',
    cta: 'Connect & Delegate',
  },
  vote: {
    headline: 'Make your voice count',
    subtext: 'Connect your wallet to vote on governance proposals and share your perspective.',
    cta: 'Connect to Vote',
  },
  profile: {
    headline: 'Track your governance impact',
    subtext:
      'Connect your wallet to see your delegation status, voting history, and governance identity.',
    cta: 'Connect Wallet',
  },
  generic: {
    headline: 'Join Cardano governance',
    subtext:
      'Connect your wallet to participate. Delegate your voting power, vote on proposals, and shape the future.',
    cta: 'Connect Wallet',
  },
};

export function IntentWalletPrompt({
  variant,
  entityName,
  className,
  compact = false,
}: IntentWalletPromptProps) {
  const config = VARIANT_CONFIG[variant];
  const headline =
    typeof config.headline === 'function' ? config.headline(entityName) : config.headline;

  const handleConnect = () => {
    trackFunnel(FUNNEL_EVENTS.WALLET_PROMPT_SHOWN, {
      source: variant,
      entity_name: entityName ?? undefined,
    });
    window.dispatchEvent(new Event('openWalletConnect'));
  };

  if (compact) {
    return (
      <button
        onClick={handleConnect}
        className={`group flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/10 ${className ?? ''}`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Wallet className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{headline}</p>
          <p className="text-xs text-muted-foreground truncate">{config.subtext}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  }

  return (
    <Card
      className={`border-primary/20 bg-gradient-to-br from-primary/5 to-transparent ${className ?? ''}`}
    >
      <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">{headline}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{config.subtext}</p>
        </div>
        <Button size="lg" onClick={handleConnect} className="gap-2">
          {config.cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          Your funds stay in your wallet
        </p>
      </CardContent>
    </Card>
  );
}
