'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Search,
  Bell,
  User,
  Users,
  LogOut,
  Sun,
  Moon,
  Eye,
  Shield,
  ShieldCheck,
  Scale,
  Layers,
} from 'lucide-react';
import { AdminViewAsPicker } from './AdminViewAsPicker';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useWallet } from '@/utils/wallet-context';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { TIER_SCORE_COLOR, type TierKey } from '@/components/civica/cards/tierStyles';
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
import {
  SEGMENT_MENU_GROUPS,
  CROSS_CUTTING_DIMENSIONS,
  getPresetsBySegment,
  type SegmentPreset,
} from '@/lib/admin/viewAsRegistry';

const WalletConnectModal = dynamic(
  () => import('@/components/WalletConnectModal').then((mod) => mod.WalletConnectModal),
  { ssr: false },
);

const SEGMENT_LABELS: Record<UserSegment, string> = {
  anonymous: '',
  citizen: 'Citizen',
  drep: 'DRep',
  spo: 'SPO',
  cc: 'CC Member',
};

const SEGMENT_ICONS: Record<UserSegment, typeof User> = {
  anonymous: User,
  citizen: User,
  drep: Users,
  spo: ShieldCheck,
  cc: Scale,
};

export function CivicaHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, disconnect, logout, isAuthenticated } = useWallet();
  const {
    segment,
    realSegment,
    stakeAddress,
    tier,
    setOverride,
    dimensionOverrides,
    setDimensionOverrides,
  } = useSegment();
  const { data: adminData } = useAdminCheck(isAuthenticated);
  const isAdmin = adminData?.isAdmin === true;
  const hasOverride = segment !== realSegment;
  const hasDimensionOverrides = Object.values(dimensionOverrides).some((v) => v != null);
  const presetsBySegment = getPresetsBySegment();
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);
  const { resolvedTheme, setTheme } = useTheme();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [pickerPreset, setPickerPreset] = useState<SegmentPreset | null>(null);

  const isHome = pathname === '/';

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerTransparent = isHome && !scrolled;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 hidden sm:block transition-[background-color,border-color,backdrop-filter] duration-300',
        headerTransparent
          ? 'bg-transparent'
          : 'border-b border-border/50 bg-background/80 backdrop-blur-xl',
      )}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between h-14 px-6">
        {/* Logo — sidebar handles navigation on desktop */}
        <Link
          href="/"
          className={cn(
            'font-display text-lg font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded',
            headerTransparent && 'nav-text-shadow',
          )}
        >
          governada
        </Link>

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

          {/* Notification bell */}
          {connected && isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => router.push('/you/inbox')}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          )}

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

          {connected && isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    hasOverride || hasDimensionOverrides
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                      : 'text-muted-foreground bg-muted hover:bg-accent hover:text-accent-foreground',
                  )}
                  aria-label="User menu"
                >
                  {(() => {
                    if (hasOverride || hasDimensionOverrides)
                      return <Eye className="h-3.5 w-3.5" />;
                    const SegmentIcon = SEGMENT_ICONS[segment];
                    return <SegmentIcon className="h-3.5 w-3.5" />;
                  })()}
                  {segment !== 'anonymous' && SEGMENT_LABELS[segment]}
                  {tier && (segment === 'drep' || segment === 'spo') && (
                    <>
                      <span className="text-muted-foreground/50 mx-0.5">·</span>
                      <span className={TIER_SCORE_COLOR[tier as TierKey] ?? ''}>{tier}</span>
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => router.push('/you/settings')}>
                  <User className="h-4 w-4" />
                  Profile & Settings
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
                        {/* Data-driven segment sub-menus from registry */}
                        {SEGMENT_MENU_GROUPS.map((group) => {
                          const presets = presetsBySegment.get(group.segment) ?? [];
                          return (
                            <DropdownMenuSub key={group.segment}>
                              <DropdownMenuSubTrigger>
                                {group.label}
                                {realSegment === group.segment && ' (yours)'}
                                {segment === group.segment && hasOverride && ' ✓'}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {presets.map((preset) => (
                                  <DropdownMenuItem
                                    key={preset.id}
                                    onClick={() => {
                                      if (preset.requiresPicker) {
                                        setPickerPreset(preset);
                                      } else {
                                        setOverride({
                                          segment: preset.segment,
                                          ...preset.overrides,
                                        });
                                      }
                                    }}
                                  >
                                    {preset.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          );
                        })}
                        <DropdownMenuSeparator />
                        {/* Anonymous */}
                        <DropdownMenuItem onClick={() => setOverride({ segment: 'anonymous' })}>
                          Anonymous (no wallet)
                          {segment === 'anonymous' && hasOverride && ' ✓'}
                        </DropdownMenuItem>
                        {/* Cross-cutting dimension overrides */}
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Layers className="h-4 w-4" />
                            Dimensions{hasDimensionOverrides ? ' ✓' : ''}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                              Override user state dimensions
                            </DropdownMenuLabel>
                            {CROSS_CUTTING_DIMENSIONS.map((dim) => (
                              <DropdownMenuSub key={dim.id}>
                                <DropdownMenuSubTrigger>
                                  {dim.label}
                                  {dimensionOverrides[dim.id as keyof typeof dimensionOverrides] !=
                                    null && ' ✓'}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setDimensionOverrides({
                                        ...dimensionOverrides,
                                        [dim.id]: null,
                                      })
                                    }
                                  >
                                    Auto (computed)
                                    {dimensionOverrides[
                                      dim.id as keyof typeof dimensionOverrides
                                    ] == null && ' ✓'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {dim.values.map((val) => (
                                    <DropdownMenuItem
                                      key={val.key}
                                      onClick={() =>
                                        setDimensionOverrides({
                                          ...dimensionOverrides,
                                          [dim.id]: val.key,
                                        })
                                      }
                                    >
                                      {val.label}
                                      {dimensionOverrides[
                                        dim.id as keyof typeof dimensionOverrides
                                      ] === val.key && ' ✓'}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            ))}
                            {hasDimensionOverrides && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDimensionOverrides({})}>
                                  Reset all dimensions
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {(hasOverride || hasDimensionOverrides) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setOverride(null);
                                setDimensionOverrides({});
                              }}
                            >
                              Reset all overrides
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
      {isAdmin && pickerPreset?.requiresPicker && (
        <AdminViewAsPicker
          mode={pickerPreset.requiresPicker}
          open={!!pickerPreset}
          onOpenChange={(open) => {
            if (!open) setPickerPreset(null);
          }}
          onSelect={(id) => {
            const p = pickerPreset;
            if (!p) return;
            if (p.segment === 'citizen' && p.requiresPicker === 'drep') {
              setOverride({ segment: 'citizen', delegatedDrep: id });
            } else if (p.segment === 'drep') {
              setOverride({ segment: 'drep', drepId: id });
            } else if (p.segment === 'spo') {
              setOverride({ segment: 'spo', poolId: id });
            } else if (p.segment === 'cc') {
              setOverride({ segment: 'cc' });
            }
          }}
          titleOverride={pickerPreset.pickerTitle}
          descriptionOverride={pickerPreset.pickerDescription}
        />
      )}
    </header>
  );
}
