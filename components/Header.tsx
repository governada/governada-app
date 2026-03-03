'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { useAlignmentAlerts, AlertType } from '@/hooks/useAlignmentAlerts';
import { getStoredSession } from '@/lib/supabaseAuth';

const WalletConnectModal = dynamic(
  () => import('./WalletConnectModal').then((mod) => mod.WalletConnectModal),
  { ssr: false },
);
import { ModeToggle } from './mode-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  Shield,
  User,
  LogOut,
  TrendingDown,
  Wallet,
  Info,
  Compass,
  ScrollText,
  AlertTriangle,
  FileText,
  Vote,
  X,
  Sparkles,
  UserCircle,
  Clock,
  Activity,
  Inbox,
  Search,
} from 'lucide-react';
import { MobileNav } from './MobileNav';
import { GovernanceHeartbeat } from './GovernanceHeartbeat';
import { StreakBadge } from './StreakBadge';

const ALERT_ICONS: Record<AlertType, typeof TrendingDown> = {
  'representation-shift': TrendingDown,
  inactivity: AlertTriangle,
  'new-proposals': FileText,
  'vote-activity': Vote,
  'drep-score-change': Sparkles,
  'drep-profile-gap': UserCircle,
  'drep-missed-epoch': Clock,
  'drep-pending-proposals': Vote,
  'drep-urgent-deadline': Clock,
  'critical-proposal-open': AlertTriangle,
  'drep-missing-votes': Vote,
};

const ALERT_COLORS: Record<AlertType, string> = {
  'representation-shift': 'text-amber-500',
  inactivity: 'text-amber-500',
  'new-proposals': 'text-blue-500',
  'vote-activity': 'text-primary',
  'drep-score-change': 'text-green-500',
  'drep-profile-gap': 'text-amber-500',
  'drep-missed-epoch': 'text-red-500',
  'drep-pending-proposals': 'text-blue-500',
  'drep-urgent-deadline': 'text-red-500',
  'critical-proposal-open': 'text-red-500',
  'drep-missing-votes': 'text-amber-500',
};

export function Header() {
  const { isAuthenticated, sessionAddress, address, connected, ownDRepId, logout } = useWallet();
  const { alerts, unreadCount, dismissAlert } = useAlignmentAlerts();
  const pathname = usePathname();
  const router = useRouter();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };
  const navLinkClass = (href: string) =>
    `hidden sm:flex items-center gap-1 text-sm transition-colors relative ${headerTransparent ? 'nav-text-shadow' : ''} ${
      isActive(href)
        ? 'font-medium text-primary after:absolute after:bottom-[-18px] after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full dark:after:shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]'
        : headerTransparent
          ? 'text-white/80 hover:text-white'
          : 'text-muted-foreground hover:text-foreground'
    }`;

  useEffect(() => {
    if (!isAuthenticated) {
      setDisplayName(null);
      return;
    }
    const token = getStoredSession();
    if (!token) return;
    fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.display_name) setDisplayName(data.display_name);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const adminCheckAddress = sessionAddress || address;
  useEffect(() => {
    if (!adminCheckAddress) {
      setIsAdmin(false);
      return;
    }
    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: adminCheckAddress }),
    })
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [adminCheckAddress]);

  const [inboxCount, setInboxCount] = useState(0);
  useEffect(() => {
    if (!ownDRepId) {
      setInboxCount(0);
      return;
    }
    fetch(`/api/dashboard/inbox?drepId=${encodeURIComponent(ownDRepId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.pendingCount) setInboxCount(data.pendingCount);
      })
      .catch(() => {});
  }, [ownDRepId]);

  const [visitStreak, setVisitStreak] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) {
      setVisitStreak(0);
      return;
    }
    const token = getStoredSession();
    if (!token) return;
    fetch('/api/governance/holder', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.visitStreak) setVisitStreak(data.visitStreak);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const [skipPushPrompt, setSkipPushPrompt] = useState(false);
  const [scrolledDown, setScrolledDown] = useState(false);
  const isHomepage = pathname === '/';
  const headerTransparent = isHomepage && !scrolledDown;

  useEffect(() => {
    if (!isHomepage) return;
    const onScroll = () => setScrolledDown(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHomepage]);

  useEffect(() => {
    const handler = (e: Event) => {
      setSkipPushPrompt(!!(e as CustomEvent).detail?.skipPushPrompt);
      setWalletModalOpen(true);
    };
    window.addEventListener('openWalletConnect', handler);
    return () => window.removeEventListener('openWalletConnect', handler);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        headerTransparent
          ? 'bg-transparent border-b border-transparent'
          : 'bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 dark:border-b-0 dark:shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.06)] border-b'
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-primary dark:drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]">
              $drepscore
            </span>
          </Link>
          <GovernanceHeartbeat />
        </div>

        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/discover" className={navLinkClass('/discover')}>
            <Compass className="h-4 w-4" />
            <span>Discover</span>
          </Link>
          <Link href="/proposals" className={navLinkClass('/proposals')}>
            <ScrollText className="h-4 w-4" />
            <span>Proposals</span>
          </Link>
          <Link href="/pulse" className={navLinkClass('/pulse')}>
            <Activity className="h-4 w-4" />
            <span>Pulse</span>
          </Link>
          {isAuthenticated && (
            <Link href="/governance" className={navLinkClass('/governance')}>
              <Vote className="h-4 w-4" />
              <span>My Governance</span>
            </Link>
          )}
          {(ownDRepId || isAdmin) && (
            <Link href="/dashboard" className={navLinkClass('/dashboard')}>
              <Sparkles className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
              )
            }
            className="hidden sm:inline-flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-2"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Search</span>
            <kbd className="hidden md:inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          {isAuthenticated && sessionAddress ? (
            <>
              <StreakBadge streak={visitStreak} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:text-primary hover:bg-primary/10"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Alerts</span>
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {alerts.length === 0 ? (
                    <DropdownMenuItem className="flex items-center gap-3 p-3 cursor-default text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span className="text-sm">No alerts right now</span>
                    </DropdownMenuItem>
                  ) : (
                    alerts.map((alert) => {
                      const IconComponent = ALERT_ICONS[alert.type] || Info;
                      const colorClass = ALERT_COLORS[alert.type] || 'text-muted-foreground';

                      return (
                        <div key={alert.id} className="relative group">
                          <DropdownMenuItem
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted pr-8"
                            onSelect={() => {
                              if (alert.link) router.push(alert.link);
                            }}
                          >
                            <IconComponent
                              className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorClass}`}
                            />
                            <div className="space-y-1 flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{alert.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {alert.description}
                              </p>
                            </div>
                          </DropdownMenuItem>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                            className="absolute top-3 right-2 p-0.5 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Dismiss alert"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:text-primary hover:bg-primary/10 hover:border-primary/40"
                  >
                    <Badge
                      variant="outline"
                      className="gap-1 text-green-600 border-green-600 px-1.5 py-0"
                    >
                      <Shield className="h-3 w-3" />
                    </Badge>
                    <span className={`hidden sm:inline text-xs ${displayName ? '' : 'font-mono'}`}>
                      {displayName || shortenAddress(sessionAddress)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-3 w-3 text-green-600" />
                        {displayName || 'Governance Guardian'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {shortenAddress(sessionAddress)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => router.push('/governance')}
                    className="cursor-pointer"
                  >
                    <Vote className="h-4 w-4 mr-2" />
                    My Governance
                  </DropdownMenuItem>
                  {(ownDRepId || isAdmin) && (
                    <>
                      <DropdownMenuItem
                        onSelect={() => router.push('/dashboard')}
                        className="cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        DRep Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          router.push(
                            ownDRepId
                              ? `/dashboard/inbox?drepId=${encodeURIComponent(ownDRepId)}`
                              : '/dashboard/inbox',
                          )
                        }
                        className="cursor-pointer"
                      >
                        <Inbox className="h-4 w-4 mr-2" />
                        Governance Inbox
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onSelect={() => router.push('/profile')}
                    className="cursor-pointer"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Admin
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() => router.push('/admin/integrity')}
                        className="cursor-pointer"
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Data Integrity
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => router.push('/admin/flags')}
                        className="cursor-pointer"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Feature Flags
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setWalletModalOpen(true)}
              className="gap-2"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </Button>
          )}

          <ModeToggle />
          <MobileNav
            isAuthenticated={isAuthenticated}
            ownDRepId={ownDRepId}
            isAdmin={isAdmin}
            onConnectWallet={() => setWalletModalOpen(true)}
            onLogout={logout}
            sessionAddress={sessionAddress}
            displayName={displayName}
          />
        </nav>
      </div>

      <WalletConnectModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
        skipPushPrompt={skipPushPrompt}
      />
    </header>
  );
}
