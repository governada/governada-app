'use client';

/* eslint-disable react-hooks/set-state-in-effect -- async/external state sync in useEffect is standard React pattern */
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { useSegment } from '@/components/providers/SegmentProvider';
import { AdminViewAsPicker } from '@/components/civica/AdminViewAsPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { UserSegment, SegmentOverride } from '@/components/providers/SegmentProvider';

/** Intent for opening the entity picker after a sub-menu selection */
type PickerIntent = 'citizen-delegation' | 'drep-claimed' | 'spo-claimed' | 'cc-claimed';

/** Map picker intent to AdminViewAsPicker mode */
function pickerModeFor(intent: PickerIntent): 'drep' | 'spo' | 'cc' {
  switch (intent) {
    case 'citizen-delegation':
    case 'drep-claimed':
      return 'drep';
    case 'spo-claimed':
      return 'spo';
    case 'cc-claimed':
      return 'cc';
  }
}

/** Picker dialog titles/descriptions per intent */
function pickerProps(intent: PickerIntent) {
  switch (intent) {
    case 'citizen-delegation':
      return {
        titleOverride: 'Delegate to a DRep',
        descriptionOverride: 'Simulate being a citizen delegated to this DRep.',
      };
    case 'drep-claimed':
      return {
        titleOverride: 'View as DRep',
        descriptionOverride: 'Simulate seeing the app as this claimed DRep.',
      };
    case 'spo-claimed':
      return {
        titleOverride: 'View as SPO',
        descriptionOverride: 'Simulate seeing the app as this claimed pool operator.',
      };
    case 'cc-claimed':
      return {
        titleOverride: 'View as CC Member',
        descriptionOverride: 'Simulate seeing the app as this committee member.',
      };
  }
}

/** Human-readable label for the current simulated state */
function describeState(
  segment: UserSegment,
  realSegment: UserSegment,
  delegatedDrep: string | null,
  drepId: string | null,
  poolId: string | null,
): string {
  if (segment === realSegment) return `Real (${realSegment})`;

  switch (segment) {
    case 'anonymous':
      return 'Anonymous';
    case 'citizen':
      if (delegatedDrep === 'drep_always_abstain') return 'Citizen (Abstainer)';
      if (delegatedDrep === 'drep_always_no_confidence') return 'Citizen (No Confidence)';
      if (delegatedDrep) return 'Citizen (Delegated)';
      return 'Citizen (Undelegated)';
    case 'drep':
      return drepId ? 'DRep (Claimed)' : 'DRep (Unclaimed)';
    case 'spo':
      return poolId ? 'SPO (Claimed)' : 'SPO (Unclaimed)';
    case 'cc':
      return 'CC Member';
    default:
      return segment;
  }
}

export function AdminSimulateToggle() {
  const { isAuthenticated } = useWallet();
  const { realSegment, segment, setOverride, drepId, poolId, delegatedDrep } = useSegment();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pickerIntent, setPickerIntent] = useState<PickerIntent | null>(null);

  useEffect(() => {
    const token = getStoredSession();
    if (!isAuthenticated || !token) {
      setIsAdmin(false);
      return;
    }

    fetch('/api/admin/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsAdmin(data?.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [isAuthenticated]);

  if (!isAdmin) return null;

  const isOverriding = segment !== realSegment;
  const label = describeState(segment, realSegment, delegatedDrep, drepId, poolId);

  const applyOverride = (override: SegmentOverride | null) => setOverride(override);

  const handlePickerSelect = (id: string) => {
    switch (pickerIntent) {
      case 'citizen-delegation':
        applyOverride({ segment: 'citizen', delegatedDrep: id });
        break;
      case 'drep-claimed':
        applyOverride({ segment: 'drep', drepId: id });
        break;
      case 'spo-claimed':
        applyOverride({ segment: 'spo', poolId: id });
        break;
      case 'cc-claimed':
        // CC override — ccHotId isn't in SegmentState yet, but segment is sufficient
        applyOverride({ segment: 'cc' });
        break;
    }
    setPickerIntent(null);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex flex-col items-center gap-1.5">
          {isOverriding && (
            <span className="text-[10px] text-muted-foreground bg-background/90 backdrop-blur-md rounded-full px-2 py-0.5 border">
              Actual: {realSegment}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                  isOverriding
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-background/90 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {label}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align="center" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Simulate persona
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* ── Real ── */}
              <DropdownMenuItem onClick={() => applyOverride(null)}>
                Real ({realSegment})
              </DropdownMenuItem>

              {/* ── Anonymous ── */}
              <DropdownMenuItem onClick={() => applyOverride({ segment: 'anonymous' })}>
                Anonymous
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* ── Citizen ── */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Citizen</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() =>
                      applyOverride({
                        segment: 'citizen',
                        delegatedDrep: null,
                        delegatedPool: null,
                      })
                    }
                  >
                    Undelegated
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPickerIntent('citizen-delegation')}>
                    Delegated to&hellip;
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      applyOverride({
                        segment: 'citizen',
                        delegatedDrep: 'drep_always_abstain',
                      })
                    }
                  >
                    Abstainer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      applyOverride({
                        segment: 'citizen',
                        delegatedDrep: 'drep_always_no_confidence',
                      })
                    }
                  >
                    No Confidence
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* ── DRep ── */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>DRep</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => applyOverride({ segment: 'drep', drepId: null })}
                  >
                    Unclaimed (no profile)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPickerIntent('drep-claimed')}>
                    Claimed as&hellip;
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* ── SPO ── */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>SPO</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => applyOverride({ segment: 'spo', poolId: null })}>
                    Unclaimed (no profile)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPickerIntent('spo-claimed')}>
                    Claimed as&hellip;
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* ── CC Member ── */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>CC Member</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => applyOverride({ segment: 'cc' })}>
                    Unclaimed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPickerIntent('cc-claimed')}>
                    Claimed as&hellip;
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Entity picker modal — opens when a sub-state needs entity selection */}
      {pickerIntent && (
        <AdminViewAsPicker
          mode={pickerModeFor(pickerIntent)}
          open
          onOpenChange={(open) => {
            if (!open) setPickerIntent(null);
          }}
          onSelect={handlePickerSelect}
          {...pickerProps(pickerIntent)}
        />
      )}
    </>
  );
}
