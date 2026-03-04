'use client';

import { useState } from 'react';
import { Users, ShieldCheck, FileText, Scale, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CivicaDRepBrowse } from './CivicaDRepBrowse';
import { CivicaSPOBrowse } from './CivicaSPOBrowse';
import { CivicaLeaderboard } from './CivicaLeaderboard';
import { CommitteeDiscovery } from '@/components/CommitteeDiscovery';
import { ProposalsBrowse } from './ProposalsBrowse';
import type { EnrichedDRep } from '@/lib/koios';

type TabId = 'dreps' | 'spos' | 'proposals' | 'committee' | 'rankings';

interface Tab {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string }>;
  count?: number;
}

interface CivicaDiscoverProps {
  dreps: EnrichedDRep[];
  totalAvailable: number;
  proposalCount: number;
}

export function CivicaDiscover({
  dreps,
  totalAvailable,
  proposalCount,
}: CivicaDiscoverProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dreps');

  const tabs: Tab[] = [
    { id: 'dreps', label: 'DReps', icon: Users, count: totalAvailable },
    { id: 'spos', label: 'SPOs', icon: ShieldCheck },
    { id: 'proposals', label: 'Proposals', icon: FileText, count: proposalCount },
    { id: 'committee', label: 'Committee', icon: Scale },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
  ];

  return (
    <div className="space-y-0">
      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className="border-b border-border sticky top-14 z-30 bg-background/90 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-0 overflow-x-auto scrollbar-none max-w-4xl">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap',
                'transition-colors shrink-0',
                activeTab === id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {count != null && count > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                    activeTab === id
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count > 999 ? `${Math.round(count / 1000)}k` : count}
                </span>
              )}
              {activeTab === id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div className="pt-1">
        {activeTab === 'dreps' && (
          <CivicaDRepBrowse dreps={dreps} totalAvailable={totalAvailable} />
        )}
        {activeTab === 'spos' && <CivicaSPOBrowse />}
        {activeTab === 'proposals' && <ProposalsBrowse />}
        {activeTab === 'committee' && (
          <div className="pt-4">
            <CommitteeDiscovery />
          </div>
        )}
        {activeTab === 'rankings' && <CivicaLeaderboard />}
      </div>
    </div>
  );
}
