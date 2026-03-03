'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { getUserPrefs, saveUserPrefs } from '@/utils/userPrefs';
import { UserPrefKey } from '@/types/drep';
import { SupabaseUser } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const WalletConnectModal = dynamic(
  () => import('@/components/WalletConnectModal').then((mod) => mod.WalletConnectModal),
  { ssr: false },
);
import { Input } from '@/components/ui/input';
import {
  Shield,
  Wallet,
  Heart,
  History,
  X,
  Plus,
  ExternalLink,
  ArrowLeft,
  Loader2,
  Pencil,
  Check,
  Bell,
  BellOff,
  Compass,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { CopyableAddress } from '@/components/CopyableAddress';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/pushSubscription';
import { NotificationPreferences } from '@/components/NotificationPreferences';

const PREF_LABELS: Record<UserPrefKey, string> = {
  'treasury-conservative': 'Treasury Conservative',
  'smart-treasury-growth': 'Smart Treasury Growth',
  'strong-decentralization': 'Strong Decentralization',
  'protocol-security-first': 'Protocol Security',
  'innovation-defi-growth': 'Innovation & DeFi',
  'responsible-governance': 'Responsible Governance',
};

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, sessionAddress, connected, authenticate } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<SupabaseUser | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);
  const [drepNames, setDrepNames] = useState<Record<string, string>>({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToggling, setPushToggling] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Check push subscription status
  useEffect(() => {
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const handlePushToggle = async () => {
    setPushError(null);

    let token = getStoredSession();
    if (!token) {
      const ok = await authenticate();
      if (!ok) {
        setPushError('Wallet authentication required');
        return;
      }
      token = getStoredSession();
      if (!token) {
        setPushError('Wallet authentication required');
        return;
      }
    }

    setPushToggling(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(token);
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission === 'denied') {
          setPushError('Notifications blocked by your browser. Check your browser settings.');
          setPushToggling(false);
          return;
        }
        if (permission === 'granted') {
          const ok = await subscribeToPush(token);
          if (ok) setPushEnabled(true);
          else setPushError('Failed to enable notifications. Try again.');
        }
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Failed to toggle notifications');
    }
    setPushToggling(false);
  };

  // Fetch DRep data for watchlist name lookup
  useEffect(() => {
    fetch('/api/dreps')
      .then((res) => res.json())
      .then((data) => {
        if (data?.dreps) {
          const names: Record<string, string> = {};
          data.dreps.forEach((d: { drepId: string; name: string | null }) => {
            if (d.name) names[d.drepId] = d.name;
          });
          setDrepNames(names);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Always load localStorage prefs first
    const localPrefs = getUserPrefs();
    if (localPrefs?.userPrefs && localPrefs.userPrefs.length > 0) {
      setUserPrefs(localPrefs.userPrefs);
    }

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUserData(data);
        setDisplayName(data?.display_name || '');
        // Prefer backend prefs, fallback to localStorage
        if (data?.prefs?.userPrefs?.length > 0) {
          setUserPrefs(data.prefs.userPrefs);
          saveUserPrefs({ hasSeenOnboarding: true, userPrefs: data.prefs.userPrefs });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  const saveDisplayName = async () => {
    const token = getStoredSession();
    if (!token) return;

    setSavingName(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: displayName.trim() || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
        setIsEditingName(false);
      }
    } finally {
      setSavingName(false);
    }
  };

  const removeFromWatchlist = async (drepId: string) => {
    if (!userData) return;

    const newWatchlist = userData.watchlist.filter((id) => id !== drepId);
    setUserData({ ...userData, watchlist: newWatchlist });

    const token = getStoredSession();
    if (token) {
      await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ watchlist: newWatchlist }),
      });
    }
  };

  const removePref = (key: UserPrefKey) => {
    const newList = userPrefs.filter((k) => k !== key);
    setUserPrefs(newList);
    saveUserPrefs({ hasSeenOnboarding: true, userPrefs: newList });

    if (isAuthenticated) {
      const token = getStoredSession();
      if (token) {
        fetch('/api/user', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prefs: { userPrefs: newList, hasSeenOnboarding: true } }),
        });
      }
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 12)}...${addr.slice(-8)}`;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Connect and verify your wallet to access your profile and saved preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setWalletModalOpen(true)} className="w-full gap-2">
              <Shield className="h-4 w-4" />
              Sign In with Wallet
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>

        <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="h-9 w-48"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveDisplayName();
                    if (e.key === 'Escape') {
                      setDisplayName(userData?.display_name || '');
                      setIsEditingName(false);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={saveDisplayName}
                  disabled={savingName}
                  className="h-8 w-8 p-0"
                >
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{displayName || 'Anonymous Guardian'}</h1>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingName(true)}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            )}
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Shield className="h-3 w-3 mr-1" />
              Governance Guardian
            </Badge>
          </div>
          {sessionAddress && (
            <CopyableAddress
              address={sessionAddress}
              truncate
              className="text-sm text-muted-foreground"
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Your Preferences
            </CardTitle>
            <CardDescription>Values that boost your DRep rankings</CardDescription>
          </CardHeader>
          <CardContent>
            {userPrefs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userPrefs.map((pref) => (
                  <Badge key={pref} variant="secondary" className="gap-1 pr-1">
                    {PREF_LABELS[pref] || pref}
                    <button
                      onClick={() => removePref(pref)}
                      className="hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No preferences set yet.</p>
            )}
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/">Change Preferences</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              Watchlist
            </CardTitle>
            <CardDescription>DReps you're tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {userData?.watchlist && userData.watchlist.length > 0 ? (
              <div className="space-y-2">
                {userData.watchlist.map((drepId) => (
                  <div
                    key={drepId}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <Link
                      href={`/drep/${encodeURIComponent(drepId)}`}
                      className="text-sm hover:text-primary flex items-center gap-1"
                    >
                      {drepNames[drepId] ? (
                        <span>{drepNames[drepId]}</span>
                      ) : (
                        <span className="font-mono">{shortenAddress(drepId)}</span>
                      )}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => removeFromWatchlist(drepId)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Compass}
                title="Your Watchlist Is Empty"
                message="Explore DReps to find representatives worth watching."
                action={{ label: 'Discover DReps', href: '/discover' }}
                compact
                component="ProfileWatchlist"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Connected Wallets
            </CardTitle>
            <CardDescription>Manage your linked wallets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionAddress && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <CopyableAddress
                    address={sessionAddress}
                    truncate
                    className="text-sm text-muted-foreground"
                  />
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Primary
                  </Badge>
                </div>
              )}
              {userData?.connected_wallets
                ?.filter((w) => w !== sessionAddress)
                .map((wallet) => (
                  <div
                    key={wallet}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <CopyableAddress
                      address={wallet}
                      truncate
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4 gap-2" disabled>
              <Plus className="h-4 w-4" />
              Add Wallet (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        <NotificationPreferences />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Delegation History
            </CardTitle>
            <CardDescription>Your past delegations</CardDescription>
          </CardHeader>
          <CardContent>
            {userData?.delegation_history && userData.delegation_history.length > 0 ? (
              <div className="space-y-2">
                {userData.delegation_history.map((record, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 text-sm">
                    <CopyableAddress
                      address={record.drepId}
                      truncate
                      className="text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No delegation history yet. Delegate to a DRep to see it here!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}
