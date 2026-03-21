'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface GovernadaLogoProps {
  className?: string;
  size?: number;
  /** Show just the icon mark (no text) */
  iconOnly?: boolean;
}

/**
 * Governada logo — G lettermark formed by connected network nodes
 * on a globe-like circular arc. Pre-rendered from Recraft AI vectorized SVG.
 */
export function GovernadaLogo({
  className,
  size = 32,
  iconOnly: _iconOnly = true,
}: GovernadaLogoProps) {
  return (
    <Image
      src="/icons/logo-nav.png"
      alt="Governada"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      priority
    />
  );
}
