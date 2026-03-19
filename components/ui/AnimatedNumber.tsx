'use client';

import { useEffect, useRef, useState } from 'react';
import { useSpring, useTransform, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  format?: 'integer' | 'decimal' | 'percentage';
  prefix?: string;
  suffix?: string;
  delta?: number;
  className?: string;
  duration?: number;
}

function formatValue(v: number, format: 'integer' | 'decimal' | 'percentage'): string {
  switch (format) {
    case 'decimal':
      return v.toFixed(1);
    case 'percentage':
      return `${Math.round(v)}`;
    case 'integer':
    default:
      return `${Math.round(v)}`;
  }
}

export function AnimatedNumber({
  value,
  format = 'integer',
  prefix,
  suffix,
  delta,
  className,
  duration,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const prevValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(formatValue(value, format));

  // Spring config matching spring.smooth from lib/animations.ts
  const springValue = useSpring(prefersReducedMotion ? value : 0, {
    stiffness: 200,
    damping: 25,
    ...(duration ? { duration } : {}),
  });

  const formattedValue = useTransform(springValue, (latest) => formatValue(latest, format));

  // Subscribe to formatted value changes
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(formatValue(value, format));
      return;
    }

    const unsubscribe = formattedValue.on('change', (v) => {
      setDisplayValue(v);
    });

    return unsubscribe;
  }, [formattedValue, prefersReducedMotion, value, format]);

  // Drive the spring to the target value
  useEffect(() => {
    if (prefersReducedMotion) {
      springValue.jump(value);
      setDisplayValue(formatValue(value, format));
    } else {
      springValue.set(value);
    }
    prevValue.current = value;
  }, [value, springValue, prefersReducedMotion, format]);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
      {delta != null && delta !== 0 && (
        <span
          className={cn(
            'ml-1 text-[0.7em] font-medium',
            delta > 0 ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
        </span>
      )}
    </span>
  );
}
