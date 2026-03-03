'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/pushSubscription';
import {
  type Channel,
  type EventCategory,
  type EventDefinition,
  getUserFacingEvents,
} from '@/lib/notificationRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  BellOff,
  Loader2,
  MessageCircle,
  Hash,
  Check,
  X,
  ExternalLink,
  Mail,
  Shield,
} from 'lucide-react';

interface ChannelState {
  connected: boolean;
  identifier: string;
}

interface PrefState {
  [key: string]: boolean;
}

const CHANNEL_ICONS: Record<Channel, typeof Bell> = {
  push: Bell,
  telegram: MessageCircle,
  discord: Hash,
  email: Mail,
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  drep: 'DRep Alerts',
  holder: 'Holder Alerts',
  ecosystem: 'Ecosystem',
  digest: 'Digest & Briefs',
};

const CATEGORY_ORDER: EventCategory[] = ['drep', 'holder', 'ecosystem', 'digest'];

const DIGEST_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'off', label: 'Off' },
];

export function NotificationPreferences() {
  const { connected, isAuthenticated } = useWallet();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Record<Channel, ChannelState>>({
    push: { connected: false, identifier: '' },
    telegram: { connected: false, identifier: '' },
    discord: { connected: false, identifier: '' },
    email: { connected: false, identifier: '' },
  });
  const [prefs, setPrefs] = useState<PrefState>({});
  const [pushToggling, setPushToggling] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [discordUrl, setDiscordUrl] = useState('');
  const [discordSaving, setDiscordSaving] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'none' | 'unverified' | 'verified'>('none');
  const [userEmail, setUserEmail] = useState('');
  const [digestFrequency, setDigestFrequency] = useState('weekly');
  const [digestSaving, setDigestSaving] = useState(false);
  const [isDRep, setIsDRep] = useState(false);

  const token = getStoredSession();

  // Auto-complete Telegram connect when visiting with ?telegram_connect=TOKEN
  useEffect(() => {
    const connectToken = searchParams.get('telegram_connect');
    if (!connectToken || !token || telegramConnecting) return;

    setTelegramConnecting(true);
    fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: connectToken }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setChannels((prev) => ({
            ...prev,
            telegram: { connected: true, identifier: 'connected' },
          }));
          window.history.replaceState({}, '', '/profile');
        }
      })
      .catch(() => {})
      .finally(() => setTelegramConnecting(false));
  }, [searchParams, token, telegramConnecting]);

  const loadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const pushSub = await isPushSubscribed();

      const [channelsRes, prefsRes, userRes] = await Promise.all([
        fetch('/api/user/channels', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/user/notification-prefs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const channelsData: Array<{ channel: string; channel_identifier: string }> = channelsRes.ok
        ? await channelsRes.json()
        : [];
      const prefsData: Array<{ channel: string; event_type: string; enabled: boolean }> =
        prefsRes.ok ? await prefsRes.json() : [];
      const userData = userRes.ok ? await userRes.json() : null;

      const newChannels: Record<Channel, ChannelState> = {
        push: { connected: pushSub, identifier: 'browser' },
        telegram: { connected: false, identifier: '' },
        discord: { connected: false, identifier: '' },
        email: { connected: false, identifier: '' },
      };
      for (const ch of channelsData) {
        if (ch.channel === 'telegram' || ch.channel === 'discord') {
          newChannels[ch.channel] = { connected: true, identifier: ch.channel_identifier };
        }
      }
      if (userData?.email) {
        newChannels.email = { connected: true, identifier: userData.email };
        setUserEmail(userData.email);
        setEmailStatus(userData.email_verified ? 'verified' : 'unverified');
      }
      if (userData?.digest_frequency) {
        setDigestFrequency(userData.digest_frequency);
      }
      if (userData?.claimed_drep_id) {
        setIsDRep(true);
      }
      setChannels(newChannels);

      const newPrefs: PrefState = {};
      for (const p of prefsData) {
        newPrefs[`${p.channel}:${p.event_type}`] = p.enabled;
      }
      setPrefs(newPrefs);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePushToggle = async () => {
    if (!token) return;
    setPushToggling(true);
    setPushError(null);
    try {
      if (channels.push.connected) {
        await unsubscribeFromPush(token);
        setChannels((prev) => ({ ...prev, push: { connected: false, identifier: '' } }));
      } else {
        if (!('Notification' in window)) {
          setPushError('Browser does not support notifications');
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setPushError('Permission denied');
          return;
        }
        const ok = await subscribeToPush(token);
        if (!ok) {
          setPushError('Failed to subscribe');
          return;
        }
        setChannels((prev) => ({ ...prev, push: { connected: true, identifier: 'browser' } }));
      }
    } finally {
      setPushToggling(false);
    }
  };

  const handleDiscordConnect = async () => {
    if (!token || !discordUrl.startsWith('https://discord.com/api/webhooks/')) return;
    setDiscordSaving(true);
    try {
      const res = await fetch('/api/user/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel: 'discord', channelIdentifier: discordUrl }),
      });
      if (res.ok) {
        setChannels((prev) => ({ ...prev, discord: { connected: true, identifier: discordUrl } }));
        setDiscordUrl('');
      }
    } finally {
      setDiscordSaving(false);
    }
  };

  const handleDisconnectChannel = async (channel: Channel) => {
    if (!token) return;
    if (channel === 'email') {
      await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ digest_frequency: 'off' }),
      });
      setDigestFrequency('off');
      return;
    }
    await fetch('/api/user/channels', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel }),
    });
    setChannels((prev) => ({ ...prev, [channel]: { connected: false, identifier: '' } }));
  };

  const handlePrefToggle = async (channel: Channel, eventType: string) => {
    if (!token) return;
    const key = `${channel}:${eventType}`;
    const newEnabled = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newEnabled }));

    await fetch('/api/user/notification-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, eventType, enabled: newEnabled }),
    });
  };

  const handleEmailSubmit = async () => {
    if (!token || !emailInput.includes('@')) return;
    setEmailSaving(true);
    try {
      const res = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: emailInput }),
      });
      if (res.ok) {
        setUserEmail(emailInput);
        setEmailStatus('unverified');
        setChannels((prev) => ({ ...prev, email: { connected: true, identifier: emailInput } }));
        setEmailInput('');
      }
    } finally {
      setEmailSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!token || !userEmail) return;
    setEmailSaving(true);
    try {
      await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: userEmail }),
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDigestChange = async (frequency: string) => {
    if (!token) return;
    setDigestSaving(true);
    setDigestFrequency(frequency);
    try {
      await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ digest_frequency: frequency }),
      });
    } finally {
      setDigestSaving(false);
    }
  };

  if (!isAuthenticated || !connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </CardTitle>
          <CardDescription>Connect your wallet to manage notification preferences</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const events = getUserFacingEvents(isDRep);
  const eventsByCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    events: events.filter((e) => e.category === cat),
  })).filter((g) => g.events.length > 0);

  const activeChannels = (Object.entries(channels) as Array<[Channel, ChannelState]>).filter(
    ([, s]) => s.connected,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" /> Notifications
        </CardTitle>
        <CardDescription>Choose how and when you receive governance alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel connections */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Channels
          </p>

          {/* Push */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Browser Push</p>
                <p className="text-[10px] text-muted-foreground">
                  Per-browser, works even when tab is closed
                </p>
              </div>
            </div>
            <Button
              variant={channels.push.connected ? 'outline' : 'default'}
              size="sm"
              onClick={handlePushToggle}
              disabled={pushToggling}
            >
              {pushToggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : channels.push.connected ? (
                <BellOff className="h-3.5 w-3.5 mr-1" />
              ) : (
                <Bell className="h-3.5 w-3.5 mr-1" />
              )}
              {channels.push.connected ? 'Disable' : 'Enable'}
            </Button>
          </div>
          {pushError && <p className="text-xs text-destructive">{pushError}</p>}

          {/* Email */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-[10px] text-muted-foreground">
                    {emailStatus === 'verified'
                      ? userEmail
                      : emailStatus === 'unverified'
                        ? 'Verification pending'
                        : 'Receive governance emails'}
                  </p>
                </div>
              </div>
              {emailStatus === 'verified' && (
                <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                  <Shield className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
              {emailStatus === 'unverified' && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px]">
                    Pending
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResendVerification}
                    disabled={emailSaving}
                  >
                    {emailSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Resend'}
                  </Button>
                </div>
              )}
            </div>
            {emailStatus === 'none' && (
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleEmailSubmit}
                  disabled={emailSaving || !emailInput.includes('@')}
                >
                  {emailSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                </Button>
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-[10px] text-muted-foreground">
                  {channels.telegram.connected ? 'Connected' : 'Message @DRepScoreBot to connect'}
                </p>
              </div>
            </div>
            {channels.telegram.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnectChannel('telegram')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <a href="https://t.me/DRepScoreBot" target="_blank" rel="noopener noreferrer">
                  Connect <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>

          {/* Discord */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Discord Webhook</p>
                  <p className="text-[10px] text-muted-foreground">
                    {channels.discord.connected
                      ? 'Webhook connected'
                      : 'Paste a Discord channel webhook URL'}
                  </p>
                </div>
              </div>
              {channels.discord.connected && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnectChannel('discord')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {!channels.discord.connected && (
              <div className="flex gap-2">
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleDiscordConnect}
                  disabled={
                    discordSaving || !discordUrl.startsWith('https://discord.com/api/webhooks/')
                  }
                >
                  {discordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Digest Frequency */}
        {emailStatus === 'verified' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Digest Frequency
            </p>
            <div className="flex gap-2">
              {DIGEST_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDigestChange(opt.value)}
                  disabled={digestSaving}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    digestFrequency === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Registry-driven event preferences */}
        {activeChannels.length > 0 && (
          <div className="space-y-4">
            {eventsByCategory.map((group) => (
              <div key={group.category} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.events.map((event) => (
                    <EventRow
                      key={event.key}
                      event={event}
                      activeChannels={activeChannels}
                      prefs={prefs}
                      onToggle={handlePrefToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventRow({
  event,
  activeChannels,
  prefs,
  onToggle,
}: {
  event: EventDefinition;
  activeChannels: Array<[Channel, ChannelState]>;
  prefs: PrefState;
  onToggle: (channel: Channel, eventType: string) => void;
}) {
  const availableChannels = activeChannels.filter(([ch]) => event.channels.includes(ch));
  if (availableChannels.length === 0) return null;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1 min-w-0 pr-3">
        <span className="text-sm">{event.label}</span>
        <p className="text-[10px] text-muted-foreground truncate">{event.description}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {availableChannels.map(([channel]) => {
          const key = `${channel}:${event.key}`;
          const enabled = prefs[key] ?? event.defaultChannels.includes(channel);
          const Icon = CHANNEL_ICONS[channel];
          return (
            <button
              key={channel}
              onClick={() => onToggle(channel, event.key)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}
              title={`${enabled ? 'Disable' : 'Enable'} ${event.label} on ${channel}`}
            >
              <Icon className="h-2.5 w-2.5" />
              {channel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
