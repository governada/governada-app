'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  SlidersHorizontal,
  BellOff,
  Bell,
  BellRing,
  BellPlus,
  Loader2,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { getStoredSession } from '@/lib/supabaseAuth';
import { GOVERNANCE_DEPTHS, TUNER_LEVELS, type GovernanceDepth } from '@/lib/governanceTuner';
import { useWallet } from '@/utils/wallet-context';

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

export function DepthPickerDropdown() {
  const { segment } = useSegment();
  const { connected, isAuthenticated } = useWallet();
  const { depth } = useGovernanceDepth();
  const queryClient = useQueryClient();

  const [optimisticDepth, setOptimisticDepth] = useState<GovernanceDepth | null>(null);
  const [saved, setSaved] = useState(false);

  const effectiveDepth = optimisticDepth ?? depth;

  const { mutate, isPending } = useMutation({
    mutationFn: saveGovernanceDepth,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      setOptimisticDepth(null);
    },
  });

  const handleSelect = useCallback(
    (value: string) => {
      const newDepth = value as GovernanceDepth;
      if (newDepth === effectiveDepth) return;
      setOptimisticDepth(newDepth);
      mutate(newDepth);
    },
    [effectiveDepth, mutate],
  );

  // Hidden for anonymous users and on mobile (CSS handles mobile hiding)
  if (!connected || !isAuthenticated || segment === 'anonymous') return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden h-8 w-8 text-muted-foreground hover:text-foreground md:flex"
          aria-label="Governance depth"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {isPending && (
            <Loader2 className="absolute -top-0.5 -right-0.5 h-3 w-3 animate-spin text-primary" />
          )}
          {saved && (
            <CheckCircle className="absolute -top-0.5 -right-0.5 h-3 w-3 text-emerald-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Governance Depth</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={effectiveDepth} onValueChange={handleSelect}>
          {GOVERNANCE_DEPTHS.map((d) => {
            const lvl = TUNER_LEVELS[d];
            const Icon = ICON_MAP[lvl.iconName] ?? Bell;
            return (
              <DropdownMenuRadioItem
                key={d}
                value={d}
                disabled={isPending}
                className="flex items-center gap-2 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{lvl.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {lvl.shortDescription}
                  </p>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Link href="/you/settings" className="text-xs text-primary hover:underline">
            Fine-tune in Settings
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
