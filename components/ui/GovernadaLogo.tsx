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
 *
 * Geometry: circle centered at (42, 46), radius 32.
 * Arc spans 290° from upper-right (-55°) to center-right (15°).
 * 8 evenly-spaced nodes on the arc, 2 internal nodes with connections.
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
      {/* Main G arc — 290° arc from upper-right to center-right */}
      <path
        d="M 60 20 A 32 32 0 1 0 73 54"
        fill="none"
        stroke="#4EEAC6"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* G crossbar — nearly horizontal from arc end inward */}
      <line
        x1="73"
        y1="54"
        x2="52"
        y2="48"
        stroke="#4EEAC6"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Outer arc nodes — evenly distributed */}
      <circle cx="60" cy="20" r="5" fill="#4EEAC6" />
      <circle cx="38" cy="14" r="5" fill="#4EEAC6" />
      <circle cx="18" cy="25" r="5" fill="#4EEAC6" />
      <circle cx="10" cy="46" r="5" fill="#4EEAC6" />
      <circle cx="18" cy="67" r="5" fill="#4EEAC6" />
      <circle cx="38" cy="78" r="5" fill="#4EEAC6" />
      <circle cx="60" cy="73" r="5" fill="#4EEAC6" />
      <circle cx="73" cy="54" r="5" fill="#4EEAC6" />

      {/* Internal network nodes */}
      <circle cx="55" cy="34" r="4.5" fill="#4EEAC6" />
      <circle cx="52" cy="48" r="5" fill="#4EEAC6" />

      {/* Internal connection lines */}
      <line
        x1="38"
        y1="14"
        x2="55"
        y2="34"
        stroke="#4EEAC6"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="55"
        y1="34"
        x2="52"
        y2="48"
        stroke="#4EEAC6"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
