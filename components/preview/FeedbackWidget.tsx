'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getStoredSession } from '@/lib/supabaseAuth';

const RATE_LIMIT_MS = 30_000;

/**
 * Floating feedback widget for preview mode users.
 * Renders a button in the bottom-right corner that opens an inline form
 * for submitting feedback about the current page.
 */
export function FeedbackWidget() {
  const { isPreviewMode } = useSegment();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  // Read persona preset ID from sessionStorage
  const [presetId, setPresetId] = useState('unknown');
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('governada_preview');
      if (raw) {
        const meta = JSON.parse(raw);
        setPresetId(meta.personaPresetId ?? meta.presetId ?? 'unknown');
      }
    } catch {
      // ignore
    }
  }, []);

  const isCoolingDown = Date.now() < cooldownUntil;

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting || isCoolingDown) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = getStoredSession();
      const res = await fetch('/api/preview/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: text.trim(),
          page: pathname,
          personaPresetId: presetId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to save feedback' }));
        throw new Error(data.error ?? 'Failed to save feedback');
      }

      setSuccess(true);
      setText('');
      setCooldownUntil(Date.now() + RATE_LIMIT_MS);

      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, isCoolingDown, pathname, presetId]);

  if (!isPreviewMode) return null;

  return (
    <>
      {/* Floating trigger button */}
      <Button
        size="icon"
        className="fixed bottom-20 lg:bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Submit feedback"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
      </Button>

      {/* Feedback form panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-20 right-6 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-xl">
          {success ? (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <Check className="h-4 w-4" />
              Feedback saved!
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Page: <span className="font-mono">{pathname}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Persona: <span className="font-mono">{presetId}</span>
                </p>
              </div>

              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={4}
                placeholder="What did you notice?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={submitting}
              />

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                size="sm"
                className="w-full"
                onClick={handleSubmit}
                disabled={!text.trim() || submitting || isCoolingDown}
              >
                {submitting ? 'Sending...' : isCoolingDown ? 'Please wait...' : 'Submit Feedback'}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
