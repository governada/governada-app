'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { chartTheme } from './theme';

interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Dimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: ChartMargin;
}

export function useChartDimensions(fixedHeight = 250, customMargin?: Partial<ChartMargin>) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract primitives to avoid object-identity dependency issues.
  // Callers often pass inline objects ({ top: 24, right: 16, ... }) which
  // create new references every render. Using primitive deps prevents the
  // useCallback from being recreated and the useEffect from re-running.
  const mt = customMargin?.top;
  const mr = customMargin?.right;
  const mb = customMargin?.bottom;
  const ml = customMargin?.left;

  const [dimensions, setDimensions] = useState<Dimensions>(() => {
    const margin: ChartMargin = {
      top: mt ?? chartTheme.margin.top,
      right: mr ?? chartTheme.margin.right,
      bottom: mb ?? chartTheme.margin.bottom,
      left: ml ?? chartTheme.margin.left,
    };
    return {
      width: 0,
      height: fixedHeight,
      innerWidth: 0,
      innerHeight: 0,
      margin,
    };
  });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const { width } = containerRef.current.getBoundingClientRect();
    const margin: ChartMargin = {
      top: mt ?? chartTheme.margin.top,
      right: mr ?? chartTheme.margin.right,
      bottom: mb ?? chartTheme.margin.bottom,
      left: ml ?? chartTheme.margin.left,
    };
    setDimensions((prev) => {
      if (
        prev.width === width &&
        prev.height === fixedHeight &&
        prev.margin.top === margin.top &&
        prev.margin.right === margin.right &&
        prev.margin.bottom === margin.bottom &&
        prev.margin.left === margin.left
      ) {
        return prev; // bail out — no state change
      }
      return {
        width,
        height: fixedHeight,
        innerWidth: Math.max(0, width - margin.left - margin.right),
        innerHeight: Math.max(0, fixedHeight - margin.top - margin.bottom),
        margin,
      };
    });
  }, [fixedHeight, mt, mr, mb, ml]);

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
