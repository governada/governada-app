/**
 * Chart Design System — Governance Observatory chart tokens.
 * All custom chart components reference these shared values.
 */

export const chartTheme = {
  colors: {
    grid: 'oklch(0.17 0.015 260)',
    gridLight: 'oklch(0.88 0.005 260)',
    axis: 'oklch(0.55 0.03 260)',
    axisLight: 'oklch(0.45 0.02 260)',
    tooltipBg: 'oklch(0.10 0.015 260)',
    tooltipBorder: 'oklch(0.20 0.015 260)',
  },
  font: {
    family: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
    size: {
      tick: 11,
      label: 12,
      tooltip: 12,
    },
  },
  margin: {
    top: 10,
    right: 12,
    bottom: 30,
    left: 48,
  },
  animation: {
    pathDuration: 1200,
    dotDelay: 800,
  },
} as const;

export const CHART_PALETTE = [
  'oklch(0.72 0.14 200)',  // chart-1: Electric Cyan
  'oklch(0.68 0.16 160)',  // chart-2: Teal
  'oklch(0.60 0.18 290)',  // chart-3: Purple
  'oklch(0.75 0.14 80)',   // chart-4: Amber
  'oklch(0.60 0.20 25)',   // chart-5: Red
] as const;

export const VOTE_CHART_COLORS = {
  Yes: '#10b981',
  No: '#ef4444',
  Abstain: '#f59e0b',
} as const;

export const SCENARIO_CHART_COLORS: Record<string, string> = {
  conservative: 'oklch(0.72 0.14 200)',
  moderate: 'oklch(0.75 0.14 80)',
  aggressive: 'oklch(0.60 0.20 25)',
  freeze: 'oklch(0.68 0.16 160)',
};
