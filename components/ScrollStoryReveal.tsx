'use client';

import { type ReactNode, useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScrollStoryRevealProps {
  children: ReactNode;
  className?: string;
  variant?: 'fadeUp' | 'slideLeft' | 'slideRight' | 'scaleIn' | 'parallax';
  offset?: number;
}

function useScrollProgress(ref: React.RefObject<HTMLDivElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  return scrollYProgress;
}

const VARIANT_CONFIG = {
  fadeUp: { y: [30, 0], opacity: [0, 1], range: [0, 0.35] },
  slideLeft: { x: [-40, 0], opacity: [0, 1], range: [0, 0.35] },
  slideRight: { x: [40, 0], opacity: [0, 1], range: [0, 0.35] },
  scaleIn: { scale: [0.92, 1], opacity: [0, 1], range: [0, 0.35] },
  parallax: { y: [20, -20], opacity: [1, 1], range: [0, 1] },
};

export function ScrollStoryReveal({
  children,
  className,
  variant = 'fadeUp',
  offset = 0,
}: ScrollStoryRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const config = VARIANT_CONFIG[variant];

  const rangeStart = config.range[0] + offset * 0.05;
  const rangeEnd = config.range[1] + offset * 0.05;

  const hasY = 'y' in config;
  const hasX = 'x' in config;
  const hasScale = 'scale' in config;

  const opacity = useTransform(progress, [rangeStart, rangeEnd], config.opacity);
  const yVal = useTransform(progress, [rangeStart, rangeEnd], hasY ? (config as any).y : [0, 0]);
  const xVal = useTransform(progress, [rangeStart, rangeEnd], hasX ? (config as any).x : [0, 0]);
  const scaleVal = useTransform(
    progress,
    [rangeStart, rangeEnd],
    hasScale ? (config as any).scale : [1, 1],
  );

  const y = hasY ? yVal : undefined;
  const x = hasX ? xVal : undefined;
  const scale = hasScale ? scaleVal : undefined;

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      style={{
        opacity,
        y: y as MotionValue<number> | undefined,
        x: x as MotionValue<number> | undefined,
        scale: scale as MotionValue<number> | undefined,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </motion.div>
  );
}

interface ParallaxHeroProps {
  children: ReactNode;
  className?: string;
  speed?: number;
}

export function ParallaxHero({ children, className, speed = 0.3 }: ParallaxHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100 * speed]);

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      <motion.div style={{ y, willChange: 'transform' }}>{children}</motion.div>
    </div>
  );
}
