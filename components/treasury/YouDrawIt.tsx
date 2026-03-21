'use client';

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type MouseEvent,
  type TouchEvent,
} from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveMonotoneX, area as d3area } from 'd3-shape';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Share2, RotateCcw, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import { spring, fadeInUp } from '@/lib/animations';
import { posthog } from '@/lib/posthog';
import { formatAda } from '@/lib/treasury';
import { useTreasuryHistory, useTreasurySimulate } from '@/hooks/queries';

// ── Types ────────────────────────────────────────────────────────────────────

interface DrawnPoint {
  epoch: number;
  balanceAda: number;
}

interface KeyEvent {
  epoch: number;
  label: string;
  amountAda?: number;
}

type Phase = 'challenge' | 'drawing' | 'reveal' | 'complete';

interface HistoryEntry {
  epoch: number;
  balanceAda: number;
  withdrawalsAda?: number;
}

interface SimulationScenario {
  key: string;
  name: string;
  balanceCurve: Array<{ epoch: number; balanceAda: number }>;
}

interface SimulationData {
  currentBalance: number;
  currentEpoch: number;
  scenarios: SimulationScenario[];
  counterfactual?: {
    largestWithdrawals: Array<{ title: string; amountAda: number; epoch: number }>;
  };
}

// ── Colors ───────────────────────────────────────────────────────────────────

const COLORS = {
  historical: 'oklch(0.72 0.14 200)', // chart primary (Electric Cyan)
  userDraw: 'oklch(0.80 0.16 80)', // amber-400 equivalent
  projection: 'oklch(0.72 0.17 160)', // emerald-400 equivalent
  eventDot: 'oklch(0.75 0.14 80)', // amber for event annotations
  fillHistorical: 'oklch(0.72 0.14 200 / 0.08)',
  fillUser: 'oklch(0.80 0.16 80 / 0.10)',
  fillProjection: 'oklch(0.72 0.17 160 / 0.08)',
} as const;

// ── Comparison Logic ─────────────────────────────────────────────────────────

type PredictionResult = 'close' | 'optimistic' | 'pessimistic';

function comparePrediction(
  drawnPoints: DrawnPoint[],
  projectedData: Array<{ epoch: number; balanceAda: number }>,
): { result: PredictionResult; pctDiff: number; userFinal: number; projectedFinal: number } {
  if (drawnPoints.length === 0) {
    return { result: 'close', pctDiff: 0, userFinal: 0, projectedFinal: 0 };
  }

  const userFinalPoint = drawnPoints[drawnPoints.length - 1];
  const projectedAtSameEpoch = projectedData.reduce((best, p) =>
    Math.abs(p.epoch - userFinalPoint.epoch) < Math.abs(best.epoch - userFinalPoint.epoch)
      ? p
      : best,
  );

  const projectedBalance = projectedAtSameEpoch.balanceAda;
  const pctDiff =
    projectedBalance > 0 ? (userFinalPoint.balanceAda - projectedBalance) / projectedBalance : 0;

  let result: PredictionResult;
  if (Math.abs(pctDiff) <= 0.15) {
    result = 'close';
  } else if (pctDiff > 0) {
    result = 'optimistic';
  } else {
    result = 'pessimistic';
  }

  return {
    result,
    pctDiff,
    userFinal: userFinalPoint.balanceAda,
    projectedFinal: projectedBalance,
  };
}

function getResultMessage(result: PredictionResult): {
  text: string;
  icon: typeof Award;
  className: string;
} {
  switch (result) {
    case 'close':
      return {
        text: "Impressive! You're a natural treasury analyst.",
        icon: Award,
        className: 'text-emerald-400',
      };
    case 'optimistic':
      return {
        text: "You're more optimistic than the data suggests...",
        icon: TrendingUp,
        className: 'text-amber-400',
      };
    case 'pessimistic':
      return {
        text: 'The treasury is more resilient than you thought!',
        icon: TrendingDown,
        className: 'text-sky-400',
      };
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

const CHART_HEIGHT = 400;
const FUTURE_EPOCHS = 30;

export function YouDrawIt() {
  const { data: historyRaw, isLoading: historyLoading } = useTreasuryHistory(30);
  const { data: simRaw, isLoading: simLoading } = useTreasurySimulate(1);

  const history = historyRaw as HistoryEntry[] | undefined;
  const simulation = simRaw as SimulationData | undefined;

  const loading = historyLoading || simLoading;

  // Derive data
  const historicalData = useMemo<DrawnPoint[]>(() => {
    if (!history) return [];
    return history
      .map((h) => ({ epoch: h.epoch, balanceAda: h.balanceAda }))
      .sort((a, b) => a.epoch - b.epoch);
  }, [history]);

  const currentEpoch = useMemo(
    () =>
      simulation?.currentEpoch ??
      (historicalData.length > 0 ? historicalData[historicalData.length - 1].epoch : 0),
    [simulation, historicalData],
  );

  const currentBalance = useMemo(
    () =>
      simulation?.currentBalance ??
      (historicalData.length > 0 ? historicalData[historicalData.length - 1].balanceAda : 0),
    [simulation, historicalData],
  );

  const projectedData = useMemo<DrawnPoint[]>(() => {
    if (!simulation?.scenarios) return [];
    const conservative = simulation.scenarios.find((s) => s.key === 'conservative');
    if (!conservative) return simulation.scenarios[0]?.balanceCurve ?? [];
    return conservative.balanceCurve.filter((p) => p.epoch >= currentEpoch);
  }, [simulation, currentEpoch]);

  const keyEvents = useMemo<KeyEvent[]>(() => {
    if (!simulation?.counterfactual?.largestWithdrawals) return [];
    return simulation.counterfactual.largestWithdrawals
      .filter((w) => w.epoch >= currentEpoch)
      .slice(0, 5)
      .map((w) => ({ epoch: w.epoch, label: w.title, amountAda: w.amountAda }));
  }, [simulation, currentEpoch]);

  if (loading && !historicalData.length) {
    return <Skeleton className="h-[500px] w-full rounded-xl" />;
  }

  if (!historicalData.length || !projectedData.length) {
    return null;
  }

  return (
    <YouDrawItChart
      historicalData={historicalData}
      currentBalance={currentBalance}
      currentEpoch={currentEpoch}
      projectedData={projectedData}
      keyEvents={keyEvents}
    />
  );
}

// ── Chart Component ──────────────────────────────────────────────────────────

interface YouDrawItChartProps {
  historicalData: DrawnPoint[];
  currentBalance: number;
  currentEpoch: number;
  projectedData: DrawnPoint[];
  keyEvents: KeyEvent[];
}

function YouDrawItChart({
  historicalData,
  currentBalance,
  currentEpoch,
  projectedData,
  keyEvents,
}: YouDrawItChartProps) {
  const { containerRef, dimensions } = useChartDimensions(CHART_HEIGHT, {
    left: 56,
    bottom: 40,
    top: 20,
    right: 16,
  });
  const { width, innerWidth, innerHeight, margin } = dimensions;
  const svgRef = useRef<SVGSVGElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('challenge');
  const [drawnPoints, setDrawnPoints] = useState<DrawnPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);
  const [hoveredEvent, setHoveredEvent] = useState<KeyEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const hasTrackedStart = useRef(false);

  const maxFutureEpoch = currentEpoch + FUTURE_EPOCHS;

  // ── Scales ───────────────────────────────────────────────────────────

  const allEpochs = useMemo(() => {
    const epochs = [
      ...historicalData.map((d) => d.epoch),
      maxFutureEpoch,
      ...projectedData.map((d) => d.epoch),
    ];
    return [Math.min(...epochs), Math.max(...epochs)];
  }, [historicalData, projectedData, maxFutureEpoch]);

  const allBalances = useMemo(() => {
    const balances = [
      ...historicalData.map((d) => d.balanceAda),
      ...projectedData.map((d) => d.balanceAda),
      ...drawnPoints.map((d) => d.balanceAda),
    ];
    return Math.max(...balances, 1);
  }, [historicalData, projectedData, drawnPoints]);

  const xScale = useMemo(
    () => scaleLinear().domain(allEpochs).range([0, innerWidth]),
    [allEpochs, innerWidth],
  );

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, allBalances * 1.1])
        .range([innerHeight, 0]),
    [allBalances, innerHeight],
  );

  // ── Path generators ──────────────────────────────────────────────────

  const lineGen = useMemo(
    () =>
      d3line<DrawnPoint>()
        .x((d) => xScale(d.epoch))
        .y((d) => yScale(d.balanceAda))
        .curve(curveMonotoneX),
    [xScale, yScale],
  );

  const areaGen = useMemo(
    () =>
      d3area<DrawnPoint>()
        .x((d) => xScale(d.epoch))
        .y0(innerHeight)
        .y1((d) => yScale(d.balanceAda))
        .curve(curveMonotoneX),
    [xScale, yScale, innerHeight],
  );

  const historicalPath = useMemo(() => lineGen(historicalData) ?? '', [lineGen, historicalData]);
  const historicalAreaPath = useMemo(
    () => areaGen(historicalData) ?? '',
    [areaGen, historicalData],
  );

  const userPath = useMemo(() => {
    if (drawnPoints.length < 2) return '';
    const fullPath = [{ epoch: currentEpoch, balanceAda: currentBalance }, ...drawnPoints];
    return lineGen(fullPath) ?? '';
  }, [lineGen, drawnPoints, currentEpoch, currentBalance]);

  const projectionPath = useMemo(() => lineGen(projectedData) ?? '', [lineGen, projectedData]);
  const projectionAreaPath = useMemo(() => areaGen(projectedData) ?? '', [areaGen, projectedData]);

  // Projection path length for animation
  const projectionPathLength = useMemo(() => {
    if (typeof document === 'undefined' || !projectionPath) return 1000;
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', projectionPath);
    tempSvg.appendChild(tempPath);
    document.body.appendChild(tempSvg);
    const length = tempPath.getTotalLength();
    document.body.removeChild(tempSvg);
    return length;
  }, [projectionPath]);

  // ── Drawing handlers ─────────────────────────────────────────────────

  const svgToEpochBalance = useCallback(
    (clientX: number, clientY: number): DrawnPoint | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const relX = clientX - rect.left - margin.left;
      const relY = clientY - rect.top - margin.top;

      const epoch = Math.round(xScale.invert(relX));
      const balanceAda = yScale.invert(relY);

      // Constrain: only forward from current, within bounds
      if (epoch <= currentEpoch || epoch > maxFutureEpoch) return null;
      if (balanceAda < 0) return null;

      return { epoch, balanceAda: Math.max(0, balanceAda) };
    },
    [xScale, yScale, margin, currentEpoch, maxFutureEpoch],
  );

  const handleDrawStart = useCallback(
    (clientX: number, clientY: number) => {
      if (phase !== 'challenge' && phase !== 'drawing') return;
      const point = svgToEpochBalance(clientX, clientY);
      if (!point) return;

      if (!hasTrackedStart.current) {
        posthog.capture('treasury_you_draw_it_started');
        hasTrackedStart.current = true;
      }

      setPhase('drawing');
      setIsDrawing(true);
      setDrawnPoints([point]);
    },
    [phase, svgToEpochBalance],
  );

  const handleDrawMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing) return;
      const point = svgToEpochBalance(clientX, clientY);
      if (!point) return;

      setDrawnPoints((prev) => {
        // Only allow forward movement (epoch must increase)
        if (prev.length > 0 && point.epoch <= prev[prev.length - 1].epoch) {
          return prev;
        }
        return [...prev, point];
      });
    },
    [isDrawing, svgToEpochBalance],
  );

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (drawnPoints.length >= 2) {
      setPhase('reveal');

      const { pctDiff } = comparePrediction(drawnPoints, projectedData);
      posthog.capture('treasury_you_draw_it_completed', {
        pctDiff: Math.round(pctDiff * 100),
        pointsDrawn: drawnPoints.length,
      });

      // Animate the reveal
      if (prefersReducedMotion) {
        setRevealProgress(1);
        setTimeout(() => setPhase('complete'), 300);
      } else {
        const duration = 1500;
        const start = performance.now();
        const animate = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease-out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setRevealProgress(eased);
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setPhase('complete');
          }
        };
        requestAnimationFrame(animate);
      }
    }
  }, [isDrawing, drawnPoints, projectedData, prefersReducedMotion]);

  // Mouse handlers
  const onMouseDown = useCallback(
    (e: MouseEvent<SVGRectElement>) => handleDrawStart(e.clientX, e.clientY),
    [handleDrawStart],
  );
  const onMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => handleDrawMove(e.clientX, e.clientY),
    [handleDrawMove],
  );
  const onMouseUp = useCallback(() => handleDrawEnd(), [handleDrawEnd]);

  // Touch handlers
  const onTouchStart = useCallback(
    (e: TouchEvent<SVGRectElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleDrawStart(touch.clientX, touch.clientY);
    },
    [handleDrawStart],
  );
  const onTouchMove = useCallback(
    (e: TouchEvent<SVGRectElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleDrawMove(touch.clientX, touch.clientY);
    },
    [handleDrawMove],
  );
  const onTouchEnd = useCallback(
    (e: TouchEvent<SVGRectElement>) => {
      e.preventDefault();
      handleDrawEnd();
    },
    [handleDrawEnd],
  );

  // ── Reset ────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPhase('challenge');
    setDrawnPoints([]);
    setRevealProgress(0);
    setHoveredEvent(null);
    setCopied(false);
    hasTrackedStart.current = false;
  }, []);

  // ── Share ────────────────────────────────────────────────────────────

  const handleShare = useCallback(() => {
    if (drawnPoints.length === 0) return;

    const { userFinal, projectedFinal, pctDiff } = comparePrediction(drawnPoints, projectedData);
    const direction = userFinal > projectedFinal ? 'grow' : 'shrink';

    const text = [
      `I predicted the Cardano treasury would ${direction} to ${formatAda(userFinal)} ADA.`,
      `Reality: ${formatAda(projectedFinal)} ADA (${Math.abs(Math.round(pctDiff * 100))}% ${pctDiff >= 0 ? 'above' : 'below'}).`,
      '',
      'Try it yourself at governada.io/governance/treasury',
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

    posthog.capture('treasury_prediction_shared', {
      pctDiff: Math.round(pctDiff * 100),
      userPrediction: userFinal,
      actual: projectedFinal,
    });
  }, [drawnPoints, projectedData]);

  // ── Axis ticks ───────────────────────────────────────────────────────

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);
  const xTicks = useMemo(() => xScale.ticks(8).map(Math.round), [xScale]);

  // ── Comparison result ────────────────────────────────────────────────

  const comparison = useMemo(() => {
    if (phase !== 'reveal' && phase !== 'complete') return null;
    if (drawnPoints.length === 0) return null;
    return comparePrediction(drawnPoints, projectedData);
  }, [phase, drawnPoints, projectedData]);

  const resultMsg = comparison ? getResultMessage(comparison.result) : null;

  // ── Current point indicator ──────────────────────────────────────────

  const currentX = xScale(currentEpoch);
  const currentY = yScale(currentBalance);

  // Pulse animation for the challenge phase
  const [pulseRadius, setPulseRadius] = useState(6);
  useEffect(() => {
    if (phase !== 'challenge' || prefersReducedMotion) return;
    let frame: number;
    const animate = () => {
      const t = (Date.now() % 2000) / 2000;
      setPulseRadius(6 + Math.sin(t * Math.PI * 2) * 3);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [phase, prefersReducedMotion]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
            You Draw It
          </CardTitle>
          <div className="flex gap-2">
            {(phase === 'reveal' || phase === 'complete') && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  Try Again
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  {copied ? 'Copied!' : 'Share'}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase prompt */}
        <AnimatePresence mode="wait">
          {phase === 'challenge' && (
            <motion.p
              key="challenge-text"
              className="text-sm text-muted-foreground text-center"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
            >
              Where do you think the treasury is heading?{' '}
              <span className="text-foreground font-medium">Draw your prediction.</span>
            </motion.p>
          )}
          {phase === 'drawing' && (
            <motion.p
              key="drawing-text"
              className="text-sm text-amber-400 text-center font-medium"
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Keep drawing... release to reveal the projection.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Chart */}
        <div
          ref={containerRef}
          className="relative w-full select-none"
          style={{ height: CHART_HEIGHT }}
          role="img"
          aria-label="Interactive treasury prediction chart. Draw your prediction of future treasury balance by clicking and dragging on the chart area to the right of the current epoch."
        >
          {width > 0 && (
            <svg
              ref={svgRef}
              width={width}
              height={CHART_HEIGHT}
              className={phase === 'challenge' || phase === 'drawing' ? 'cursor-crosshair' : ''}
            >
              <defs>
                <GlowFilter id="ydi-glow-hist" stdDeviation={2} />
                <GlowFilter id="ydi-glow-user" stdDeviation={3} />
                <GlowFilter id="ydi-glow-proj" stdDeviation={3} />
              </defs>

              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Grid lines */}
                {yTicks.map((t) => (
                  <g key={`y-${t}`}>
                    <line
                      x1={0}
                      x2={innerWidth}
                      y1={yScale(t)}
                      y2={yScale(t)}
                      stroke="currentColor"
                      strokeWidth={0.5}
                      strokeDasharray="4 4"
                      className="text-border"
                    />
                    <text
                      x={-8}
                      y={yScale(t)}
                      textAnchor="end"
                      dominantBaseline="central"
                      fontSize={chartTheme.font.size.tick}
                      className="fill-muted-foreground"
                      fontFamily={chartTheme.font.mono}
                    >
                      {formatAda(t)}
                    </text>
                  </g>
                ))}

                {/* X-axis ticks */}
                {xTicks.map((t) => (
                  <text
                    key={`x-${t}`}
                    x={xScale(t)}
                    y={innerHeight + 20}
                    textAnchor="middle"
                    fontSize={chartTheme.font.size.tick}
                    className="fill-muted-foreground"
                    fontFamily={chartTheme.font.mono}
                  >
                    {t}
                  </text>
                ))}

                {/* "Now" divider line */}
                <line
                  x1={currentX}
                  x2={currentX}
                  y1={0}
                  y2={innerHeight}
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeDasharray="6 4"
                  className="text-muted-foreground/40"
                />
                <text
                  x={currentX}
                  y={-6}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-muted-foreground"
                  fontFamily={chartTheme.font.family}
                >
                  Now
                </text>

                {/* Historical area fill */}
                <path d={historicalAreaPath} fill={COLORS.fillHistorical} />

                {/* Historical line — glow layer */}
                <path
                  d={historicalPath}
                  fill="none"
                  stroke={COLORS.historical}
                  strokeWidth={2.5}
                  filter="url(#ydi-glow-hist)"
                  opacity={0.3}
                />
                {/* Historical line — crisp */}
                <path
                  d={historicalPath}
                  fill="none"
                  stroke={COLORS.historical}
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                {/* Current point (pulsing dot) */}
                {phase === 'challenge' && (
                  <>
                    <circle
                      cx={currentX}
                      cy={currentY}
                      r={pulseRadius}
                      fill={COLORS.historical}
                      opacity={0.2}
                    />
                    <circle
                      cx={currentX}
                      cy={currentY}
                      r={4}
                      fill={COLORS.historical}
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  </>
                )}
                {phase !== 'challenge' && (
                  <circle
                    cx={currentX}
                    cy={currentY}
                    r={4}
                    fill={COLORS.historical}
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                )}

                {/* User drawn line */}
                {userPath && (
                  <>
                    <path
                      d={userPath}
                      fill="none"
                      stroke={COLORS.userDraw}
                      strokeWidth={2.5}
                      filter="url(#ydi-glow-user)"
                      opacity={0.3}
                    />
                    <path
                      d={userPath}
                      fill="none"
                      stroke={COLORS.userDraw}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={phase === 'drawing' ? '6 3' : 'none'}
                    />
                    {/* Drawn endpoint */}
                    {drawnPoints.length > 0 && (
                      <circle
                        cx={xScale(drawnPoints[drawnPoints.length - 1].epoch)}
                        cy={yScale(drawnPoints[drawnPoints.length - 1].balanceAda)}
                        r={4}
                        fill={COLORS.userDraw}
                        stroke="var(--background)"
                        strokeWidth={2}
                      />
                    )}
                  </>
                )}

                {/* Projection line (animated reveal) */}
                {(phase === 'reveal' || phase === 'complete') && projectionPath && (
                  <>
                    {/* Area fill fades in */}
                    <path
                      d={projectionAreaPath}
                      fill={COLORS.fillProjection}
                      opacity={revealProgress}
                    />
                    {/* Glow */}
                    <path
                      d={projectionPath}
                      fill="none"
                      stroke={COLORS.projection}
                      strokeWidth={2.5}
                      filter="url(#ydi-glow-proj)"
                      opacity={0.3 * revealProgress}
                    />
                    {/* Line with dash-offset animation */}
                    <path
                      d={projectionPath}
                      fill="none"
                      stroke={COLORS.projection}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={projectionPathLength}
                      strokeDashoffset={projectionPathLength * (1 - revealProgress)}
                    />

                    {/* Key event annotations */}
                    {phase === 'complete' &&
                      keyEvents.map((evt) => {
                        const projPt = projectedData.reduce((best, p) =>
                          Math.abs(p.epoch - evt.epoch) < Math.abs(best.epoch - evt.epoch)
                            ? p
                            : best,
                        );
                        const ex = xScale(evt.epoch);
                        const ey = yScale(projPt.balanceAda);
                        return (
                          <g
                            key={`evt-${evt.epoch}-${evt.label}`}
                            onMouseEnter={() => setHoveredEvent(evt)}
                            onMouseLeave={() => setHoveredEvent(null)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={ex}
                              cy={ey}
                              r={5}
                              fill={COLORS.eventDot}
                              stroke="var(--background)"
                              strokeWidth={2}
                            />
                            <circle cx={ex} cy={ey} r={8} fill="transparent" />
                          </g>
                        );
                      })}
                  </>
                )}

                {/* Interaction rect — only active during challenge/drawing */}
                {(phase === 'challenge' || phase === 'drawing') && (
                  <rect
                    x={Math.max(0, currentX)}
                    y={0}
                    width={Math.max(0, innerWidth - currentX)}
                    height={innerHeight}
                    fill="transparent"
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    aria-label="Drawing area. Click and drag to draw your treasury prediction."
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={allBalances}
                    aria-valuenow={
                      drawnPoints.length > 0
                        ? Math.round(drawnPoints[drawnPoints.length - 1].balanceAda)
                        : Math.round(currentBalance)
                    }
                  />
                )}
              </g>
            </svg>
          )}

          {/* Event tooltip */}
          {hoveredEvent && width > 0 && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: margin.left + xScale(hoveredEvent.epoch),
                top: 40,
                transform: `translate(${xScale(hoveredEvent.epoch) > innerWidth * 0.7 ? '-110%' : '10%'}, 0)`,
              }}
            >
              <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
                <p className="font-medium mb-0.5">Epoch {hoveredEvent.epoch}</p>
                <p className="text-muted-foreground">{hoveredEvent.label}</p>
                {hoveredEvent.amountAda !== undefined && (
                  <p className="font-mono tabular-nums text-amber-400 mt-0.5">
                    {formatAda(hoveredEvent.amountAda)} ADA
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 justify-center flex-wrap text-xs text-muted-foreground">
          <LegendItem color={COLORS.historical} label="Historical" />
          {(phase === 'drawing' || phase === 'reveal' || phase === 'complete') && (
            <LegendItem color={COLORS.userDraw} label="Your Prediction" />
          )}
          {(phase === 'reveal' || phase === 'complete') && (
            <LegendItem color={COLORS.projection} label="Projected (Conservative)" />
          )}
        </div>

        {/* Result message */}
        <AnimatePresence>
          {phase === 'complete' && comparison && resultMsg && (
            <motion.div
              key="result"
              className="text-center space-y-3 py-2"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              <div
                className={`flex items-center justify-center gap-2 text-lg font-semibold ${resultMsg.className}`}
              >
                <resultMsg.icon className="h-5 w-5" aria-hidden="true" />
                {resultMsg.text}
              </div>
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Your prediction</div>
                  <div
                    className="font-mono tabular-nums font-semibold"
                    style={{ color: COLORS.userDraw }}
                  >
                    {formatAda(comparison.userFinal)} ADA
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Projected</div>
                  <div
                    className="font-mono tabular-nums font-semibold"
                    style={{ color: COLORS.projection }}
                  >
                    {formatAda(comparison.projectedFinal)} ADA
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Difference</div>
                  <div className="font-mono tabular-nums font-semibold">
                    {comparison.pctDiff >= 0 ? '+' : ''}
                    {Math.round(comparison.pctDiff * 100)}%
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ── Legend Item ───────────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
