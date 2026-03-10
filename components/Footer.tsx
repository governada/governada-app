'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Copy, Check, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const GOVERNADA_HANDLE = '$governada';
const GOVERNADA_STAKE_ADDRESS = 'stake1u88sq2fanqmq0nuu7l4fjx353k99ngwmus67qr9g5jks2jgznfqnh';
const CARDANOSCAN_URL = `https://cardanoscan.io/stakekey/${GOVERNADA_STAKE_ADDRESS}`;

export function Footer() {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(GOVERNADA_STAKE_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    import('@/lib/posthog')
      .then(({ posthog }) => {
        posthog.capture('donation_address_copied', {
          handle: GOVERNADA_HANDLE,
          source: 'footer',
        });
      })
      .catch(() => {});
  };

  const handleCardanoScanClick = () => {
    import('@/lib/posthog')
      .then(({ posthog }) => {
        posthog.capture('footer_link_clicked', {
          destination: 'cardanoscan',
          url: CARDANOSCAN_URL,
          label: GOVERNADA_HANDLE,
        });
      })
      .catch(() => {});
  };

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Brand identity */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <Link href="/" className="text-lg font-bold text-primary">
              $governada
            </Link>
            <p className="text-xs text-muted-foreground">
              Cardano governance accountability, scored.
            </p>
          </div>

          {/* Center: Nav links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/discover" className="hover:text-foreground transition-colors">
              Discover DReps
            </Link>
            <Link href="/discover" className="hover:text-foreground transition-colors">
              Proposals
            </Link>
            <a
              href={CARDANOSCAN_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCardanoScanClick}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {GOVERNADA_HANDLE}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Right: Support + on-chain identity */}
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-3.5 w-3.5" />
              <span>Support this project</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={copyAddress}
                      className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
                    >
                      {GOVERNADA_HANDLE}
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {copied ? 'Address copied!' : 'Copy stake address to send ADA'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground/60">
              &copy; {new Date().getFullYear()} Governada &middot; Built on Cardano
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
