'use client';

import { cn } from '@/lib/utils';
import { RING_CONFIG } from '@/lib/governanceRings';
import type { RingValues } from '@/lib/governanceRings';

interface GovernanceRingsProps {
  rings: RingValues;
  size?: number;
}

export function GovernanceRings({ rings, size = 200 }: GovernanceRingsProps) {
  const strokeWidth = 10;
  const gap = 4;
  const center = size / 2;

  // Outermost ring sits 1px inside the SVG edge plus half the stroke
  const outerRadius = size / 2 - strokeWidth / 2 - 1;

  return (
    <div className={cn('relative')} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {RING_CONFIG.map((config, i) => {
          const radius = outerRadius - i * (strokeWidth + gap);
          const circumference = 2 * Math.PI * radius;
          const fill = Math.min(Math.max(rings[config.key], 0), 1);
          const offset = circumference * (1 - fill);

          return (
            <g key={config.key}>
              {/* Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={config.trackColor}
                strokeWidth={strokeWidth}
              />
              {/* Progress arc */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={config.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              >
                <title>
                  {config.label}: {Math.round(fill * 100)}%
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
