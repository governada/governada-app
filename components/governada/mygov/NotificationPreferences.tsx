'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getStoredSession } from '@/lib/supabaseAuth';
import { useSegment } from '@/components/providers/SegmentProvider';

interface Preferences {
  email?: string;
  digest_frequency?: string;
  alert_drep_voted?: boolean;
  alert_coverage_changed?: boolean;
  alert_score_shifted?: boolean;
  alert_milestone_earned?: boolean;
}

async function fetchPreferences(): Promise<Preferences> {
  const token = getStoredSession();
  if (!token) return {};
  const res = await fetch('/api/you/notification-preferences', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {};
  return res.json();
}

async function savePreferences(body: Record<string, unknown>): Promise<void> {
  const token = getStoredSession();
  if (!token) return;
  await fetch('/api/you/notification-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

const DIGEST_OPTIONS = [
  { value: 'epoch', label: 'Every epoch (~5 days)' },
  { value: 'weekly', label: 'Weekly (Mondays)' },
  { value: 'major_only', label: 'Major events only' },
  { value: 'none', label: 'Off' },
] as const;

export function NotificationPreferences() {
  const { segment } = useSegment();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<Preferences>({
    queryKey: ['notification-preferences'],
    queryFn: fetchPreferences,
    enabled: segment !== 'anonymous',
    staleTime: 60_000,
  });

  const [email, setEmail] = useState('');
  const [digestFrequency, setDigestFrequency] = useState('none');
  const [alertDrepVoted, setAlertDrepVoted] = useState(true);
  const [alertCoverageChanged, setAlertCoverageChanged] = useState(true);
  const [alertScoreShifted, setAlertScoreShifted] = useState(true);
  const [alertMilestoneEarned, setAlertMilestoneEarned] = useState(true);
  const [saved, setSaved] = useState(false);

  // Sync local state when prefs load
  useEffect(() => {
    if (!prefs) return;
    setEmail(prefs.email ?? '');
    setDigestFrequency(prefs.digest_frequency ?? 'none');
    setAlertDrepVoted(prefs.alert_drep_voted ?? true);
    setAlertCoverageChanged(prefs.alert_coverage_changed ?? true);
    setAlertScoreShifted(prefs.alert_score_shifted ?? true);
    setAlertMilestoneEarned(prefs.alert_milestone_earned ?? true);
  }, [prefs]);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (body: Record<string, unknown>) => savePreferences(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function handleSave() {
    save({
      ...(email ? { email } : {}),
      digestFrequency,
      alertDrepVoted,
      alertCoverageChanged,
      alertScoreShifted,
      alertMilestoneEarned,
    });
  }

  if (segment === 'anonymous') {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-10 text-center space-y-2">
        <Mail className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Connect your wallet</p>
        <p className="text-xs text-muted-foreground">
          Sign in to manage your notification preferences.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="pref-email">
          Email address
        </label>
        <p className="text-xs text-muted-foreground">
          We&apos;ll send epoch digests and governance alerts to this address.
        </p>
        <input
          id="pref-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-all"
        />
      </div>

      {/* Digest frequency */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Digest frequency</label>
        <p className="text-xs text-muted-foreground">How often you receive epoch summary emails.</p>
        <Select value={digestFrequency} onValueChange={setDigestFrequency}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIGEST_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alert toggles */}
      <div className="space-y-1">
        <p className="text-sm font-medium">In-app alerts</p>
        <p className="text-xs text-muted-foreground mb-3">
          Choose which events trigger notifications.
        </p>
        <div className="space-y-3">
          <AlertToggle
            label="DRep voted"
            description="When your DRep casts a vote on a proposal"
            checked={alertDrepVoted}
            onCheckedChange={setAlertDrepVoted}
          />
          <AlertToggle
            label="Coverage changed"
            description="When your delegation coverage changes"
            checked={alertCoverageChanged}
            onCheckedChange={setAlertCoverageChanged}
          />
          <AlertToggle
            label="Score shifted"
            description="When your DRep's score changes significantly"
            checked={alertScoreShifted}
            onCheckedChange={setAlertScoreShifted}
          />
          <AlertToggle
            label="Milestone earned"
            description="When you reach a new governance milestone"
            checked={alertMilestoneEarned}
            onCheckedChange={setAlertMilestoneEarned}
          />
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <CheckCircle className="h-3.5 w-3.5" />
        ) : null}
        {saved ? 'Saved' : 'Save preferences'}
      </button>
    </div>
  );
}

function AlertToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
