'use client';

import { cn } from '@/lib/utils';

interface GovernadaLogoProps {
  className?: string;
  size?: number;
  /** Show just the icon mark (no text) */
  iconOnly?: boolean;
}

/**
 * Governada logo — G lettermark formed by connected network nodes
 * on a globe-like circular arc. Represents governance intelligence
 * connecting participants across the Cardano network.
 */
export function GovernadaLogo({
  className,
  size = 32,
  iconOnly: _iconOnly = true,
}: GovernadaLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-label="Governada logo"
      role="img"
    >
      <defs>
        <linearGradient id="governada-grad" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#5CECC8" />
          <stop offset="100%" stopColor="#3CC8A0" />
        </linearGradient>
      </defs>

      {/* Main G arc — from upper-right gap, counterclockwise around to lower-right */}
      <path
        d="M 68 19 A 35 35 0 1 0 68 58"
        fill="none"
        stroke="#4EEAC6"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* G crossbar — extends inward from the arc opening */}
      <line
        x1="68"
        y1="58"
        x2="50"
        y2="50"
        stroke="#4EEAC6"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Outer arc nodes */}
      <circle cx="68" cy="19" r="5" fill="#4EEAC6" />
      <circle cx="44" cy="7" r="4.5" fill="#4EEAC6" />
      <circle cx="20" cy="17" r="4" fill="#4EEAC6" />
      <circle cx="7" cy="38" r="5" fill="#4EEAC6" />
      <circle cx="10" cy="60" r="4" fill="#4EEAC6" />
      <circle cx="25" cy="76" r="4.5" fill="#4EEAC6" />
      <circle cx="50" cy="80" r="4" fill="#4EEAC6" />
      <circle cx="68" cy="58" r="5" fill="#4EEAC6" />

      {/* Internal network nodes */}
      <circle cx="50" cy="50" r="4.5" fill="#4EEAC6" />
      <circle cx="57" cy="33" r="3.5" fill="#4EEAC6" />

      {/* Internal connection lines — network/globe feel */}
      <line x1="44" y1="7" x2="57" y2="33" stroke="#4EEAC6" strokeWidth="3" strokeLinecap="round" />
      <line
        x1="57"
        y1="33"
        x2="68"
        y2="58"
        stroke="#4EEAC6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="57"
        y1="33"
        x2="50"
        y2="50"
        stroke="#4EEAC6"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
