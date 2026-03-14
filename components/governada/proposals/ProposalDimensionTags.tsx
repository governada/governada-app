'use client';

import { cn } from '@/lib/utils';

const PREF_LABELS: Record<string, { label: string; description: string; color: string }> = {
  'treasury-conservative': {
    label: 'Treasury Conservative',
    description: 'Impacts treasury spending restraint',
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
  'smart-treasury-growth': {
    label: 'Treasury Growth',
    description: 'Impacts strategic treasury investment',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  'strong-decentralization': {
    label: 'Decentralization',
    description: 'Impacts network decentralization',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  'protocol-security-first': {
    label: 'Security',
    description: 'Impacts protocol security posture',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  'innovation-defi-growth': {
    label: 'Innovation',
    description: 'Impacts DeFi and ecosystem innovation',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  'responsible-governance': {
    label: 'Transparency',
    description: 'Impacts governance transparency',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
};

interface ProposalDimensionTagsProps {
  relevantPrefs: string[];
}

export function ProposalDimensionTags({ relevantPrefs }: ProposalDimensionTagsProps) {
  if (!relevantPrefs || relevantPrefs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        Dimensions:
      </span>
      {relevantPrefs.map((pref) => {
        const info = PREF_LABELS[pref];
        if (!info) return null;
        return (
          <span
            key={pref}
            title={info.description}
            className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', info.color)}
          >
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
