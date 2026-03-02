'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { chartTheme } from './theme';

interface Dimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: typeof chartTheme.margin;
}

export function useChartDimensions(
  fixedHeight = 250,
  customMargin?: Partial<typeof chartTheme.margin>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: fixedHeight,
    innerWidth: 0,
    innerHeight: 0,
    margin: { ...chartTheme.margin, ...customMargin },
  });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const { width } = containerRef.current.getBoundingClientRect();
    const margin = { ...chartTheme.margin, ...customMargin };
    setDimensions({
      width,
      height: fixedHeight,
      innerWidth: Math.max(0, width - margin.left - margin.right),
      innerHeight: Math.max(0, fixedHeight - margin.top - margin.bottom),
      margin,
    });
  }, [fixedHeight, customMargin]);

  useEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, dimensions };
}
