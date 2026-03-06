'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';

import type { SegmentOverride } from '@/components/providers/SegmentProvider';

const SEGMENTS: { value: SegmentOverride | null; label: string }[] = [
  { value: null, label: 'Real' },
  { value: { segment: 'anonymous' }, label: 'Anonymous' },
  { value: { segment: 'citizen' }, label: 'Citizen' },
  { value: { segment: 'drep' }, label: 'DRep' },
  { value: { segment: 'spo' }, label: 'SPO' },
];

export function AdminSimulateToggle() {
  const { isAuthenticated } = useWallet();
  const { realSegment, segment, setOverride } = useSegment();
  const [isAdmin, setIsAdmin] = useState(false);

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

  // Current override: null means "real" (no override active)
  const activeOverride = segment === realSegment ? null : segment;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex flex-col items-center gap-1.5">
        {activeOverride !== null && (
          <span className="text-[10px] text-muted-foreground bg-background/90 backdrop-blur-md rounded-full px-2 py-0.5 border">
            Actual: {realSegment}
          </span>
        )}
        <div className="flex items-center rounded-full border bg-background/90 backdrop-blur-md shadow-lg p-1 gap-0">
          {SEGMENTS.map(({ value, label }) => {
            const isActive = value?.segment === activeOverride;
            return (
              <button
                key={label}
                onClick={() => setOverride(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
