'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface GovernadaWordmarkProps {
  className?: string;
  /** 'default' shows full wordmark, 'compact' shows just the G icon */
  size?: 'default' | 'compact';
  /** Apply text shadow for legibility over transparent backgrounds */
  shadow?: boolean;
}

/**
 * Governada wordmark — G icon + gradient "overnada" text.
 * Links to home. The gradient flows through the Compass palette:
 * Compass Teal → Wayfinder Amber → Meridian Violet.
 */
export function GovernadaWordmark({
  className,
  size = 'default',
  shadow = false,
}: GovernadaWordmarkProps) {
  return (
    <Link
      href="/"
      className={cn(
        'flex items-center gap-1.5 shrink-0 rounded',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        shadow && 'nav-text-shadow',
        className,
      )}
      aria-label="Governada home"
    >
      <Image
        src="/icons/logo-nav.png"
        alt=""
        width={24}
        height={24}
        className="shrink-0"
        priority
      />
      {size === 'default' && (
        <span className="text-[15px] font-semibold tracking-tight bg-gradient-to-r from-[oklch(0.75_0.20_192)] via-[oklch(0.80_0.18_65)] to-[oklch(0.72_0.22_295)] bg-clip-text text-transparent">
          overnada
        </span>
      )}
    </Link>
  );
}
