'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellOff, Bell, BellRing, BellPlus, Loader2, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet-context';
import { getStoredSession } from '@/lib/supabaseAuth';
import {
  GOVERNANCE_DEPTHS,
  TUNER_LEVELS,
  getDefaultDepthForSegment,
  type GovernanceDepth,
} from '@/lib/governanceTuner';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'depth_prompt_dismissed';

const ICON_MAP: Record<string, LucideIcon> = {
  BellOff,
  Bell,
  BellRing,
  BellPlus,
};

async function saveGovernanceDepth(depth: GovernanceDepth): Promise<void> {
  const token = getStoredSession();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/user', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ governance_depth: depth }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to save');
  }
}

export function DepthPromptModal() {
  const { segment } = useSegment();
  const { connected, isAuthenticated } = useWallet();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const defaultDepth = getDefaultDepthForSegment(segment);
  const [selectedDepth, setSelectedDepth] = useState<GovernanceDepth>(defaultDepth);

  // Check whether to show the modal
  useEffect(() => {
    if (!connected || !isAuthenticated || segment === 'anonymous') return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;
    // Short delay so the page settles before the modal appears
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [connected, isAuthenticated, segment]);

  // Update selected depth when segment changes (while modal is visible)
  useEffect(() => {
    setSelectedDepth(getDefaultDepthForSegment(segment));
  }, [segment]);

  const { mutate, isPending } = useMutation({
    mutationFn: saveGovernanceDepth,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      localStorage.setItem(STORAGE_KEY, '1');
      setOpen(false);
    },
  });

  const handleContinue = useCallback(() => {
    mutate(selectedDepth);
  }, [mutate, selectedDepth]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }, []);

  // Don't render for anonymous or unauthenticated users
  if (!connected || !isAuthenticated || segment === 'anonymous') return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How closely do you want to follow Cardano governance?</DialogTitle>
          <DialogDescription>
            This controls what you see and how often we notify you. Pick what feels right.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {GOVERNANCE_DEPTHS.map((d) => {
            const lvl = TUNER_LEVELS[d];
            const Icon = ICON_MAP[lvl.iconName] ?? Bell;
            const isSelected = d === selectedDepth;
            const isRecommended = d === defaultDepth;

            return (
              <button
                key={d}
                onClick={() => setSelectedDepth(d)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none',
                  isSelected
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50',
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    isSelected ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {lvl.label}
                    </span>
                    {isRecommended && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Recommended for you
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {lvl.shortDescription}
                  </p>
                </div>
                <div
                  className={cn(
                    'mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-all',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30 bg-transparent',
                  )}
                >
                  {isSelected && (
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleContinue} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You can change this anytime from the header or Settings.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
