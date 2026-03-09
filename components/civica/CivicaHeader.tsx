'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Home,
  Compass,
  Activity,
  Landmark,
  MessageCircle,
  BookOpen,
  Search,
  User,
  Users,
  LogOut,
  Sun,
  Moon,
  Eye,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { AdminViewAsPicker } from './AdminViewAsPicker';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useWallet } from '@/utils/wallet-context';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useAdminCheck } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const WalletConnectModal = dynamic(
  () => import('@/components/WalletConnectModal').then((mod) => mod.WalletConnectModal),
  { ssr: false },
);

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/pulse', label: 'Pulse', icon: Activity },
  { href: '/engage', label: 'Engage', icon: MessageCircle },
  { href: '/my-gov', label: 'My Gov', icon: Landmark },
  { href: '/learn', label: 'Learn', icon: BookOpen },
] as const;

const SEGMENT_LABELS: Record<UserSegment, string> = {
  anonymous: '',
  citizen: 'Citizen',
  drep: 'DRep',
  spo: 'SPO',
};

const SEGMENT_ICONS: Record<UserSegment, typeof User> = {
  anonymous: User,
  citizen: User,
  drep: Users,
  spo: ShieldCheck,
};

export function CivicaHeader() {
  const pathname = usePathname();
  const { connected, disconnect, logout, isAuthenticated } = useWallet();
  const { segment, realSegment, stakeAddress, delegatedDrep, setOverride } = useSegment();
  const { data: adminData } = useAdminCheck(isAuthenticated || connected);
  const isAdmin = adminData?.isAdmin === true;
  const hasOverride = segment !== realSegment;
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);
  const { resolvedTheme, setTheme } = useTheme();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'drep' | 'spo' | 'citizen-delegation' | null>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isHome = pathname === '/';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 hidden sm:block transition-colors',
        isHome ? 'bg-transparent' : 'border-b border-border/50 bg-background/80 backdrop-blur-xl',
      )}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight mr-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            governada
          </Link>

          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.filter((item) => item.href !== '/my-gov' || connected).map(
              ({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm font-medium rounded-md transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="relative inline-flex">
                      <Icon className="h-4 w-4" />
                      {href === '/my-gov' && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </span>
                    {label}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              },
            )}
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
            <kbd className="text-xs text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>

          {connected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    hasOverride
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                      : 'text-muted-foreground bg-muted hover:bg-accent hover:text-accent-foreground',
                  )}
                  aria-label="User menu"
                >
                  {(() => {
                    if (hasOverride) return <Eye className="h-3.5 w-3.5" />;
                    const SegmentIcon = SEGMENT_ICONS[segment];
                    return <SegmentIcon className="h-3.5 w-3.5" />;
                  })()}
                  {segment !== 'anonymous' && SEGMENT_LABELS[segment]}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/my-gov/profile">
                    <User className="h-4 w-4" />
                    Profile & Settings
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="h-4 w-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Eye className="h-4 w-4" />
                        View as{hasOverride ? ` (${SEGMENT_LABELS[segment]})` : ''}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Simulate segment
                        </DropdownMenuLabel>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Citizen
                            {realSegment === 'citizen' && ' (yours)'}
                            {segment === 'citizen' && hasOverride && ' ✓'}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() =>
                                setOverride({ segment: 'citizen', delegatedDrep: null })
                              }
                            >
                              Undelegated
                              {segment === 'citizen' && !delegatedDrep && hasOverride && ' ✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPickerMode('citizen-delegation')}>
                              Delegated to...
                              {segment === 'citizen' && delegatedDrep && hasOverride && ' ✓'}
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => setPickerMode('drep')}>
                          DRep
                          {realSegment === 'drep' && ' (yours)'}
                          {segment === 'drep' && hasOverride && ' ✓'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPickerMode('spo')}>
                          SPO
                          {realSegment === 'spo' && ' (yours)'}
                          {segment === 'spo' && hasOverride && ' ✓'}
                        </DropdownMenuItem>
                        {hasOverride && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setOverride(null)}>
                              Reset to {SEGMENT_LABELS[realSegment]}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    logout();
                    disconnect();
                    sessionStorage.removeItem('civica_segment');
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect Wallet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setWalletModalOpen(true)}>
                Connect Wallet
              </Button>
              <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
            </>
          )}
        </div>
      </div>
      {isAdmin && pickerMode && (
        <AdminViewAsPicker
          mode={pickerMode === 'citizen-delegation' ? 'drep' : pickerMode}
          open={!!pickerMode}
          onOpenChange={(open) => {
            if (!open) setPickerMode(null);
          }}
          onSelect={(id) => {
            if (pickerMode === 'citizen-delegation') {
              setOverride({ segment: 'citizen', delegatedDrep: id });
            } else if (pickerMode === 'drep') {
              setOverride({ segment: 'drep', drepId: id });
            } else {
              setOverride({ segment: 'spo', poolId: id });
            }
          }}
          {...(pickerMode === 'citizen-delegation' && {
            titleOverride: 'Delegate to a DRep',
            descriptionOverride: 'View the app as a citizen delegated to this DRep.',
          })}
        />
      )}
    </header>
  );
}
