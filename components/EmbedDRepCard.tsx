'use client';

import { extractAlignments, getIdentityColor, getDominantDimension } from '@/lib/drepIdentity';
import { getDRepPrimaryName } from '@/utils/display';
import type { EnrichedDRep } from '@/types/drep';

interface EmbedDRepCardProps {
  drep: EnrichedDRep;
  theme: 'dark' | 'light';
}

export function EmbedDRepCard({ drep, theme }: EmbedDRepCardProps) {
  const isDark = theme === 'dark';
  const alignments = extractAlignments(drep);
  const dominant = getDominantDimension(alignments);
  const identityColor = dominant ? getIdentityColor(dominant) : null;
  const name = getDRepPrimaryName(drep);
  const accentColor = identityColor?.hex ?? '#06b6d4';

  return (
    <div
      className="p-4 rounded-xl overflow-hidden"
      style={{
        backgroundColor: isDark ? '#0a0b14' : '#ffffff',
        border: `1px solid ${accentColor}25`,
        color: isDark ? '#fff' : '#0a0b14',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 320,
      }}
    >
      {/* Top accent line */}
      <div
        className="h-0.5 -mx-4 -mt-4 mb-3"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />

      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
        >
          {(name?.[0] ?? 'D').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {identityColor?.label ?? 'DRep'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums" style={{ color: accentColor }}>
            {drep.drepScore}
          </div>
          <div className="text-[10px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>/100</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Participation" value={`${drep.effectiveParticipation ?? 0}%`} isDark={isDark} />
        <MiniStat label="Rationale" value={`${drep.rationaleRate ?? 0}%`} isDark={isDark} />
        <MiniStat label="Reliability" value={`${drep.reliabilityScore ?? 0}%`} isDark={isDark} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <a
          href={`https://drepscore.io/drep/${encodeURIComponent(drep.drepId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-medium hover:underline"
          style={{ color: accentColor }}
        >
          View full profile →
        </a>
        <span className="text-[9px]" style={{ color: isDark ? '#374151' : '#d1d5db' }}>
          drepscore.io
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}
