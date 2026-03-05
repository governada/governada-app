'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Home, Compass, Activity, Landmark, Search, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/utils/wallet-context';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { Button } from '@/components/ui/button';

const WalletConnectModal = dynamic(
  () => import('@/components/WalletConnectModal').then((mod) => mod.WalletConnectModal),
  { ssr: false },
);

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/pulse', label: 'Pulse', icon: Activity },
  { href: '/committee', label: 'Committee', icon: Building2 },
  { href: '/my-gov', label: 'My Gov', icon: Landmark },
] as const;

const SEGMENT_LABELS: Record<UserSegment, string> = {
  anonymous: '',
  citizen: 'Citizen',
  drep: 'DRep',
  spo: 'SPO',
};

export function CivicaHeader() {
  const pathname = usePathname();
  const { isAuthenticated, connected } = useWallet();
  const { segment } = useSegment();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <header className="sticky top-0 z-50 hidden sm:block border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight mr-6 text-foreground"
          >
            Civica
          </Link>

          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm font-medium rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4 mr-1.5" />
            <kbd className="text-xs text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </Button>

          {isAuthenticated && segment !== 'anonymous' && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {SEGMENT_LABELS[segment]}
            </span>
          )}

          {!connected && (
            <>
              <Button variant="outline" size="sm" onClick={() => setWalletModalOpen(true)}>
                Connect Wallet
              </Button>
              <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
