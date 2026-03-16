'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  getIdentityColor,
  getDimensionLabel,
  getDimensionOrder,
  type AlignmentDimension,
} from '@/lib/drepIdentity';
import type {
  DelegationGraphNode,
  DelegationGraphCluster,
} from '@/app/api/governance/delegation-graph/route';

interface GraphData {
  nodes: DelegationGraphNode[];
  clusters: DelegationGraphCluster[];
  epoch: number;
  totalDelegators: number;
  totalPowerAda: number;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`;
  return ada.toFixed(0);
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function useDelegationGraph() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/governance/delegation-graph')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          setData(null);
        } else {
          setData(json);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

function computeLayout(
  nodes: DelegationGraphNode[],
  clusters: DelegationGraphCluster[],
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  const dimOrder = getDimensionOrder();
  const clusterByDim = new Map<AlignmentDimension, DelegationGraphNode[]>();
  for (const n of nodes) {
    const list = clusterByDim.get(n.dominant) ?? [];
    list.push(n);
    clusterByDim.set(n.dominant, list);
  }

  const sortedDims = dimOrder.filter((d) => clusterByDim.has(d));
  const angleStep = (2 * Math.PI) / Math.max(sortedDims.length, 1);

  const positions: Map<string, { x: number; y: number }> = new Map();
  const clusterCenters: Map<AlignmentDimension, { x: number; y: number }> = new Map();

  sortedDims.forEach((dim, dimIdx) => {
    const list = clusterByDim.get(dim)!;
    const sorted = [...list].sort((a, b) => b.delegatorCount - a.delegatorCount);
    const startAngle = dimIdx * angleStep - Math.PI / 2;
    const endAngle = startAngle + angleStep;
    const midAngle = (startAngle + endAngle) / 2;
    const clusterR = radius * 0.5;
    const clusterCx = cx + clusterR * Math.cos(midAngle);
    const clusterCy = cy + clusterR * Math.sin(midAngle);
    clusterCenters.set(dim, { x: clusterCx, y: clusterCy });

    const innerR = radius * 0.15;
    const outerR = radius * 0.9;
    const rStep = sorted.length > 1 ? (outerR - innerR) / (sorted.length - 1) : 0;
    const angleSpread = angleStep * 0.7;
    const angleStepPer = sorted.length > 1 ? angleSpread / (sorted.length - 1) : 0;
    const angleStart = midAngle - angleSpread / 2;

    sorted.forEach((node, i) => {
      const r = innerR + i * rStep;
      const a = angleStart + i * angleStepPer;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      positions.set(node.id, { x, y });
    });
  });

  return { positions, clusterCenters, clusterByDim };
}

export function DelegationGraph() {
  const router = useRouter();
  const { data, loading, error } = useDelegationGraph();
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: DelegationGraphNode;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 800, height: 500 };
      setDimensions({ width: Math.max(400, width), height: Math.max(500, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!data?.nodes.length) return null;
    return computeLayout(data.nodes, data.clusters, dimensions.width, dimensions.height);
  }, [data, dimensions]);

  const top20 = useMemo(() => {
    if (!data?.nodes) return new Set<string>();
    return new Set(
      [...data.nodes]
        .sort((a, b) => b.delegatorCount - a.delegatorCount)
        .slice(0, 20)
        .map((n) => n.id),
    );
  }, [data]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGElement>, node: DelegationGraphNode) => {
      const svg = (e.currentTarget as SVGElement).ownerSVGElement ?? e.currentTarget;
      const rect = svg.getBoundingClientRect();
      setHoverId(node.id);
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        node,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverId(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback(
    (node: DelegationGraphNode) => {
      router.push(`/drep/${node.id}`);
    },
    [router],
  );

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="w-full min-h-[500px] rounded-lg border bg-muted/20 animate-pulse"
      />
    );
  }

  if (error || !data) {
    return (
      <div className="w-full min-h-[500px] rounded-lg border bg-muted/20 flex items-center justify-center text-muted-foreground">
        {error ?? 'Failed to load delegation graph'}
      </div>
    );
  }

  if (!data.nodes.length) {
    return (
      <div className="w-full min-h-[500px] rounded-lg border bg-muted/20 flex items-center justify-center text-muted-foreground">
        No delegation data for epoch {data.epoch}
      </div>
    );
  }

  const { positions, clusterCenters, clusterByDim } = layout!;
  const maxDelegators = Math.max(...data.nodes.map((n) => n.delegatorCount), 1);
  const minNodeR = 4;
  const maxNodeR = 24;

  return (
    <div ref={containerRef} className="w-full min-h-[500px] relative">
      <motion.svg
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={dimensions.width} height={dimensions.height} fill="transparent" />
        {data.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const r =
            minNodeR +
            ((maxNodeR - minNodeR) * Math.log1p(node.delegatorCount)) / Math.log1p(maxDelegators);
          const center = clusterCenters.get(node.dominant);
          const isHovered = hoverId === node.id;
          const color = getScoreColor(node.score);
          const identityColor = getIdentityColor(node.dominant);

          return (
            <g key={node.id}>
              {center && (
                <line
                  x1={pos.x}
                  y1={pos.y}
                  x2={center.x}
                  y2={center.y}
                  stroke={identityColor.hex}
                  strokeOpacity={0.08}
                  strokeWidth={1}
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={color}
                stroke={isHovered ? identityColor.hex : 'rgba(255,255,255,0.15)'}
                strokeWidth={isHovered ? 2 : 1}
                opacity={isHovered ? 1 : 0.9}
                cursor="pointer"
                onMouseMove={(e) => handleMouseMove(e, node)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(node)}
                filter={isHovered ? 'url(#glow)' : undefined}
              />
              {top20.has(node.id) && (
                <text
                  x={pos.x}
                  y={pos.y - r - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                  className="fill-foreground/80"
                >
                  {node.name?.slice(0, 12) ?? node.id.slice(0, 8)}
                </text>
              )}
            </g>
          );
        })}
        {tooltip && (
          <g pointerEvents="none">
            <rect
              x={Math.min(tooltip.x + 12, dimensions.width - 220)}
              y={Math.min(tooltip.y + 12, dimensions.height - 120)}
              width={200}
              height={100}
              rx={8}
              fill="hsl(var(--card))"
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <text
              x={Math.min(tooltip.x + 22, dimensions.width - 210)}
              y={Math.min(tooltip.y + 32, dimensions.height - 100)}
              fontSize={12}
              fontWeight="600"
              fill="hsl(var(--foreground))"
            >
              {tooltip.node.name}
            </text>
            <text
              x={Math.min(tooltip.x + 22, dimensions.width - 210)}
              y={Math.min(tooltip.y + 50, dimensions.height - 82)}
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              Score: {tooltip.node.score} · {tooltip.node.delegatorCount} delegators
            </text>
            <text
              x={Math.min(tooltip.x + 22, dimensions.width - 210)}
              y={Math.min(tooltip.y + 68, dimensions.height - 64)}
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              {formatAda(tooltip.node.powerAda)} ADA
              {tooltip.node.concentrationPct != null &&
                ` · ${tooltip.node.concentrationPct.toFixed(1)}% top 10`}
            </text>
          </g>
        )}
      </motion.svg>
      <div className="flex flex-wrap gap-4 mt-4">
        {getDimensionOrder()
          .filter((d) => clusterByDim.has(d))
          .map((dim) => {
            const c = getIdentityColor(dim);
            return (
              <div key={dim} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                <span className="text-sm text-muted-foreground">
                  {getDimensionLabel(dim)} ({clusterByDim.get(dim)!.length})
                </span>
              </div>
            );
          })}
      </div>
      <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
        <span>Epoch {data.epoch}</span>
        <span>{data.totalDelegators.toLocaleString()} delegators</span>
        <span>{formatAda(data.totalPowerAda)} ADA total</span>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Score ≥ 70
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Score 40–69
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Score &lt; 40
        </span>
      </div>
    </div>
  );
}
