'use client';

import { useEffect, useState } from 'react';
import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand } from '@/lib/ghi';

interface EmbedGHIProps {
  theme: 'dark' | 'light';
}

interface GHIData {
  current: { score: number; band: GHIBand; components: { name: string; value: number }[] };
  history: { epoch_no: number; score: number }[];
  trend: { direction: string };
}

export function EmbedGHI({ theme }: EmbedGHIProps) {
  const isDark = theme === 'dark';
  const [data, setData] = useState<GHIData | null>(null);

  useEffect(() => {
    fetch('/api/governance/health-index/history?epochs=10')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div
        className="flex items-center justify-center p-6"
        style={{ backgroundColor: isDark ? '#0a0b14' : '#fff', minHeight: 120 }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#06b6d4', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const { score, band } = data.current;
  const bandColor = GHI_BAND_COLORS[band];
  const bandLabel = GHI_BAND_LABELS[band];

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        backgroundColor: isDark ? '#0a0b14' : '#fff',
        color: isDark ? '#fff' : '#0a0b14',
        border: `1px solid ${bandColor}25`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 280,
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Governance Health Index
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-4xl font-black tabular-nums" style={{ color: bandColor }}>
          {score}
        </span>
        <span className="mb-1 text-xs font-medium" style={{ color: bandColor }}>
          {bandLabel}
        </span>
      </div>

      {data.history.length > 1 && (
        <svg className="w-full" height="24" viewBox="0 0 140 24" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ghi-embed-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bandColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={bandColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          {(() => {
            const pts = data.history.map(h => h.score);
            const max = Math.max(...pts, 100);
            const min = Math.min(...pts, 0);
            const range = max - min || 1;
            const coords = pts.map((v, i) => ({
              x: 2 + (i / (pts.length - 1)) * 136,
              y: 2 + (1 - (v - min) / range) * 20,
            }));
            const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const areaD = `${lineD} L ${coords[coords.length - 1].x} 24 L ${coords[0].x} 24 Z`;
            return (
              <>
                <path d={areaD} fill="url(#ghi-embed-grad)" />
                <path d={lineD} fill="none" stroke={bandColor} strokeWidth={1.5} strokeLinecap="round" />
              </>
            );
          })()}
        </svg>
      )}

      <div className="mt-2 flex justify-between items-center">
        <a
          href="https://drepscore.io/pulse"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-medium hover:underline"
          style={{ color: '#06b6d4' }}
        >
          View full report →
        </a>
        <span className="text-[9px]" style={{ color: isDark ? '#374151' : '#d1d5db' }}>
          drepscore.io
        </span>
      </div>
    </div>
  );
}
