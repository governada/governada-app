'use client';

import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import { treemap, hierarchy, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
import { scaleOrdinal } from 'd3-scale';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter } from '@/lib/charts/GlowDefs';
import { chartTheme, CHART_PALETTE } from '@/lib/charts/theme';
import { useTreasuryCategories, type TreasuryCategoriesResponse } from '@/hooks/queries';
import { formatAda } from '@/lib/treasury';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryData = TreasuryCategoriesResponse['categories'][number];

interface TooltipState {
  x: number;
  y: number;
  content: {
    name: string;
    ada: number;
    count?: number;
    pct?: number;
    epoch?: number;
  };
}

// Extend palette for 6 categories (base has 5)
const EXTENDED_PALETTE = [
  ...CHART_PALETTE,
  'oklch(0.65 0.12 130)', // chart-6: Olive green
] as const;

// ---------------------------------------------------------------------------
// Treemap layout helpers
// ---------------------------------------------------------------------------

/** Unified node type for both parent and leaf levels of the treemap. */
interface TreeNode {
  name: string;
  value?: number;
  txHash?: string;
  index?: number;
  epoch?: number;
  pct?: number;
  proposalCount?: number;
  children?: TreeNode[];
}

function buildCategoryHierarchy(categories: CategoryData[]): TreeNode {
  return {
    name: 'root',
    children: categories.map((c) => ({
      name: c.category,
      value: c.totalAda,
      pct: c.pctOfTotal,
      proposalCount: c.proposalCount,
    })),
  };
}

function buildDrilldownHierarchy(category: CategoryData): TreeNode {
  return {
    name: category.category,
    children: category.proposals.map((p) => ({
      name: p.title,
      value: p.amountAda,
      txHash: p.txHash,
      index: p.index,
      epoch: p.epoch,
    })),
  };
}

// ---------------------------------------------------------------------------
// Label sizing — hide if rect is too small
// ---------------------------------------------------------------------------

function labelFits(rectWidth: number, rectHeight: number, minW: number, minH: number): boolean {
  return rectWidth > minW && rectHeight > minH;
}

function labelFontSize(rectWidth: number, rectHeight: number): number {
  const minDim = Math.min(rectWidth, rectHeight);
  if (minDim < 40) return 10;
  if (minDim < 60) return 11;
  if (minDim < 100) return 12;
  return 13;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpendingTreemap() {
  const { data, isLoading, error } = useTreasuryCategories();
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);

  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { containerRef, dimensions } = useChartDimensions(400, {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
  const { width, height } = dimensions;

  const colorScale = useMemo(
    () =>
      scaleOrdinal<string, string>()
        .domain(categories.map((c) => c.category))
        .range([...EXTENDED_PALETTE]),
    [categories],
  );

  // Active data: top-level categories or drilldown proposals
  const activeCategoryData = useMemo(
    () => (drillCategory ? (categories.find((c) => c.category === drillCategory) ?? null) : null),
    [categories, drillCategory],
  );

  const treeData = useMemo(() => {
    if (activeCategoryData) return buildDrilldownHierarchy(activeCategoryData);
    return buildCategoryHierarchy(categories);
  }, [categories, activeCategoryData]);

  const nodes: HierarchyRectangularNode<TreeNode>[] = useMemo(() => {
    if (width === 0 || height === 0 || !treeData.children?.length) return [];

    const root = hierarchy(treeData)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<TreeNode>()
      .size([width, height])
      .padding(2)
      .tile(treemapSquarify.ratio(1.2));

    return layout(root).leaves();
  }, [treeData, width, height]);

  // -- Handlers --

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>, nodeData: TreeNode, idx: number) => {
      const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
      if (!svgRect) return;
      setHoveredIdx(idx);
      setTooltip({
        x: e.clientX - svgRect.left,
        y: e.clientY - svgRect.top,
        content: {
          name: nodeData.name,
          ada: nodeData.value ?? 0,
          count: nodeData.proposalCount,
          pct: nodeData.pct,
          epoch: nodeData.epoch,
        },
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback(
    (nodeData: TreeNode) => {
      if (drillCategory) {
        // In drilldown — clicking a proposal does nothing here;
        // the Link wrapper handles navigation
        return;
      }
      // Drill into category
      setDrillCategory(nodeData.name);
      setTooltip(null);
      setHoveredIdx(null);
    },
    [drillCategory],
  );

  const handleBack = useCallback(() => {
    setDrillCategory(null);
    setTooltip(null);
    setHoveredIdx(null);
  }, []);

  // -- Render --

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (error)
    return <div className="text-sm text-muted-foreground">Failed to load spending data</div>;
  if (categories.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        No enacted treasury withdrawals yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drillCategory && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Categories
          </Button>
          <span className="text-sm font-medium">{drillCategory}</span>
        </div>
      )}

      <div ref={containerRef} className="w-full">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="select-none"
            style={{ fontFamily: chartTheme.font.family }}
          >
            <defs>
              <GlowFilter id="treemap-glow" stdDeviation={6} />
            </defs>

            {nodes.map((node, i) => {
              const d = node.data;
              const { x0, y0, x1, y1 } = node;
              const w = x1 - x0;
              const h = y1 - y0;
              if (w < 1 || h < 1) return null;

              const fill = drillCategory ? colorScale(drillCategory) : colorScale(d.name);
              const isHovered = hoveredIdx === i;
              const fontSize = labelFontSize(w, h);
              const showLabel = labelFits(w, h, 50, 28);
              const showAmount = labelFits(w, h, 70, 44);
              const isProposal = !!d.txHash;
              const nodeValue = node.value ?? 0;

              const rect = (
                <g key={`${d.name}-${i}`}>
                  {/* Glow layer on hover */}
                  {isHovered && (
                    <rect
                      x={x0}
                      y={y0}
                      width={w}
                      height={h}
                      rx={4}
                      fill={fill}
                      opacity={0.3}
                      filter="url(#treemap-glow)"
                    />
                  )}
                  <rect
                    x={x0}
                    y={y0}
                    width={w}
                    height={h}
                    rx={4}
                    fill={fill}
                    opacity={isHovered ? 0.95 : 0.75}
                    stroke={isHovered ? 'white' : 'transparent'}
                    strokeWidth={isHovered ? 1.5 : 0}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseMove={(e) => handleMouseMove(e, d, i)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleClick(d)}
                  />
                  {showLabel && (
                    <text
                      x={x0 + 8}
                      y={y0 + 6 + fontSize}
                      fontSize={fontSize}
                      fontWeight={600}
                      fill="white"
                      className="pointer-events-none"
                      clipPath={`inset(0 0 0 0)`}
                    >
                      <tspan>
                        {d.name.length > Math.floor(w / (fontSize * 0.55))
                          ? d.name.slice(0, Math.floor(w / (fontSize * 0.55)) - 1) + '\u2026'
                          : d.name}
                      </tspan>
                    </text>
                  )}
                  {showAmount && (
                    <text
                      x={x0 + 8}
                      y={y0 + 8 + fontSize + fontSize + 2}
                      fontSize={fontSize - 1}
                      fontWeight={400}
                      fill="white"
                      opacity={0.8}
                      fontFamily={chartTheme.font.mono}
                      className="pointer-events-none"
                    >
                      {'\u20B3'}
                      {formatAda(nodeValue)}
                    </text>
                  )}
                </g>
              );

              // Wrap proposals in a Link for navigation
              if (isProposal && d.txHash) {
                return (
                  <a
                    key={`${d.name}-${i}`}
                    href={`/proposal/${d.txHash}/${d.index}`}
                    className="cursor-pointer"
                  >
                    {rect}
                  </a>
                );
              }

              return rect;
            })}

            {/* Tooltip */}
            {tooltip && (
              <foreignObject
                x={Math.min(tooltip.x + 12, width - 220)}
                y={Math.max(tooltip.y - 80, 4)}
                width={210}
                height={100}
                className="pointer-events-none"
              >
                <div
                  className="rounded-lg border px-3 py-2 text-xs shadow-lg"
                  style={{
                    background: chartTheme.colors.tooltipBg,
                    borderColor: chartTheme.colors.tooltipBorder,
                    fontFamily: chartTheme.font.family,
                  }}
                >
                  <div className="font-semibold text-white truncate">{tooltip.content.name}</div>
                  <div className="text-white/80 font-mono tabular-nums mt-0.5">
                    {'\u20B3'}
                    {formatAda(tooltip.content.ada)} ADA
                  </div>
                  {tooltip.content.count != null && (
                    <div className="text-white/60 mt-0.5">
                      {tooltip.content.count} proposal{tooltip.content.count !== 1 ? 's' : ''}
                    </div>
                  )}
                  {tooltip.content.pct != null && (
                    <div className="text-white/60">
                      {tooltip.content.pct.toFixed(1)}% of total spending
                    </div>
                  )}
                  {tooltip.content.epoch != null && (
                    <div className="text-white/60">Enacted epoch {tooltip.content.epoch}</div>
                  )}
                </div>
              </foreignObject>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
