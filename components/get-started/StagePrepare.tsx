'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ChevronDown,
  Smartphone,
  Monitor,
  Check,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fadeInUp, spring, staggerContainer } from '@/lib/animations';
import { trackOnboarding, ONBOARDING_EVENTS } from '@/lib/funnel';
import type { GovernancePassport } from '@/lib/passport';

interface StagePrepareProps {
  passport: GovernancePassport;
  onComplete: (walletPath: GovernancePassport['walletPath']) => void;
}

type SubView = 'cards' | 'exchange' | 'no-ada' | 'wallet-guide';
type Exchange = 'coinbase' | 'binance' | 'kraken' | 'other';

const EXCHANGE_STEPS: Record<Exchange, { name: string; steps: string[] }> = {
  coinbase: {
    name: 'Coinbase',
    steps: [
      'Open Coinbase and go to "Send & Receive"',
      'Select ADA (Cardano) from your assets',
      'Paste your wallet address from Lace or VESPR',
      'Send a small test amount (10 ADA), then send the rest after confirming arrival',
    ],
  },
  binance: {
    name: 'Binance',
    steps: [
      'Go to Wallet > Fiat and Spot > Withdraw',
      'Search for ADA and select it',
      'Choose "Cardano" network and paste your wallet address',
      'Send a small test amount first, then the rest after confirmation',
    ],
  },
  kraken: {
    name: 'Kraken',
    steps: [
      'Navigate to Funding > Withdraw',
      'Select ADA (Cardano)',
      'Add your wallet address and choose the Cardano network',
      'Withdraw a small test amount first, then send the rest',
    ],
  },
  other: {
    name: 'Other Exchange',
    steps: [
      'Find the ADA or Cardano withdrawal section',
      'Select the Cardano network (not BEP20 or ERC20)',
      'Paste your new wallet address',
      'Always send a small test amount first',
    ],
  },
};

function WalletRecommendations({ onDone }: { onDone: () => void }) {
  const [showOthers, setShowOthers] = useState(false);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-4"
    >
      <motion.div variants={fadeInUp} className="space-y-1">
        <h3 className="text-lg font-semibold">Recommended Wallets</h3>
        <p className="text-sm text-muted-foreground">
          You need a Cardano wallet to participate in governance. Here are our top picks.
        </p>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid gap-3 sm:grid-cols-2">
        {/* Lace */}
        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <span className="font-semibold">Lace</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Desktop
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Built by the team behind Cardano. Full governance support with a clean interface.
            </p>
            <Button asChild size="sm" variant="outline" className="w-full gap-1">
              <a
                href="https://www.lace.io/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackOnboarding(ONBOARDING_EVENTS.WALLET_RECOMMENDED, {
                    wallet: 'lace',
                    device: 'desktop',
                  })
                }
              >
                Install Lace
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* VESPR */}
        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="font-semibold">VESPR</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Mobile
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Set up in seconds on your phone. Great governance support with a mobile-first design.
            </p>
            <Button asChild size="sm" variant="outline" className="w-full gap-1">
              <a
                href="https://vespr.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackOnboarding(ONBOARDING_EVENTS.WALLET_RECOMMENDED, {
                    wallet: 'vespr',
                    device: 'mobile',
                  })
                }
              >
                Get VESPR
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Other wallets */}
      <motion.div variants={fadeInUp}>
        <button
          onClick={() => setShowOthers(!showOthers)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', showOthers && 'rotate-180')} />
          I prefer a different wallet
        </button>

        <AnimatePresence>
          {showOthers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.snappy}
              className="overflow-hidden"
            >
              <div className="pt-2 text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Eternl</strong> and <strong>Yoroi</strong> also support Cardano
                  governance. Any CIP-95 compatible wallet will work.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Button onClick={onDone} className="gap-2">
          I&apos;ve set up my wallet
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

function ExchangeGuide({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <motion.div variants={fadeInUp} className="space-y-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
        <h3 className="text-lg font-semibold">Move Your ADA Home</h3>
        <p className="text-sm text-muted-foreground">
          To participate in governance, your ADA needs to be in your own wallet &mdash; not on an
          exchange. This usually takes 5-10 minutes.
        </p>
      </motion.div>

      {/* Step 1: Get a wallet */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            1
          </div>
          <span className="text-sm font-medium">Set up a wallet</span>
        </div>
        <WalletRecommendations onDone={() => {}} />
      </motion.div>

      {/* Step 2: Which exchange? */}
      <motion.div variants={fadeInUp} className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            2
          </div>
          <span className="text-sm font-medium">Withdraw from your exchange</span>
        </div>

        {!selectedExchange ? (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EXCHANGE_STEPS) as Exchange[]).map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  trackOnboarding(ONBOARDING_EVENTS.EXCHANGE_SELECTED, { exchange: key });
                  setSelectedExchange(key);
                }}
              >
                {EXCHANGE_STEPS[key].name}
              </Button>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{EXCHANGE_STEPS[selectedExchange].name}</span>
                <button
                  onClick={() => setSelectedExchange(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change
                </button>
              </div>
              <ol className="space-y-2">
                {EXCHANGE_STEPS[selectedExchange].steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[10px] font-bold">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-400" />
                Withdrawals usually arrive in 5-10 minutes
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Button onClick={onDone} className="gap-2">
          My ADA is in my wallet
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

function NoAdaGuide({
  onDone,
  onBack,
}: {
  passport: GovernancePassport;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <motion.div variants={fadeInUp} className="space-y-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
        <h3 className="text-lg font-semibold">Join the Cardano Nation</h3>
        <p className="text-sm text-muted-foreground">
          Even 10 ADA gives you a governance voice. That&apos;s less than $10 to help shape the
          future of a $20B+ blockchain.
        </p>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Where to buy ADA</p>
            <div className="space-y-2">
              {[
                {
                  name: 'Coinbase',
                  label: 'Beginner-friendly',
                  url: 'https://www.coinbase.com/',
                },
                { name: 'Kraken', label: 'Low fees', url: 'https://www.kraken.com/' },
                { name: 'Binance', label: 'Global access', url: 'https://www.binance.com/' },
              ].map((ex) => (
                <a
                  key={ex.name}
                  href={ex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{ex.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {ex.label}
                    </Badge>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <WalletRecommendations onDone={onDone} />
      </motion.div>
    </motion.div>
  );
}

export function StagePrepare({ passport, onComplete }: StagePrepareProps) {
  const [subView, setSubView] = useState<SubView>('cards');

  // Already completed
  if (passport.stage !== 2) {
    if (passport.walletReady) {
      return (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div variants={fadeInUp} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Wallet Ready</h2>
              <p className="text-xs text-muted-foreground">You have a Cardano wallet set up.</p>
            </div>
          </motion.div>
        </motion.div>
      );
    }
    return null;
  }

  const handleComplete = (path: GovernancePassport['walletPath']) => {
    trackOnboarding(ONBOARDING_EVENTS.SELF_ID, { path: path ?? 'unknown' });
    onComplete(path);
  };

  return (
    <AnimatePresence mode="wait">
      {subView === 'cards' && (
        <motion.div
          key="cards"
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, y: -10 }}
          variants={staggerContainer}
          className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
        >
          <motion.div variants={fadeInUp} className="text-center space-y-2 max-w-md">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Get the tools you need</h1>
            <p className="text-muted-foreground">
              To participate in governance, you need a Cardano wallet. Which best describes you?
            </p>
          </motion.div>

          <motion.div variants={fadeInUp} className="grid gap-3 w-full max-w-md">
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => handleComplete('wallet')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Wallet className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">I have a Cardano wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Lace, Eternl, VESPR, or another wallet
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSubView('exchange')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <ArrowRight className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">My ADA is on an exchange</p>
                  <p className="text-xs text-muted-foreground">Coinbase, Binance, Kraken, etc.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSubView('no-ada')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">I don&apos;t have ADA yet</p>
                  <p className="text-xs text-muted-foreground">
                    I want to learn how to get started
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-muted-foreground/20 transition-colors"
              onClick={() => handleComplete('exploring')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-muted-foreground">
                    I&apos;m just exploring
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Not ready yet &mdash; explore governance first
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {subView === 'exchange' && (
        <motion.div
          key="exchange"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={spring.snappy}
        >
          <ExchangeGuide onDone={() => handleComplete('cex')} onBack={() => setSubView('cards')} />
        </motion.div>
      )}

      {subView === 'no-ada' && (
        <motion.div
          key="no-ada"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={spring.snappy}
        >
          <NoAdaGuide
            passport={passport}
            onDone={() => handleComplete('no-ada')}
            onBack={() => setSubView('cards')}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
