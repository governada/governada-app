'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { posthog } from '@/lib/posthog';

const STORAGE_KEY = 'governada:notification-prefs';

export interface NotificationPrefs {
  matchInterests: boolean;
  expiringAlerts: boolean;
  drepFollowVotes: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  matchInterests: true,
  expiringAlerts: true,
  drepFollowVotes: false,
};

function loadPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PREFS;
}

function savePrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

/**
 * NotificationPreferences — collapsible settings panel for proposal alerts.
 * Persists to localStorage. Shows as a compact icon row when collapsed.
 */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  const updatePref = useCallback(
    (key: keyof NotificationPrefs, value: boolean) => {
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      savePrefs(next);
      posthog.capture('notification_preference_changed', {
        preference: key,
        enabled: value,
      });
    },
    [prefs],
  );

  if (!mounted) return null;

  // Count active notifications
  const activeCount = [prefs.matchInterests, prefs.expiringAlerts, prefs.drepFollowVotes].filter(
    Boolean,
  ).length;

  return (
    <Card className="border-border/50">
      {/* Compact header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium text-foreground">Alerts</span>
          <span className="text-muted-foreground">{activeCount} active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Settings className="h-3 w-3 text-muted-foreground" />
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded settings */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="pref-match" className="text-[11px] text-foreground/80 cursor-pointer">
              Highlight proposals matching my interests
            </Label>
            <Switch
              id="pref-match"
              checked={prefs.matchInterests}
              onCheckedChange={(v) => updatePref('matchInterests', v)}
              className="scale-75"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="pref-expiring"
              className="text-[11px] text-foreground/80 cursor-pointer"
            >
              Alert me when proposals are expiring soon
            </Label>
            <Switch
              id="pref-expiring"
              checked={prefs.expiringAlerts}
              onCheckedChange={(v) => updatePref('expiringAlerts', v)}
              className="scale-75"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="pref-drep-follow"
              className="text-[11px] text-foreground/80 cursor-pointer"
            >
              Tell me when DReps I follow vote
            </Label>
            <Switch
              id="pref-drep-follow"
              checked={prefs.drepFollowVotes}
              onCheckedChange={(v) => updatePref('drepFollowVotes', v)}
              className="scale-75"
            />
          </div>

          <p className="text-[9px] text-muted-foreground/60 pt-1">
            Preferences saved locally. Account-synced preferences coming soon.
          </p>
        </div>
      )}
    </Card>
  );
}

/**
 * Hook to read current notification preferences from localStorage.
 */
export function useNotificationPrefs(): NotificationPrefs {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs());

    // Re-read if storage changes (e.g., from another tab)
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setPrefs(loadPrefs());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return prefs;
}
