'use client';

/* eslint-disable react-hooks/set-state-in-effect -- async/external state sync in useEffect is standard React pattern */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Menu,
  Compass,
  Activity,
  Vote,
  Sparkles,
  Wallet,
  LogOut,
  User,
  Inbox,
  Shield,
  ToggleLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';

interface MobileNavProps {
  isAuthenticated: boolean;
  ownDRepId: string | null;
  isAdmin: boolean;
  onConnectWallet: () => void;
  onLogout: () => void;
  sessionAddress: string | null;
  displayName: string | null;
}

const PRIMARY_NAV_ITEMS = [
  { href: '/governance', label: 'Governance', icon: Compass },
  { href: '/governance/health', label: 'Health', icon: Activity },
];

const AUTH_NAV_ITEM = { href: '/my-gov', label: 'My Governance', icon: Vote };

const DREP_NAV_ITEMS = [
  { href: '/my-gov', label: 'Dashboard', icon: Sparkles },
  { href: '/my-gov/inbox', label: 'Governance Inbox', icon: Inbox },
];

export function MobileNav({
  isAuthenticated,
  ownDRepId,
  isAdmin,
  onConnectWallet,
  onLogout,
  sessionAddress,
  displayName,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/my-gov') return pathname === '/my-gov';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleOpen = () => {
    setOpen(true);
    posthog.capture('mobile_nav_opened', { page: pathname });
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={handleOpen}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-72 overflow-y-auto !bg-[#0a0b14]/85 backdrop-blur-xl border-l-white/5"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-left text-lg font-bold text-primary">$governada</SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-1 px-2" aria-label="Mobile navigation">
            {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  isActive(href)
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}

            {isAuthenticated && (
              <>
                <div className="my-2 border-t" />
                <Link
                  href={AUTH_NAV_ITEM.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                    isActive(AUTH_NAV_ITEM.href)
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <AUTH_NAV_ITEM.icon className="h-4 w-4" />
                  {AUTH_NAV_ITEM.label}
                </Link>
              </>
            )}

            {(ownDRepId || isAdmin) && (
              <>
                <div className="my-2 border-t" />
                {DREP_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                      isActive(href)
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          {isAdmin && (
            <div className="px-2">
              <div className="my-2 border-t" />
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Admin
              </p>
              <Link
                href="/admin/integrity"
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  isActive('/admin/integrity')
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Activity className="h-4 w-4" />
                Data Integrity
              </Link>
              <Link
                href="/admin/flags"
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  isActive('/admin/flags')
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <ToggleLeft className="h-4 w-4" />
                Feature Flags
              </Link>
            </div>
          )}

          <div className="mt-auto border-t px-2 pt-4">
            {isAuthenticated && sessionAddress ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="truncate">{displayName || shortenAddress(sessionAddress)}</span>
                </div>
                <Link
                  href="/my-gov/profile"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <button
                  onClick={() => {
                    onLogout();
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Button
                variant="default"
                className="w-full gap-2"
                onClick={() => {
                  onConnectWallet();
                  setOpen(false);
                }}
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
