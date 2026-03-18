'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Search,
  Bell,
  User,
  Users,
  LogOut,
  Eye,
  Shield,
  ShieldCheck,
  Scale,
  Layers,
  HelpCircle,
  CheckCheck,
  FlaskConical,
  RotateCcw,
  Sparkles,
  X,
  Loader2,
  UserCog,
} from 'lucide-react';
import { AdminViewAsPicker } from './AdminViewAsPicker';
import { DepthPickerDropdown } from './DepthPickerDropdown';
import { DepthPromptModal } from './DepthPromptModal';
import { LanguagePicker } from './LanguagePicker';
import { cn } from '@/lib/utils';
import { getStoredSession } from '@/lib/supabaseAuth';
import { HELP_ITEMS } from '@/lib/nav/config';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useWallet } from '@/utils/wallet-context';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { TIER_SCORE_COLOR, type TierKey } from '@/components/governada/cards/tierStyles';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  type Notification,
} from '@/hooks/useNotifications';
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

/* ── Notification bell dropdown ──────────────────────────────── */

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: notifData } = useNotifications(true);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const recent = (notifData?.notifications ?? []).slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={t('Notifications')}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('Notifications')}</span>
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                markAllRead.mutate();
              }}
              className="text-[10px] font-normal text-primary hover:underline cursor-pointer"
            >
              <CheckCheck className="inline h-3 w-3 mr-0.5" />
              {t('Mark all read')}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t('No notifications yet')}
          </div>
        )}
        {recent.map((n: Notification) => (
          <DropdownMenuItem
            key={n.id}
            className="flex items-start gap-2.5 py-2.5 cursor-pointer"
            onSelect={() => {
              if (!n.read) markRead.mutate([n.id]);
              if (n.action_url) router.push(n.action_url);
            }}
          >
            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm leading-snug line-clamp-1', !n.read && 'font-medium')}>
                {n.title}
              </p>
              {n.body && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
              {formatRelativeTime(n.created_at)}
            </span>
          </DropdownMenuItem>
        ))}
        {recent.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="justify-center text-xs text-primary">
              <Link href="/you">{t('View all notifications')}</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function truncateImpersonateAddress(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

export function GovernadaHeader() {
  const router = useRouter();
  const { t } = useTranslation();
  const { connected, disconnect, logout, isAuthenticated } = useWallet();
  const {
    segment,
    realSegment,
    stakeAddress,
    tier,
    setOverride,
    dimensionOverrides,
    setDimensionOverrides,
    sandboxCohortId,
    enterSandbox,
    exitSandbox,
  } = useSegment();
  const { data: adminData } = useAdminCheck(isAuthenticated);
  const isAdmin = adminData?.isAdmin === true;
  const hasOverride = segment !== realSegment;
  const hasDimensionOverrides = Object.values(dimensionOverrides).some((v) => v != null);
  const presetsBySegment = getPresetsBySegment();
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [pickerPreset, setPickerPreset] = useState<SegmentPreset | null>(null);
  // For dual-role 2-step picker: stash the first pick while the second picker is open
  const [pendingDualOverride, setPendingDualOverride] = useState<{
    preset: SegmentPreset;
    firstId: string;
  } | null>(null);

  // Impersonation state (persisted in sessionStorage)
  const [impersonation, setImpersonation] = useState<{
    address: string;
    segment: string;
    displayName: string | null;
  } | null>(null);

  // Load impersonation from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('governada_impersonate');
      if (stored) {
        setImpersonation(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleExitImpersonation = useCallback(() => {
    setOverride(null);
    sessionStorage.removeItem('governada_impersonate');
    setImpersonation(null);
    router.push('/admin/users');
  }, [setOverride, router]);

  // Sandbox state
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxCohortName, setSandboxCohortName] = useState<string | null>(null);
  const [sandboxActionStatus, setSandboxActionStatus] = useState<string | null>(null);

  // Fetch sandbox cohort name when active
  useEffect(() => {
    if (!sandboxCohortId || !isAdmin) {
      setSandboxCohortName(null);
      return;
    }
    const fetchName = async () => {
      try {
        const token = getStoredSession();
        const res = await fetch('/api/admin/sandbox', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const cohort = (data.cohorts ?? []).find(
          (c: { id: string; name: string }) => c.id === sandboxCohortId,
        );
        if (cohort) setSandboxCohortName(cohort.name);
      } catch {
        // Ignore fetch errors
      }
    };
    fetchName();
  }, [sandboxCohortId, isAdmin]);

  const handleEnterSandbox = useCallback(async () => {
    setSandboxLoading(true);
    setSandboxActionStatus(null);
    try {
      const token = getStoredSession();
      const res = await fetch('/api/admin/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'create' }),
      });
      if (!res.ok) {
        setSandboxActionStatus('Failed to create sandbox');
        return;
      }
      const data = await res.json();
      if (data.cohort?.id) {
        enterSandbox(data.cohort.id);
        setSandboxCohortName(data.cohort.name ?? null);
        setSandboxActionStatus(data.created ? 'Sandbox created' : 'Sandbox activated');
      }
    } catch {
      setSandboxActionStatus('Failed to create sandbox');
    } finally {
      setSandboxLoading(false);
    }
  }, [enterSandbox]);

  const handleResetSandbox = useCallback(async () => {
    if (!sandboxCohortId) return;
    setSandboxLoading(true);
    setSandboxActionStatus(null);
    try {
      const token = getStoredSession();
      const res = await fetch('/api/admin/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'reset', cohortId: sandboxCohortId }),
      });
      if (!res.ok) {
        setSandboxActionStatus('Failed to reset sandbox');
        return;
      }
      const data = await res.json();
      const d = data.deleted ?? {};
      setSandboxActionStatus(`Reset: ${d.drafts ?? 0} drafts, ${d.reviews ?? 0} reviews removed`);
    } catch {
      setSandboxActionStatus('Failed to reset sandbox');
    } finally {
      setSandboxLoading(false);
    }
  }, [sandboxCohortId]);

  const handleGenerateScenarios = useCallback(async () => {
    if (!sandboxCohortId) return;
    setSandboxLoading(true);
    setSandboxActionStatus(null);
    try {
      const token = getStoredSession();
      const res = await fetch('/api/admin/preview/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ cohortId: sandboxCohortId }),
      });
      if (!res.ok) {
        setSandboxActionStatus('Failed to generate scenarios');
        return;
      }
      const data = await res.json();
      setSandboxActionStatus(
        `Generated: ${data.proposalsCreated ?? 0} proposals, ${data.reviewsCreated ?? 0} reviews`,
      );
    } catch {
      setSandboxActionStatus('Failed to generate scenarios');
    } finally {
      setSandboxLoading(false);
    }
  }, [sandboxCohortId]);

  const handleExitSandbox = useCallback(() => {
    exitSandbox();
    setSandboxCohortName(null);
    setSandboxActionStatus(null);
  }, [exitSandbox]);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerTransparent = !scrolled;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 hidden md:block transition-[background-color,border-color,backdrop-filter] duration-300',
        headerTransparent
          ? 'bg-transparent'
          : 'border-b border-border/20 bg-background/60 backdrop-blur-xl',
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

          {/* Governance depth picker (desktop only) */}
          {connected && isAuthenticated && <DepthPickerDropdown />}

          {/* Notification bell dropdown */}
          {connected && isAuthenticated && <NotificationBell unreadCount={unreadCount} />}

          {/* Help dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label={t('Help')}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {HELP_ITEMS.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href}>
                    <Icon className="h-4 w-4" />
                    {t(label)}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language picker */}
          <LanguagePicker />

          {connected && isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    hasOverride || hasDimensionOverrides || sandboxCohortId
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                      : 'text-muted-foreground bg-muted hover:bg-accent hover:text-accent-foreground',
                  )}
                  aria-label="User menu"
                >
                  {(() => {
                    if (sandboxCohortId) return <FlaskConical className="h-3.5 w-3.5" />;
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
                  {t('Profile & Settings')}
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
                        {/* Sandbox mode controls */}
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <FlaskConical className="h-4 w-4" />
                            Sandbox{sandboxCohortId ? ' (active)' : ''}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-64">
                            {!sandboxCohortId ? (
                              <>
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  Test workflows without affecting production data
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  disabled={sandboxLoading}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleEnterSandbox();
                                  }}
                                >
                                  {sandboxLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FlaskConical className="h-4 w-4" />
                                  )}
                                  Enter Sandbox
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuLabel className="text-xs">
                                  <span className="text-amber-500">Sandbox active</span>
                                  {sandboxCohortName && (
                                    <span className="block text-muted-foreground font-normal mt-0.5 truncate">
                                      {sandboxCohortName}
                                    </span>
                                  )}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={sandboxLoading}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleGenerateScenarios();
                                  }}
                                >
                                  {sandboxLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                  Generate Scenarios
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={sandboxLoading}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleResetSandbox();
                                  }}
                                >
                                  {sandboxLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4" />
                                  )}
                                  Reset Sandbox
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleExitSandbox();
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                  Exit Sandbox
                                </DropdownMenuItem>
                              </>
                            )}
                            {sandboxActionStatus && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                  {sandboxActionStatus}
                                </div>
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
                    sessionStorage.removeItem('governada_segment');
                    sessionStorage.removeItem('governada_impersonate');
                    setImpersonation(null);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t('Disconnect Wallet')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setWalletModalOpen(true)}
              >
                {t('Connect Wallet')}
              </Button>
              <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
            </>
          )}
        </div>
      </div>
      {/* Impersonation banner */}
      {isAdmin && impersonation && (
        <div className="mx-auto max-w-7xl flex items-center justify-between h-8 px-6 bg-violet-500/15 border-t border-violet-500/20">
          <div className="flex items-center gap-2 text-xs text-violet-400">
            <UserCog className="h-3.5 w-3.5" />
            <span>
              Impersonating:{' '}
              <span className="font-medium">
                {impersonation.displayName || truncateImpersonateAddress(impersonation.address)}
              </span>
              <span className="text-violet-400/60 ml-1.5">({impersonation.segment})</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/20"
            onClick={handleExitImpersonation}
          >
            <X className="h-3 w-3 mr-1" />
            Exit
          </Button>
        </div>
      )}
      {/* Primary picker (or first step of dual-role picker) */}
      {isAdmin && pickerPreset?.requiresPicker && !pendingDualOverride && (
        <AdminViewAsPicker
          mode={pickerPreset.requiresPicker}
          open={!!pickerPreset}
          onOpenChange={(open) => {
            if (!open) setPickerPreset(null);
          }}
          onSelect={(id) => {
            const p = pickerPreset;
            if (!p) return;

            // If this preset has a secondary picker, stash the first pick and proceed to step 2
            if (p.secondaryPicker) {
              setPendingDualOverride({ preset: p, firstId: id });
              return;
            }

            // Single-step picker — apply immediately
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
      {/* Secondary picker (step 2 of dual-role picker) */}
      {isAdmin && pendingDualOverride && (
        <AdminViewAsPicker
          mode={pendingDualOverride.preset.secondaryPicker!}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              // User cancelled step 2 — discard both picks
              setPendingDualOverride(null);
              setPickerPreset(null);
            }
          }}
          onSelect={(secondaryId) => {
            const { preset, firstId } = pendingDualOverride;

            // Build the override with both IDs based on picker types
            const overridePayload: Parameters<typeof setOverride>[0] = {
              segment: preset.segment,
            };
            // Map first picker result
            if (preset.requiresPicker === 'drep') {
              overridePayload.drepId = firstId;
            } else if (preset.requiresPicker === 'spo') {
              overridePayload.poolId = firstId;
            }
            // Map second picker result
            if (preset.secondaryPicker === 'spo') {
              overridePayload.poolId = secondaryId;
            } else if (preset.secondaryPicker === 'drep') {
              overridePayload.drepId = secondaryId;
            }

            setOverride(overridePayload);
            setPendingDualOverride(null);
            setPickerPreset(null);
          }}
          titleOverride={pendingDualOverride.preset.secondaryPickerTitle}
          descriptionOverride={pendingDualOverride.preset.secondaryPickerDescription}
        />
      )}
      {/* First-use governance depth prompt */}
      <DepthPromptModal />
    </header>
  );
}
