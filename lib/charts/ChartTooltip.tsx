'use client';

import { useState, useCallback, type ReactNode, type MouseEvent } from 'react';

interface TooltipState {
  x: number;
  y: number;
  visible: boolean;
}

interface ChartTooltipProps {
  children: (props: {
    onMouseMove: (e: MouseEvent<SVGElement>) => void;
    onMouseLeave: () => void;
    tooltipX: number;
  }) => ReactNode;
  renderTooltip: (index: number) => ReactNode;
  dataLength: number;
  innerWidth: number;
  marginLeft: number;
}

export function ChartTooltip({
  children,
  renderTooltip,
  dataLength,
  innerWidth,
  marginLeft,
}: ChartTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState & { index: number }>({
    x: 0,
    y: 0,
    visible: false,
    index: 0,
  });

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGElement>) => {
      const svg = (e.target as SVGElement).closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - marginLeft;
      const relY = e.clientY - rect.top;
      const index = Math.round((relX / innerWidth) * (dataLength - 1));
      const clampedIndex = Math.max(0, Math.min(dataLength - 1, index));

      setTooltip({
        x: e.clientX - rect.left,
        y: relY,
        visible: relX >= 0 && relX <= innerWidth,
        index: clampedIndex,
      });
    },
    [dataLength, innerWidth, marginLeft],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const tooltipX = marginLeft + (tooltip.index / Math.max(1, dataLength - 1)) * innerWidth;

  return (
    <div className="relative">
      {children({
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        tooltipX,
      })}
      {tooltip.visible && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: `translate(${tooltip.x > innerWidth * 0.7 ? '-110%' : '10%'}, -50%)`,
          }}
        >
          <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs min-w-[140px] backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
            {renderTooltip(tooltip.index)}
          </div>
        </div>
      )}
    </div>
  );
}
