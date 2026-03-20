'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, X, Loader2, Check, Shield, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getStoredSession } from '@/lib/supabaseAuth';

type DigestFrequency = 'epoch' | 'weekly' | 'major_only' | 'none';

const FREQUENCY_OPTIONS: Array<{ value: DigestFrequency; label: string; desc: string }> = [
  { value: 'epoch', label: 'Every epoch', desc: '~5 days' },
  { value: 'weekly', label: 'Weekly', desc: 'Mondays' },
  { value: 'major_only', label: 'Major events', desc: 'Critical only' },
];

const FREQUENCY_DISPLAY: Record<string, string> = {
  epoch: 'Every epoch (~5 days)',
  weekly: 'Weekly (Mondays)',
  major_only: 'Major events only',
  none: 'Paused',
};

const STORAGE_KEY = 'governada_email_optin_dismissed';

interface EmailOptInProps {
  /** Show as a dismissible banner (hub/settings) vs. inline form */
  variant?: 'banner' | 'inline';
  /** Called after successful opt-in */
  onSuccess?: () => void;
  className?: string;
}

/** Fetch existing notification preferences */
async function fetchNotificationPrefs(): Promise<{
  email?: string;
  digest_frequency?: string;
} | null> {
  const token = getStoredSession();
  if (!token) return null;
  const res = await fetch('/api/you/notification-preferences', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function EmailOptIn({ variant = 'banner', onSuccess, className }: EmailOptInProps) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<DigestFrequency>('epoch');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  // B1: Fetch existing preferences to show subscribed state
  const { data: existingPrefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPrefs,
    staleTime: 5 * 60 * 1000,
  });

  const isAlreadySubscribed =
    existingPrefs?.email &&
    existingPrefs?.digest_frequency &&
    existingPrefs.digest_frequency !== 'none';

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;

      setStatus('submitting');
      setErrorMsg('');

      try {
        const token = getStoredSession();
        if (!token) {
          setErrorMsg('Please connect your wallet first.');
          setStatus('error');
          return;
        }

        const res = await fetch('/api/you/notification-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: email.trim(), digestFrequency: frequency }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save preferences');
        }

        setStatus('success');
        setEditing(false);
        onSuccess?.();

        // Track opt-in
        try {
          const { default: posthog } = await import('posthog-js');
          posthog.capture('email_opted_in', { digest_frequency: frequency });
        } catch {
          /* posthog optional */
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
        setStatus('error');
      }
    },
    [email, frequency, onSuccess],
  );

  if (dismissed && variant === 'banner') return null;

  // B1: Already subscribed — show compact status with edit option
  if (isAlreadySubscribed && status !== 'success' && !editing) {
    return (
      <div
        className={cn(
          'rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4 flex items-center justify-between gap-3',
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <Mail className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Briefings to {existingPrefs.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {FREQUENCY_DISPLAY[existingPrefs.digest_frequency!] ?? existingPrefs.digest_frequency}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEmail(existingPrefs.email ?? '');
            setFrequency((existingPrefs.digest_frequency as DigestFrequency) ?? 'epoch');
            setEditing(true);
            setStatus('idle');
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div
        className={cn(
          'rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3',
          className,
        )}
      >
        <Check className="h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-300">
            You&apos;re signed up for governance briefings
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Check your inbox for a verification email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 sm:p-5',
        variant === 'banner' && 'relative',
        className,
      )}
    >
      {variant === 'banner' && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Epoch briefings, delivered</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stay informed about your DRep&apos;s activity, proposals, and milestones.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-white/5 border-white/10 text-sm"
          disabled={status === 'submitting'}
        />

        {/* Frequency selector */}
        <div className="flex gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFrequency(opt.value)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-center transition-all text-xs',
                frequency === opt.value
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/20',
              )}
            >
              <span className="font-medium block">{opt.label}</span>
              <span className="text-[10px] opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>

        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>We&apos;ll never share your email. Unsubscribe anytime.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={status === 'submitting' || !email.trim()}>
              {status === 'submitting' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : editing ? (
                'Update'
              ) : (
                'Subscribe'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
